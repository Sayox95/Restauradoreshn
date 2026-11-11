/** Endpoint del canal de tiempo real (ruta base /api/v1/tiempo-real). */
import { ApiError } from '../../plumbing/http';
import { SOLO_SESION, ruta } from '../../plumbing/router';
import { conectarCanal } from '../../plumbing/tiempo-real';

// Conexión WebSocket del usuario de la sesión: solo recibe avisos «algo cambió» (sin datos); cada pantalla
// vuelve a consultar por los endpoints normales, que aplican sus permisos.
ruta('GET', '/api/v1/tiempo-real', SOLO_SESION /* su propia conexión */, async (ctx) => {
  // Contra el secuestro de WebSocket desde otro sitio: la conexión debe abrirse desde la misma app.
  const origen = ctx.req.headers.get('Origin');
  if (origen && origen !== ctx.url.origin) throw new ApiError(403, 'Origen no permitido.');
  // Primero «¿está publicado?»: la app pregunta una vez (sin Upgrade) y, si no lo está, no reintenta.
  if (!ctx.env.TIEMPO_REAL) throw new ApiError(503, 'El canal de tiempo real no está disponible.');
  if (ctx.req.headers.get('Upgrade') !== 'websocket') throw new ApiError(426, 'Se esperaba una conexión WebSocket.');
  return conectarCanal(ctx.env, ctx.usuario);
});
