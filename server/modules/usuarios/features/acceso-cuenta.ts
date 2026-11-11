import { type Ctx, sentenciaAuditoria } from '../../../plumbing/contexto';
import { ApiError } from '../../../plumbing/http';
import { hashPassword, passwordTemporal } from '../../../plumbing/sesion';
import { cargarUsuario } from '../comun';

/**
 * Contraseña olvidada: el administrador genera una temporal (se muestra una vez) que la persona debe
 * cambiar al ingresar. Se cierran sus sesiones abiertas.
 */
export async function restablecerPassword(ctx: Ctx, id: number) {
  if (id === ctx.usuario.id) throw new ApiError(422, 'Para cambiar su propia contraseña use «Mi cuenta».');
  const u = await cargarUsuario(ctx, id);
  if (u.estado === 'pendiente' || u.estado === 'rechazada') throw new ApiError(409, 'La cuenta no está aprobada.');
  const password = passwordTemporal();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE usuarios SET hash_password = ?, debe_cambiar_password = 1, actualizado_en = ? WHERE id = ?').bind(
      await hashPassword(password),
      ctx.ahora,
      id,
    ),
    ctx.env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(id),
    sentenciaAuditoria(ctx.env, ctx.usuario.id, 'restablecer_password', 'usuario', id, null, null, ctx.ahora),
  ]);
  return { id, password_temporal: password };
}

/** Cierra la sesión de la cuenta en todos sus dispositivos (p. ej. si perdió el teléfono). */
export async function cerrarSesiones(ctx: Ctx, id: number) {
  await cargarUsuario(ctx, id);
  const [r] = await ctx.env.DB.batch([
    ctx.env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(id),
    sentenciaAuditoria(ctx.env, ctx.usuario.id, 'cerrar_sesiones', 'usuario', id, null, null, ctx.ahora),
  ]);
  return { id, cerradas: r!.meta.changes };
}
