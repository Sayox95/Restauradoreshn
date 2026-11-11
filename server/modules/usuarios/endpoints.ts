/** Endpoints del módulo Usuarios (ruta base /api/v1/usuarios). Cada uno declara su permiso. */
import { idParam, leerJson } from '../../plumbing/http';
import { r, ruta } from '../../plumbing/router';
import { aprobarCuentaEsquema, motivoEsquema, usuarioCrearEsquema, usuarioEditarEsquema } from '../../../shared/esquemas';
import { PermisosUsuarios } from './permisos';
import { cerrarSesiones, restablecerPassword } from './features/acceso-cuenta';
import { listarUsuarios, verUsuario } from './features/consultar-usuarios';
import { crearUsuario } from './features/crear-usuario';
import { editarUsuario } from './features/editar-usuario';
import { activarCuenta, aprobarCuenta, desactivarCuenta, rechazarCuenta } from './features/estado-cuenta';

const G = [PermisosUsuarios.Gestionar];
// --- Consulta ---
ruta('GET', '/api/v1/usuarios', G, async (ctx) => r(ctx, await listarUsuarios(ctx)));
ruta('GET', '/api/v1/usuarios/:id', G, async (ctx) => r(ctx, await verUsuario(ctx, idParam(ctx.params.id))));
// --- Alta y datos ---
ruta('POST', '/api/v1/usuarios', G, async (ctx) => r(ctx, await crearUsuario(ctx, await leerJson(ctx.req, usuarioCrearEsquema)), 201));
ruta('PATCH', '/api/v1/usuarios/:id', G, async (ctx) =>
  r(ctx, await editarUsuario(ctx, idParam(ctx.params.id), await leerJson(ctx.req, usuarioEditarEsquema))),
);
// --- Estado de la cuenta ---
ruta('POST', '/api/v1/usuarios/:id/aprobar', G, async (ctx) =>
  r(ctx, await aprobarCuenta(ctx, idParam(ctx.params.id), await leerJson(ctx.req, aprobarCuentaEsquema))),
);
ruta('POST', '/api/v1/usuarios/:id/rechazar', G, async (ctx) =>
  r(ctx, await rechazarCuenta(ctx, idParam(ctx.params.id), (await leerJson(ctx.req, motivoEsquema)).motivo)),
);
ruta('POST', '/api/v1/usuarios/:id/desactivar', G, async (ctx) =>
  r(ctx, await desactivarCuenta(ctx, idParam(ctx.params.id), (await leerJson(ctx.req, motivoEsquema)).motivo)),
);
ruta('POST', '/api/v1/usuarios/:id/activar', G, async (ctx) => r(ctx, await activarCuenta(ctx, idParam(ctx.params.id))));
// --- Acceso ---
ruta('POST', '/api/v1/usuarios/:id/restablecer-password', G, async (ctx) => r(ctx, await restablecerPassword(ctx, idParam(ctx.params.id))));
ruta('POST', '/api/v1/usuarios/:id/cerrar-sesiones', G, async (ctx) => r(ctx, await cerrarSesiones(ctx, idParam(ctx.params.id))));
