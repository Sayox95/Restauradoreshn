import type { DestinoNotificacion, Notificacion, NotificacionCanal } from '../../shared/tiempo-real';
import type { UsuarioSesion } from '../../shared/tipos';
import { type Permiso, PermisosVisitas, tieneAcceso } from '../../shared/permisos';
import { prohibido } from './http';

export interface Env {
  DB: D1Database;
  /** Fotos y PDF de las visitas (excepciones E2 y E3). */
  ARCHIVOS: R2Bucket;
  /** Canal de tiempo real (Durable Object del Worker restauradores-tiempo-real); opcional. */
  TIEMPO_REAL?: DurableObjectNamespace;
}

export interface Ctx {
  env: Env;
  req: Request;
  url: URL;
  params: Record<string, string>;
  usuario: UsuarioSesion;
  /** Hora oficial del servidor (UTC ISO) para todos los cálculos de la solicitud. */
  ahora: string;
  /** Notificaciones dirigidas que se envían solo si la solicitud termina bien (ver notificar). */
  notificaciones: NotificacionCanal[];
}

/** Agrega una notificación dirigida; sale por el canal de tiempo real después de guardar con éxito. */
export function notificar(ctx: Ctx, n: Notificacion, destino: DestinoNotificacion) {
  ctx.notificaciones.push({ tipo: 'notificacion', ...n, destino: { excluir: ctx.usuario.id, ...destino }, origen: null });
}

export const tiene = (usuario: UsuarioSesion, ...permisos: Permiso[]) => tieneAcceso(usuario.permisos, permisos);

/** Rechaza la solicitud si el usuario no tiene ninguno de los permisos indicados. */
export function requierePermiso(ctx: Ctx, ...permisos: Permiso[]) {
  if (!tiene(ctx.usuario, ...permisos)) throw prohibido();
}

/** Las inspecciones eliminadas no se ven en ninguna parte (las anteriores a v3 no tienen fila en v). */
export const NO_ELIMINADA = 'v.eliminada_en IS NULL';

/**
 * Inspecciones propias (alias `r` para registros y `v` para visitas_registro, ver DESDE_VISITAS): las
 * que registró el usuario y aquellas en las que figura en el personal (por su usuario_id).
 */
export function visitasPropias(usuario: UsuarioSesion): { sql: string; binds: number[] } {
  return {
    sql: `(${NO_ELIMINADA} AND (v.registrado_por = ? OR EXISTS (
      SELECT 1 FROM json_each(CASE WHEN json_valid(r.personal_json) THEN r.personal_json ELSE '[]' END) p
      WHERE json_extract(p.value, '$.usuario_id') = ?)))`,
    binds: [usuario.id, usuario.id],
  };
}

/**
 * Filtro de visitas: con permiso de consultar, todas; sin él, las propias (las que registró o en las
 * que participó: «datos visibles sin permiso: ver lo suyo»).
 */
export function filtroVisitas(usuario: UsuarioSesion): { sql: string; binds: number[] } {
  if (tiene(usuario, PermisosVisitas.Consultar)) return { sql: NO_ELIMINADA, binds: [] };
  return visitasPropias(usuario);
}

export async function auditar(
  env: Env,
  usuarioId: number | null,
  accion: string,
  entidad: string,
  entidadId: number | null,
  antes: unknown,
  despues: unknown,
  ahora: string,
) {
  return sentenciaAuditoria(env, usuarioId, accion, entidad, entidadId, antes, despues, ahora).run();
}

export function sentenciaAuditoria(
  env: Env,
  usuarioId: number | null,
  accion: string,
  entidad: string,
  entidadId: number | null,
  antes: unknown,
  despues: unknown,
  ahora: string,
) {
  return env.DB.prepare('INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, antes, despues, creado_en) VALUES (?,?,?,?,?,?,?)').bind(
    usuarioId,
    accion,
    entidad,
    entidadId,
    antes === null || antes === undefined ? null : JSON.stringify(antes),
    despues === null || despues === undefined ? null : JSON.stringify(despues),
    ahora,
  );
}
