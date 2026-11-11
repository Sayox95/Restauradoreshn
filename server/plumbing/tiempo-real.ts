/**
 * Avisos de tiempo real (lineamientos: «el servidor solo avisa algo cambió»). Tras toda escritura exitosa
 * en un módulo se avisa «cambió <módulo> (id)»; cada pantalla interesada vuelve a consultar.
 * Sin el canal publicado (enlace TIEMPO_REAL ausente) la app funciona igual, sin avisos.
 */
import { PermisosUsuarios } from '../../shared/permisos';
import { type AvisoCanal, CABECERA_CONEXION, MODULOS_AVISO, type ModuloAviso, type NotificacionCanal } from '../../shared/tiempo-real';
import type { Env } from './contexto';

const canal = (env: Env) => env.TIEMPO_REAL!.get(env.TIEMPO_REAL!.idFromName('canal'));

/** Aviso que corresponde a una escritura en /api/v1/<modulo>/…, o null si ese módulo no avisa. */
export function avisoDeEscritura(req: Request, url: URL): AvisoCanal | null {
  const [, , , modulo, ...resto] = url.pathname.split('/');
  if (!(MODULOS_AVISO as readonly string[]).includes(modulo ?? '')) return null;
  // El primer número de la ruta: /visitas/12/fotos/1 → 12.
  const id = resto.map(Number).find((n) => Number.isInteger(n) && n > 0) ?? null;
  return {
    modulo: modulo as ModuloAviso,
    id,
    origen: req.headers.get(CABECERA_CONEXION),
    // Las cuentas solo interesan a quien las gestiona y a la persona dueña de la cuenta.
    permiso: modulo === 'usuarios' ? PermisosUsuarios.Gestionar : null,
    destinatario: modulo === 'usuarios' ? id : null,
  };
}

/** Envía los avisos al canal. Nunca falla: un aviso perdido solo retrasa la actualización de otras pantallas. */
export async function enviarAvisos(env: Env, avisos: (AvisoCanal | NotificacionCanal)[]) {
  if (!env.TIEMPO_REAL || !avisos.length) return;
  try {
    await canal(env).fetch('https://canal/avisar', { method: 'POST', body: JSON.stringify(avisos) });
  } catch (e) {
    console.error('No se pudo enviar el aviso de tiempo real:', e);
  }
}

/** Abre la conexión del usuario con el canal (la sesión ya se validó). */
export function conectarCanal(env: Env, usuario: { id: number; permisos: string[] }) {
  return canal(env).fetch('https://canal/conectar', {
    headers: {
      Upgrade: 'websocket',
      'X-Usuario': String(usuario.id),
      'X-Permisos': usuario.permisos.join(','),
    },
  });
}
