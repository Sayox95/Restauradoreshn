import type { z } from 'zod';
import type { cambiarPasswordEsquema } from '../../../../shared/esquemas';
import { type Ctx, sentenciaAuditoria } from '../../../plumbing/contexto';
import { ApiError } from '../../../plumbing/http';
import { hashPassword, hashSesionActual, verificarPassword } from '../../../plumbing/sesion';

/**
 * Cambio de contraseña con la actual. Quita la marca de contraseña temporal y cierra las demás
 * sesiones del usuario (otros dispositivos), conservando la de este.
 */
export async function cambiarPassword(ctx: Ctx, d: z.output<typeof cambiarPasswordEsquema>) {
  const fila = await ctx.env.DB.prepare('SELECT hash_password FROM usuarios WHERE id = ?').bind(ctx.usuario.id).first<{ hash_password: string }>();
  if (!fila || !(await verificarPassword(d.actual, fila.hash_password))) throw new ApiError(422, 'La contraseña actual no es correcta.');
  const actual = await hashSesionActual(ctx.req);
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE usuarios SET hash_password = ?, debe_cambiar_password = 0, actualizado_en = ? WHERE id = ?').bind(
      await hashPassword(d.nueva),
      ctx.ahora,
      ctx.usuario.id,
    ),
    ctx.env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token_hash <> ?').bind(ctx.usuario.id, actual ?? ''),
    sentenciaAuditoria(ctx.env, ctx.usuario.id, 'cambiar_password', 'usuario', ctx.usuario.id, null, null, ctx.ahora),
  ]);
  return { ok: true };
}
