/**
 * Idempotency-Key (lineamientos v2 §7, «doble clic»): las rutas que crean algo importante piden la
 * cabecera `Idempotency-Key`, una clave única por intento que genera la pantalla. Si llega otra vez la
 * misma clave (doble toque, reintento tras perder la señal), se devuelve la respuesta guardada y no se
 * crea nada nuevo. Las claves se guardan un día.
 */
import type { Env } from './contexto';
import { ApiError, json } from './http';

export const CABECERA_IDEMPOTENCIA = 'Idempotency-Key';
const UN_DIA_MS = 24 * 3600 * 1000;

export async function conIdempotencia(
  env: Env,
  usuarioId: number,
  req: Request,
  ruta: string,
  ahora: string,
  crear: () => Promise<Response>,
): Promise<Response> {
  const clave = req.headers.get(CABECERA_IDEMPOTENCIA)?.trim() ?? '';
  if (!/^[A-Za-z0-9-]{8,80}$/.test(clave))
    throw new ApiError(400, 'Falta la cabecera Idempotency-Key.');
  const previa = await env.DB.prepare(
    'SELECT ruta, estado, respuesta FROM idempotencia WHERE usuario_id = ? AND clave = ?',
  )
    .bind(usuarioId, clave)
    .first<{ ruta: string; estado: number; respuesta: string }>();
  if (previa) {
    if (previa.ruta !== ruta)
      throw new ApiError(
        409,
        'La clave Idempotency-Key ya se usó en otra operación.',
      );
    return json(JSON.parse(previa.respuesta), previa.estado);
  }
  const res = await crear();
  if (res.ok) {
    const respuesta = await res.clone().text();
    const limite = new Date(Date.parse(ahora) - UN_DIA_MS).toISOString();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM idempotencia WHERE creado_en < ?').bind(
        limite,
      ),
      env.DB.prepare(
        'INSERT OR IGNORE INTO idempotencia (usuario_id, clave, ruta, estado, respuesta, creado_en) VALUES (?,?,?,?,?,?)',
      ).bind(usuarioId, clave, ruta, res.status, respuesta, ahora),
    ]);
  }
  return res;
}
