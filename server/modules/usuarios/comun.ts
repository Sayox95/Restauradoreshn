import type { EstadoCuenta, Rol } from '../../../shared/constantes';
import { igualAlPerfil, type Permiso, PermisosUsuarios, permisosDePerfil, rolDePerfil } from '../../../shared/permisos';
import type { Ctx } from '../../plumbing/contexto';
import { ApiError, noEncontrado } from '../../plumbing/http';
import { sentenciaPermisosDe, sqlTienePermiso } from '../../plumbing/sesion';

export interface FilaUsuario {
  id: number;
  usuario: string;
  correo: string | null;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  cargo: string | null;
  estado: EstadoCuenta;
  debe_cambiar_password: number;
  permisos_personalizados: number;
  creado_en: string;
  ultimo_ingreso_en: string | null;
}

export const COLUMNAS =
  'id, usuario, correo, nombre, telefono, rol, cargo, estado, debe_cambiar_password, permisos_personalizados, creado_en, ultimo_ingreso_en';

export async function cargarUsuario(ctx: Ctx, id: number) {
  const u = await ctx.env.DB.prepare(`SELECT ${COLUMNAS} FROM usuarios WHERE id = ?`).bind(id).first<FilaUsuario>();
  if (!u) throw noEncontrado('El usuario');
  return u;
}

/** Columnas de compatibilidad que acompañan al estado. */
export const columnasEstado = (estado: EstadoCuenta) => ({ activo: estado === 'activa' ? 1 : 0, solicitud_pendiente: estado === 'pendiente' ? 1 : 0 });

export function sentenciaEstado(ctx: Ctx, id: number, estado: EstadoCuenta) {
  const c = columnasEstado(estado);
  return ctx.env.DB.prepare('UPDATE usuarios SET estado = ?, activo = ?, solicitud_pendiente = ?, actualizado_en = ? WHERE id = ?').bind(
    estado,
    c.activo,
    c.solicitud_pendiente,
    ctx.ahora,
    id,
  );
}

/**
 * Guarda el acceso: el perfil define el rol (la plantilla de permisos). Si los permisos marcados son
 * los del perfil, la cuenta usa los de su rol; si no, quedan a la medida en usuario_permisos.
 */
export function sentenciasAcceso(ctx: Ctx, id: number, acceso: { rol: Rol; permisos: string[] }) {
  const db = ctx.env.DB;
  const aMedida = !igualAlPerfil(acceso.rol, acceso.permisos);
  return [
    db.prepare('UPDATE usuarios SET rol = ?, permisos_personalizados = ? WHERE id = ?').bind(acceso.rol, aMedida ? 1 : 0, id),
    db.prepare('DELETE FROM usuario_roles WHERE usuario_id = ?').bind(id),
    db.prepare('INSERT INTO usuario_roles (usuario_id, rol_codigo) VALUES (?,?)').bind(id, rolDePerfil(acceso.rol)),
    db.prepare('DELETE FROM usuario_permisos WHERE usuario_id = ?').bind(id),
    ...(aMedida ? acceso.permisos.map((p) => db.prepare('INSERT INTO usuario_permisos (usuario_id, permiso_codigo) VALUES (?,?)').bind(id, p)) : []),
  ];
}

/** Permisos efectivos actuales de una cuenta (ordenados, para el historial). */
export async function permisosActuales(ctx: Ctx, id: number, personalizados: boolean): Promise<string[]> {
  const { results } = await sentenciaPermisosDe(ctx.env, id, personalizados).all<{ permiso_codigo: string }>();
  return results.map((r) => r.permiso_codigo).sort();
}

/**
 * Acceso que queda tras el cambio: los permisos marcados uno por uno o, si no se enviaron, los del perfil
 * (si cambió). `null` = no cambia el acceso.
 */
export function accesoNuevo(rol: Rol | undefined, permisos: Permiso[] | undefined, rolActual: Rol): { rol: Rol; permisos: string[] } | null {
  if (permisos) return { rol: rol ?? rolActual, permisos };
  if (rol && rol !== rolActual) return { rol, permisos: permisosDePerfil(rol) };
  return null;
}

/** Acceso de una cuenta nueva o recién aprobada: los permisos marcados o, si no se enviaron, los del perfil. */
export const accesoInicial = (rol: Rol, permisos: Permiso[] | undefined) => ({ rol, permisos: permisos ?? permisosDePerfil(rol) });

/**
 * Protecciones del acceso: nadie se deja a sí mismo sin gestionar usuarios ni desactiva su cuenta, y
 * siempre queda al menos una cuenta activa que gestione usuarios (nadie queda fuera de la administración).
 */
export async function protegerAcceso(ctx: Ctx, id: number, cambio: { permisos?: string[]; desactivar?: boolean }) {
  if (id === ctx.usuario.id && cambio.desactivar) throw new ApiError(422, 'No puede desactivar su propia cuenta.');
  const pierdeGestion = cambio.desactivar || (cambio.permisos && !cambio.permisos.includes(PermisosUsuarios.Gestionar));
  if (!pierdeGestion) return;
  if (id === ctx.usuario.id) throw new ApiError(422, 'No puede quitarse a sí mismo el acceso a la gestión de usuarios.');
  const otros = await ctx.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM usuarios u WHERE u.id <> ? AND u.estado = 'activa' AND ${sqlTienePermiso(PermisosUsuarios.Gestionar)}`,
  )
    .bind(id)
    .first<{ n: number }>();
  if (!otros?.n) throw new ApiError(422, 'Debe quedar al menos una cuenta activa que gestione usuarios.');
}
