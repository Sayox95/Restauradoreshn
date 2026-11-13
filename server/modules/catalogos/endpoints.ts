/** Endpoints del módulo Catálogos (ruta base /api/v1/catalogos). Cada uno declara su permiso. */
import { sentenciaAuditoria } from '../../plumbing/contexto';
import { idParam, leerJson } from '../../plumbing/http';
import { r, ruta } from '../../plumbing/router';
import { zonaHoraria } from '../../plumbing/zona';
import {
  configuracionEsquema,
  marcaCatalogoEsquema,
  materialCatalogoEsquema,
  restauradorEsquema,
  tableroEsquema,
  tipoCatalogoEsquema,
} from '../../../shared/esquemas';
import { PermisosVisitas } from '../../../shared/permisos';
import { PermisosCatalogos } from './permisos';
import { catalogosVisita, guardarCatalogo, guardarTablero, listarCatalogo, listarTableros } from './features/gestionar-catalogos';

const G = [PermisosCatalogos.Gestionar];

// --- Lo que usa el formulario de visita (solo registros activos) ---
ruta('GET', '/api/v1/catalogos/visita', [PermisosVisitas.Registrar, PermisosVisitas.Consultar, PermisosCatalogos.Gestionar], async (ctx) =>
  r(ctx, await catalogosVisita(ctx)),
);

// --- Administración de cada catálogo (se desactivan, no se borran) ---
for (const [cat, esquema] of [
  ['restauradores', restauradorEsquema],
  ['materiales', materialCatalogoEsquema],
  ['tipos', tipoCatalogoEsquema],
  ['marcas', marcaCatalogoEsquema],
] as const) {
  ruta('GET', `/api/v1/catalogos/${cat}`, G, async (ctx) => r(ctx, await listarCatalogo(ctx, cat)));
  ruta('POST', `/api/v1/catalogos/${cat}`, G, async (ctx) => r(ctx, await guardarCatalogo(ctx, cat, null, await leerJson(ctx.req, esquema)), 201));
  ruta('PATCH', `/api/v1/catalogos/${cat}/:id`, G, async (ctx) =>
    r(ctx, await guardarCatalogo(ctx, cat, idParam(ctx.params.id), await leerJson(ctx.req, esquema))),
  );
}

// --- Tableros de control: la lista de campos de cada marca ---
ruta('GET', '/api/v1/catalogos/tableros', G, async (ctx) => r(ctx, await listarTableros(ctx)));
ruta('PUT', '/api/v1/catalogos/tableros', G, async (ctx) => r(ctx, await guardarTablero(ctx, await leerJson(ctx.req, tableroEsquema))));

// --- Configuración ---
ruta('PUT', '/api/v1/catalogos/configuracion', G, async (ctx) => {
  const d = await leerJson(ctx.req, configuracionEsquema);
  const antes = await zonaHoraria(ctx.env);
  await ctx.env.DB.batch([
    ctx.env.DB.prepare("INSERT INTO configuracion (clave, valor) VALUES ('zona_horaria', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").bind(
      d.zona_horaria,
    ),
    sentenciaAuditoria(ctx.env, ctx.usuario.id, 'editar', 'configuracion', null, { zona_horaria: antes }, d, ctx.ahora),
  ]);
  return r(ctx, d);
});
