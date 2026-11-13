import type { z } from 'zod';
import type { usuarioEditarEsquema } from '../../../../shared/esquemas';
import { type Ctx, sentenciaAuditoria } from '../../../plumbing/contexto';
import { cargarUsuario, protegerseASiMismo, sentenciasRol } from '../comun';
import { verificarDisponible } from './crear-usuario';

/**
 * Corrige los datos de una cuenta: nombre, correo, celular, perfil y cargo. El usuario no cambia
 * (es su identidad en el historial); el estado y la contraseña tienen sus propias acciones.
 */
export async function editarUsuario(ctx: Ctx, id: number, d: z.output<typeof usuarioEditarEsquema>) {
  const u = await cargarUsuario(ctx, id);
  protegerseASiMismo(ctx, id, { rol: d.rol });
  if (d.correo && d.correo !== u.correo?.toLowerCase()) await verificarDisponible(ctx, d.correo, null, id);
  const db = ctx.env.DB;
  const antes = { nombre: u.nombre, correo: u.correo, telefono: u.telefono, rol: u.rol, cargo: u.cargo };
  const despues = {
    nombre: d.nombre ?? u.nombre,
    correo: d.correo ?? u.correo,
    telefono: d.telefono,
    rol: d.rol ?? u.rol,
    cargo: d.cargo === undefined ? u.cargo : d.cargo,
  };
  await db.batch([
    db
      .prepare('UPDATE usuarios SET nombre = ?, correo = ?, telefono = ?, cargo = ?, actualizado_en = ? WHERE id = ?')
      .bind(despues.nombre, despues.correo, despues.telefono, despues.cargo, ctx.ahora, id),
    ...(d.rol && d.rol !== u.rol ? sentenciasRol(ctx, id, d.rol) : []),
    sentenciaAuditoria(ctx.env, ctx.usuario.id, 'editar', 'usuario', id, antes, despues, ctx.ahora),
  ]);
  return { id };
}
