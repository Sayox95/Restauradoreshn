/**
 * Entrada única de la API (Pages Functions). Cada módulo registra sus endpoints en su endpoints.ts
 * con la ruta base /api/v1/<modulo> y el permiso de cada uno.
 */
import './modules/sesion/endpoints';
import './modules/visitas/endpoints';
import './modules/usuarios/endpoints';
import './modules/catalogos/endpoints';
import './modules/tiempo-real/endpoints';
import { tieneAcceso } from '../shared/permisos';
import { login } from './modules/sesion/features/iniciar-sesion';
import { registrarCuenta } from './modules/sesion/features/solicitar-cuenta';
import { type Env } from './plumbing/contexto';
import { asegurarEsquema } from './plumbing/esquema';
import { ApiError, json, noAutenticado, prohibido, respuestaError } from './plumbing/http';
import { SOLO_SESION, rutas } from './plumbing/router';
import { resolverSesion } from './plumbing/sesion';
import { avisoDeEscritura, enviarAvisos } from './plumbing/tiempo-real';
import type { NotificacionCanal } from '../shared/tiempo-real';
import { PermisosUsuarios } from '../shared/permisos';

const RUTAS_CON_PASSWORD_TEMPORAL = ['/api/v1/sesion/yo', '/api/v1/sesion/logout', '/api/v1/sesion/cambiar-password'];

/**
 * Punto de entrada único de la API. `ahora` se puede inyectar en pruebas. `esperar` (waitUntil de la
 * plataforma) deja terminar el envío de avisos de tiempo real después de responder.
 */
export async function manejarApi(
  req: Request,
  env: Env,
  ahora = new Date().toISOString(),
  esperar: (p: Promise<unknown>) => void = () => {},
): Promise<Response> {
  // Los avisos salen solo tras una escritura exitosa (avisar antes haría recargar datos viejos).
  const avisar = (avisos: Parameters<typeof enviarAvisos>[1]) => esperar(enviarAvisos(env, avisos));
  const url = new URL(req.url);
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Protección CSRF: las escrituras deben originarse en la misma aplicación.
      const origen = req.headers.get('Origin');
      if (origen && origen !== url.origin) throw new ApiError(403, 'Origen no permitido.');
    }
    await asegurarEsquema(env);
    if (url.pathname === '/api/v1/sesion/login' && req.method === 'POST') return await login(env, req, ahora);
    if (url.pathname === '/api/v1/sesion/solicitar-cuenta' && req.method === 'POST') {
      const res = await registrarCuenta(env, req, ahora);
      if (res.ok)
        avisar([
          { modulo: 'usuarios', id: null, origen: null, permiso: PermisosUsuarios.Gestionar },
          {
            tipo: 'notificacion',
            mensaje: 'Nueva solicitud de cuenta',
            modulo: 'usuarios',
            id: null,
            destino: { permiso: PermisosUsuarios.Gestionar },
            origen: null,
          },
        ]);
      return res;
    }

    const sesion = await resolverSesion(env, req, ahora);
    // «¿Quién soy?» sin sesión no es un error: responde «nadie» (evita errores 401 en la consola al abrir la app).
    if (!sesion && url.pathname === '/api/v1/sesion/yo' && req.method === 'GET') return json({ datos: null, servidor_ahora: ahora });
    if (!sesion) throw noAutenticado();
    // Con contraseña temporal solo se puede cambiarla (o salir) antes de usar la app.
    if (sesion.usuario.debe_cambiar_password && !RUTAS_CON_PASSWORD_TEMPORAL.includes(url.pathname))
      throw new ApiError(403, 'Debe cambiar su contraseña temporal antes de continuar.');

    for (const rt of rutas) {
      if (rt.metodo !== req.method) continue;
      const m = rt.patron.exec(url.pathname);
      if (!m) continue;
      if (rt.acceso !== SOLO_SESION && !tieneAcceso(sesion.usuario.permisos, rt.acceso)) throw prohibido();
      const params = Object.fromEntries(rt.claves.map((k, i) => [k, decodeURIComponent(m[i + 1]!)]));
      const notificaciones: NotificacionCanal[] = [];
      const res = (await rt.manejar({
        env,
        req,
        url,
        params,
        usuario: sesion.usuario,
        ahora,
        notificaciones,
      })) as Response;
      // La conexión de tiempo real (101) no lleva cookie: sus cabeceras no se pueden cambiar.
      if (sesion.cookie && res.status !== 101) res.headers.append('Set-Cookie', sesion.cookie);
      if (req.method !== 'GET' && res.ok) {
        const aviso = avisoDeEscritura(req, url);
        // Las notificaciones no vuelven a la conexión que hizo el cambio.
        const origen = aviso?.origen ?? null;
        avisar([...(aviso ? [aviso] : []), ...notificaciones.map((n) => ({ ...n, origen }))]);
      }
      return res;
    }
    const existe = rutas.some((rt) => rt.patron.test(url.pathname));
    throw new ApiError(existe ? 405 : 404, existe ? 'Método no permitido.' : 'Recurso no encontrado.');
  } catch (e) {
    return respuestaError(e);
  }
}
