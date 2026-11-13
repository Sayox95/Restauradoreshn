import type { z } from 'zod';
import { usuarioDeCorreo } from '../../../../shared/constantes';
import type { usuarioCrearEsquema } from '../../../../shared/esquemas';
import { type Ctx, sentenciaAuditoria } from '../../../plumbing/contexto';
import { ApiError, esErrorUnico } from '../../../plumbing/http';
import { hashPassword, passwordTemporal } from '../../../plumbing/sesion';
import { usuarioEnUso } from '../../sesion/features/solicitar-cuenta';
import { accesoInicial, sentenciasAcceso } from '../comun';

/** ¿El correo, o el usuario que sale de él, ya los tiene otra cuenta? */
export async function verificarDisponible(ctx: Ctx, correo: string, usuario: string | null, excepto = 0) {
  const otro = await ctx.env.DB.prepare('SELECT correo FROM usuarios WHERE (correo = ?1 OR usuario = ?2) AND id <> ?3 ORDER BY correo = ?1 DESC')
    .bind(correo, usuario ?? '', excepto)
    .first<{ correo: string | null }>();
  if (otro?.correo?.toLowerCase() === correo) throw new ApiError(409, 'Ya existe una cuenta con ese correo.');
  if (otro && usuario) throw usuarioEnUso(usuario);
}

/**
 * Alta desde Administración. El usuario sale del correo y el sistema genera una contraseña temporal
 * que se muestra una sola vez; la persona la cambia en su primer ingreso.
 */
export async function crearUsuario(ctx: Ctx, d: z.output<typeof usuarioCrearEsquema>) {
  const usuario = usuarioDeCorreo(d.correo);
  await verificarDisponible(ctx, d.correo, usuario);
  const password = passwordTemporal();
  try {
    const r = await ctx.env.DB.prepare(
      `INSERT INTO usuarios (usuario, correo, nombre, telefono, hash_password, rol, cargo, estado, activo, solicitud_pendiente, debe_cambiar_password, creado_en, actualizado_en)
       VALUES (?,?,?,?,?,?,?,'activa',1,0,1,?,?) RETURNING id`,
    )
      .bind(usuario, d.correo, d.nombre, d.telefono, await hashPassword(password), d.rol, d.cargo, ctx.ahora, ctx.ahora)
      .first<{ id: number }>();
    const id = r!.id;
    await ctx.env.DB.batch([
      ...sentenciasAcceso(ctx, id, accesoInicial(d.rol, d.permisos)),
      sentenciaAuditoria(ctx.env, ctx.usuario.id, 'crear', 'usuario', id, null, { usuario, ...d }, ctx.ahora),
    ]);
    return { id, usuario, password_temporal: password };
  } catch (e) {
    if (esErrorUnico(e)) throw new ApiError(409, 'Ya existe una cuenta con ese correo o usuario.');
    throw e;
  }
}
