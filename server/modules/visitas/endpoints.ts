/** Endpoints del módulo Visitas (ruta base /api/v1/visitas). Cada uno declara su permiso. */
import { visitaEsquema } from '../../../shared/visitas';
import { idParam, leerJson, paginacion } from '../../plumbing/http';
import { SOLO_SESION, r, ruta } from '../../plumbing/router';
import { PermisosVisitas } from './permisos';
import { detalleVisita } from './comun';
import { descargarFoto, descargarPdf, subirFoto, subirPdf } from './features/archivos-visita';
import { exportarVisitas } from './features/exportar';
import { listarVisitas } from './features/listar-visitas';
import { registrarVisita } from './features/registrar-visita';

// Lo propio del usuario (sin permiso: cada quien ve lo que registró). Van antes de /:id.
ruta('GET', '/api/v1/visitas/mios', SOLO_SESION /* solo las visitas que registró el usuario */, async (ctx) => {
  const { pagina, porPagina, offset } = paginacion(ctx.url);
  return r(ctx, await listarVisitas(ctx, pagina, porPagina, offset, true));
});
ruta('GET', '/api/v1/visitas/exportar', [PermisosVisitas.Exportar], async (ctx) => exportarVisitas(ctx));

// --- Visitas ---
ruta('GET', '/api/v1/visitas', [PermisosVisitas.Consultar], async (ctx) => {
  const { pagina, porPagina, offset } = paginacion(ctx.url);
  return r(ctx, await listarVisitas(ctx, pagina, porPagina, offset));
});
ruta('POST', '/api/v1/visitas', [PermisosVisitas.Registrar], async (ctx) => {
  const { visita, creada } = await registrarVisita(ctx, await leerJson(ctx.req, visitaEsquema));
  return r(ctx, { visita, creada }, creada ? 201 : 200);
});
ruta('GET', '/api/v1/visitas/:id', SOLO_SESION /* sin visitas_consultar, solo las que registró (filtroVisitas) */, async (ctx) =>
  r(ctx, await detalleVisita(ctx, idParam(ctx.params.id))),
);

// --- Fotos originales (E2) y PDF de la ficha (E3) ---
ruta('PUT', '/api/v1/visitas/:id/fotos/:orden', [PermisosVisitas.Registrar] /* solo en sus visitas */, async (ctx) =>
  r(ctx, await subirFoto(ctx, idParam(ctx.params.id), ctx.params.orden), 201),
);
ruta('GET', '/api/v1/visitas/:id/fotos/:orden', SOLO_SESION /* fotos de las visitas que puede ver (filtroVisitas) */, async (ctx) =>
  descargarFoto(ctx, idParam(ctx.params.id), ctx.params.orden),
);
ruta('PUT', '/api/v1/visitas/:id/pdf', [PermisosVisitas.Registrar] /* solo en sus visitas */, async (ctx) =>
  r(ctx, await subirPdf(ctx, idParam(ctx.params.id)), 201),
);
ruta('GET', '/api/v1/visitas/:id/pdf', SOLO_SESION /* PDF de las visitas que puede ver (filtroVisitas) */, async (ctx) =>
  descargarPdf(ctx, idParam(ctx.params.id)),
);
