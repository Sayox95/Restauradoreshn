import type { EstadoCuenta } from '../../../../shared/constantes';
import { loginEsquema } from '../../../../shared/esquemas';
import { type Env } from '../../../plumbing/contexto';
import { ApiError, json, leerJson } from '../../../plumbing/http';
import { crearSesion, verificarPassword } from '../../../plumbing/sesion';

/** Tras 5 contraseñas incorrectas seguidas (en 15 min) el usuario queda bloqueado 15 min. */
export const MAX_FALLOS_LOGIN = 5;
export const VENTANA_LOGIN_MS = 15 * 60_000;

export async function login(env: Env, req: Request, ahora: string): Promise<Response> {
  const d = await leerJson(req, loginEsquema);
  // Se cuenta por usuario o correo (exista o no, para no revelar cuáles existen).
  const clave = d.usuario.trim().toLowerCase();
  const intento = await env.DB.prepare('SELECT fallos, desde, bloqueado_hasta FROM intentos_login WHERE clave = ?')
    .bind(clave)
    .first<{ fallos: number; desde: string; bloqueado_hasta: string | null }>();
  if (intento?.bloqueado_hasta && intento.bloqueado_hasta > ahora) {
    const min = Math.ceil((Date.parse(intento.bloqueado_hasta) - Date.parse(ahora)) / 60_000);
    throw new ApiError(429, `Demasiados intentos fallidos. Espere ${min} ${min === 1 ? 'minuto' : 'minutos'} e intente de nuevo.`);
  }
  // Se ingresa con el usuario o con el correo institucional.
  const u = await env.DB.prepare('SELECT id, hash_password, estado FROM usuarios WHERE usuario = ?1 OR correo = ?1').bind(clave).first<{
    id: number;
    hash_password: string;
    estado: EstadoCuenta;
  }>();
  // Se verifica incluso si el usuario no existe para no revelar cuáles existen por el tiempo de respuesta.
  const ok = await verificarPassword(d.password, u?.hash_password ?? 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
  if (!u || !ok) {
    const vigente = intento && Date.parse(ahora) - Date.parse(intento.desde) < VENTANA_LOGIN_MS && !intento.bloqueado_hasta;
    const fallos = vigente ? intento.fallos + 1 : 1;
    const bloqueo = fallos >= MAX_FALLOS_LOGIN ? new Date(Date.parse(ahora) + VENTANA_LOGIN_MS).toISOString() : null;
    await env.DB.prepare('INSERT OR REPLACE INTO intentos_login (clave, fallos, desde, bloqueado_hasta) VALUES (?, ?, ?, ?)')
      .bind(clave, fallos, vigente ? intento.desde : ahora, bloqueo)
      .run();
    throw new ApiError(401, 'Usuario o contraseña incorrectos.');
  }
  if (intento) await env.DB.prepare('DELETE FROM intentos_login WHERE clave = ?').bind(clave).run();
  // El estado de la cuenta solo se revela a quien conoce la contraseña.
  if (u.estado === 'pendiente') throw new ApiError(403, 'Su cuenta está pendiente de aprobación por un administrador.');
  if (u.estado === 'rechazada') throw new ApiError(403, 'Su solicitud de cuenta no fue aprobada. Consulte con un administrador.');
  if (u.estado !== 'activa') throw new ApiError(403, 'Su cuenta está desactivada. Consulte con un administrador.');
  await env.DB.prepare('UPDATE usuarios SET ultimo_ingreso_en = ? WHERE id = ?').bind(ahora, u.id).run();
  const cookie = await crearSesion(env, u.id, ahora);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}
