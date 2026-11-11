/** Endpoints del módulo Sesión (ruta base /api/v1/sesion). Cada uno declara su permiso. */
import { cambiarPasswordEsquema } from '../../../shared/esquemas';
import { json, leerJson } from '../../plumbing/http';
import { SOLO_SESION, r, ruta } from '../../plumbing/router';
import { cerrarSesion, cookieCierre } from '../../plumbing/sesion';
import { zonaHoraria } from '../../plumbing/zona';
import { cambiarPassword } from './features/mi-cuenta';
// --- Sesión ---
ruta('GET', '/api/v1/sesion/yo', SOLO_SESION /* datos del propio usuario */, async (ctx) =>
  r(ctx, { usuario: ctx.usuario, zona_horaria: await zonaHoraria(ctx.env) }),
);
// Además de borrar la sesión y la cookie, se pide al navegador vaciar su caché HTTP de este sitio
// (fotos y respuestas guardadas). Con ?todas=1 se cierran también los demás dispositivos.
ruta('POST', '/api/v1/sesion/logout', SOLO_SESION /* su propia sesión */, async (ctx) => {
  await cerrarSesion(ctx.env, ctx.req, new URL(ctx.req.url).searchParams.get('todas') === '1');
  return json({ ok: true }, 200, {
    'Set-Cookie': cookieCierre(),
    'Clear-Site-Data': '"cache"',
  });
});
// --- Mi cuenta (lo propio de cada usuario; sus datos solo los corrige un administrador) ---
ruta('POST', '/api/v1/sesion/cambiar-password', SOLO_SESION /* su propia contraseña */, async (ctx) =>
  r(ctx, await cambiarPassword(ctx, await leerJson(ctx.req, cambiarPasswordEsquema))),
);
