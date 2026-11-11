import type { EstadoCuenta, Rol } from '../../../shared/constantes';
import { PermisosUsuarios, ROLES_SISTEMA, rolDePerfil } from '../../../shared/permisos';
import type { Ctx } from '../../plumbing/contexto';
import { ApiError, noEncontrado } from '../../plumbing/http';

export interface FilaUsuario {
  id: number;
  usuario: string;
  correo: string | null;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  estado: EstadoCuenta;
  debe_cambiar_password: number;
  creado_en: string;
  ultimo_ingreso_en: string | null;
}

export const COLUMNAS = 'id, usuario, correo, nombre, telefono, rol, estado, debe_cambiar_password, creado_en, ultimo_ingreso_en';

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

/** El perfil elegido en pantalla define el rol del sistema (que agrupa los permisos). */
export const sentenciasRol = (ctx: Ctx, id: number, rol: Rol) => [
  ctx.env.DB.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').bind(rol, id),
  ctx.env.DB.prepare('DELETE FROM usuario_roles WHERE usuario_id = ?').bind(id),
  ctx.env.DB.prepare('INSERT INTO usuario_roles (usuario_id, rol_codigo) VALUES (?,?)').bind(id, rolDePerfil(rol)),
];

/** ¿El perfil incluye gestionar usuarios? (se pregunta por el permiso, no por el rol). */
const gestionaUsuarios = (rol: Rol) => !!ROLES_SISTEMA.find((r) => r.perfil === rol)?.permisos.includes(PermisosUsuarios.Gestionar);

/** Nadie se deja a sí mismo sin acceso a la administración de usuarios. */
export function protegerseASiMismo(ctx: Ctx, id: number, cambio: { rol?: Rol; desactivar?: boolean }) {
  if (id !== ctx.usuario.id) return;
  if (cambio.desactivar) throw new ApiError(422, 'No puede desactivar su propia cuenta.');
  if (cambio.rol && !gestionaUsuarios(cambio.rol)) throw new ApiError(422, 'No puede quitarse a sí mismo el acceso a la gestión de usuarios.');
}
