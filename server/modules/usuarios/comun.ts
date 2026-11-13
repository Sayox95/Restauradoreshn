import type { EstadoCuenta, Rol } from '../../../shared/constantes';
import { PermisosUsuarios, ROLES_SISTEMA, perfilDeRoles } from '../../../shared/permisos';
import type { Ctx } from '../../plumbing/contexto';
import { ApiError, noEncontrado } from '../../plumbing/http';

export interface FilaUsuario {
  id: number;
  usuario: string;
  correo: string | null;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  cargo: string | null;
  /** Códigos separados por coma (group_concat); ver listaRoles. */
  roles: string | null;
  estado: EstadoCuenta;
  debe_cambiar_password: number;
  creado_en: string;
  ultimo_ingreso_en: string | null;
}

export const COLUMNAS = `id, usuario, correo, nombre, telefono, rol, cargo, estado, debe_cambiar_password, creado_en, ultimo_ingreso_en,
  (SELECT group_concat(rol_codigo) FROM usuario_roles ur WHERE ur.usuario_id = usuarios.id) AS roles`;

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

/** Roles de una fila (group_concat) como lista ordenada. */
export const listaRoles = (roles: string | null) => (roles ? roles.split(',').sort() : []);

/**
 * Accesos de la cuenta: reemplaza sus roles (uno por módulo) y guarda el perfil de resumen en
 * usuarios.rol (solo para mostrar; el acceso sale de los permisos de los roles).
 */
export const sentenciasRoles = (ctx: Ctx, id: number, roles: string[]) => [
  ctx.env.DB.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').bind(perfilDeRoles(roles), id),
  ctx.env.DB.prepare('DELETE FROM usuario_roles WHERE usuario_id = ?').bind(id),
  ...roles.map((r) => ctx.env.DB.prepare('INSERT INTO usuario_roles (usuario_id, rol_codigo) VALUES (?,?)').bind(id, r)),
];

/** ¿Los roles incluyen gestionar usuarios? (se pregunta por el permiso, no por el rol). */
const gestionaUsuarios = (roles: string[]) => ROLES_SISTEMA.some((r) => roles.includes(r.codigo) && r.permisos.includes(PermisosUsuarios.Gestionar));

/** Nadie se deja a sí mismo sin acceso a la administración de usuarios. */
export function protegerseASiMismo(ctx: Ctx, id: number, cambio: { roles?: string[]; desactivar?: boolean }) {
  if (id !== ctx.usuario.id) return;
  if (cambio.desactivar) throw new ApiError(422, 'No puede desactivar su propia cuenta.');
  if (cambio.roles && !gestionaUsuarios(cambio.roles)) throw new ApiError(422, 'No puede quitarse a sí mismo el acceso a la gestión de usuarios.');
}
