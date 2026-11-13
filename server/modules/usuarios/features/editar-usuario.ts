import type { z } from 'zod';
import type { usuarioEditarEsquema } from '../../../../shared/esquemas';
import { type Ctx, sentenciaAuditoria } from '../../../plumbing/contexto';
import { accesoNuevo, cargarUsuario, permisosActuales, protegerAcceso, sentenciasAcceso, validarCargo } from '../comun';
import { verificarDisponible } from './crear-usuario';

/**
 * Corrige los datos de una cuenta: nombre, correo, celular, cargo, perfil y permisos. El usuario no cambia
 * (es su identidad en el historial); el estado y la contraseña tienen sus propias acciones.
 */
export async function editarUsuario(ctx: Ctx, id: number, d: z.output<typeof usuarioEditarEsquema>) {
  const u = await cargarUsuario(ctx, id);
  const acceso = accesoNuevo(d.rol, d.permisos, u.rol);
  if (acceso) await protegerAcceso(ctx, id, { permisos: acceso.permisos });
  await validarCargo(ctx, d.cargo_id, u.cargo_id);
  if (d.correo && d.correo !== u.correo?.toLowerCase()) await verificarDisponible(ctx, d.correo, null, id);
  const db = ctx.env.DB;
  // En el historial queda qué permisos tenía y cuáles le quedan (si cambió el acceso).
  const permisosAntes = acceso ? await permisosActuales(ctx, id, !!u.permisos_personalizados) : undefined;
  const antes = { nombre: u.nombre, correo: u.correo, telefono: u.telefono, cargo_id: u.cargo_id, rol: u.rol, permisos: permisosAntes };
  const despues = {
    nombre: d.nombre ?? u.nombre,
    correo: d.correo ?? u.correo,
    telefono: d.telefono,
    cargo_id: d.cargo_id === undefined ? u.cargo_id : d.cargo_id,
    rol: acceso?.rol ?? u.rol,
    permisos: acceso ? [...acceso.permisos].sort() : undefined,
  };
  await db.batch([
    db
      .prepare('UPDATE usuarios SET nombre = ?, correo = ?, telefono = ?, cargo_id = ?, actualizado_en = ? WHERE id = ?')
      .bind(despues.nombre, despues.correo, despues.telefono, despues.cargo_id, ctx.ahora, id),
    ...(acceso ? sentenciasAcceso(ctx, id, acceso) : []),
    sentenciaAuditoria(ctx.env, ctx.usuario.id, 'editar', 'usuario', id, antes, despues, ctx.ahora),
  ]);
  return { id };
}
