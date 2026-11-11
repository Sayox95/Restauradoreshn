import type { Rol } from '../../shared/constantes';
import type { UsuarioSesion } from '../../shared/tipos';
import { type Env } from './contexto';

export const ITERACIONES = 100_000; // máximo admitido por PBKDF2 en Workers
export const DURACION_SESION_MS = 30 * 24 * 3600 * 1000;
export const RENOVAR_SI_RESTA_MS = 15 * 24 * 3600 * 1000;
export const COOKIE = 'sesion';

export const enc = new TextEncoder();

export function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}
export function desdeB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function derivar(password: string, sal: Uint8Array, iteraciones: number): Promise<ArrayBuffer> {
  const clave = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, clave, 256);
}

export async function hashPassword(password: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(password, sal, ITERACIONES);
  return `pbkdf2$${ITERACIONES}$${b64(sal)}$${b64(hash)}`;
}

export async function verificarPassword(password: string, guardado: string): Promise<boolean> {
  const [alg, it, salB64, hashB64] = guardado.split('$');
  if (alg !== 'pbkdf2' || !it || !salB64 || !hashB64) return false;
  const calculado = new Uint8Array(await derivar(password, desdeB64(salB64), Number(it)));
  const esperado = desdeB64(hashB64);
  if (calculado.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < calculado.length; i++) dif |= calculado[i]! ^ esperado[i]!;
  return dif === 0;
}

export async function sha256(texto: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function cookieSesion(token: string, maxAgeSeg: number): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeg}`;
}

export async function crearSesion(env: Env, usuarioId: number, ahora: string): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const expira = new Date(Date.parse(ahora) + DURACION_SESION_MS).toISOString();
  await env.DB.batch([
    // Limpieza de sesiones vencidas de todos los usuarios (las abandonadas sin cerrar sesión).
    env.DB.prepare('DELETE FROM sesiones WHERE expira_en < ?').bind(ahora),
    env.DB.prepare('INSERT INTO sesiones (token_hash, usuario_id, expira_en, creado_en) VALUES (?,?,?,?)').bind(await sha256(token), usuarioId, expira, ahora),
  ]);
  return cookieSesion(token, DURACION_SESION_MS / 1000);
}

export function cookieCierre(): string {
  return cookieSesion('', 0);
}

export function leerToken(req: Request): string | null {
  const cookies = req.headers.get('Cookie') ?? '';
  for (const parte of cookies.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) return v.join('=') || null;
  }
  return null;
}

/** Borra la sesión actual o, con `todas`, todas las sesiones del mismo usuario (otros dispositivos). */
export async function cerrarSesion(env: Env, req: Request, todas = false) {
  const token = leerToken(req);
  if (!token) return;
  const hash = await sha256(token);
  if (todas) await env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = (SELECT usuario_id FROM sesiones WHERE token_hash = ?)').bind(hash).run();
  else await env.DB.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(hash).run();
}

/** Hash del token de la sesión actual (para conservarla al cerrar las demás). */
export async function hashSesionActual(req: Request): Promise<string | null> {
  const token = leerToken(req);
  return token ? sha256(token) : null;
}

/**
 * Contraseña temporal que entrega un administrador: 12 caracteres sin los que se confunden al dictarlos
 * (0/o, 1/l/i), en grupos de 4. Se pide cambiarla en el primer ingreso.
 */
export function passwordTemporal(): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789';
  const salida: string[] = [];
  while (salida.length < 12) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      // Se descartan los valores que sesgarían la distribución.
      if (b < 256 - (256 % alfabeto.length) && salida.length < 12) salida.push(alfabeto[b % alfabeto.length]!);
    }
  }
  return [0, 4, 8].map((i) => salida.slice(i, i + 4).join('')).join('-');
}

export async function cargarUsuarioPorId(env: Env, id: number): Promise<UsuarioSesion | null> {
  const u = await env.DB.prepare("SELECT id, usuario, nombre, correo, telefono, debe_cambiar_password, rol FROM usuarios WHERE id = ? AND estado = 'activa'")
    .bind(id)
    .first<{ id: number; usuario: string; nombre: string; correo: string | null; telefono: string | null; debe_cambiar_password: number; rol: Rol }>();
  if (!u) return null;
  const permisos = await env.DB.prepare(
    'SELECT DISTINCT rp.permiso_codigo FROM usuario_roles ur JOIN rol_permisos rp ON rp.rol_codigo = ur.rol_codigo WHERE ur.usuario_id = ?',
  )
    .bind(id)
    .all<{ permiso_codigo: string }>();
  return {
    ...u,
    debe_cambiar_password: !!u.debe_cambiar_password,
    permisos: permisos.results.map((r) => r.permiso_codigo),
  };
}

/** Devuelve el usuario de la sesión y, si corresponde, una cookie renovada. */
export async function resolverSesion(env: Env, req: Request, ahora: string): Promise<{ usuario: UsuarioSesion; cookie?: string } | null> {
  const token = leerToken(req);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const s = await env.DB.prepare('SELECT usuario_id, expira_en FROM sesiones WHERE token_hash = ? AND expira_en > ?')
    .bind(tokenHash, ahora)
    .first<{ usuario_id: number; expira_en: string }>();
  if (!s) return null;
  const usuario = await cargarUsuarioPorId(env, s.usuario_id);
  if (!usuario) return null;
  if (Date.parse(s.expira_en) - Date.parse(ahora) < RENOVAR_SI_RESTA_MS) {
    const expira = new Date(Date.parse(ahora) + DURACION_SESION_MS).toISOString();
    await env.DB.prepare('UPDATE sesiones SET expira_en = ? WHERE token_hash = ?').bind(expira, tokenHash).run();
    return { usuario, cookie: cookieSesion(token, DURACION_SESION_MS / 1000) };
  }
  return { usuario };
}
