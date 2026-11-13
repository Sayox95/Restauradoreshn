import type { z } from 'zod';
import type { EstadoCuenta } from '../../../../shared/constantes';
import type { aprobarCuentaEsquema } from '../../../../shared/esquemas';
import { type Ctx, sentenciaAuditoria } from '../../../plumbing/contexto';
import { ApiError } from '../../../plumbing/http';
import { accesoInicial, cargarUsuario, protegerAcceso, sentenciaEstado, sentenciasAcceso } from '../comun';

const NO_APLICA = {
  aprobar: 'Esta cuenta no tiene una solicitud pendiente.',
  rechazar: 'Solo se pueden rechazar solicitudes pendientes. Para quitar el acceso, desactive la cuenta.',
  desactivar: 'La cuenta no está activa.',
  activar: 'La cuenta no está inactiva.',
};

async function cambiarEstado(
  ctx: Ctx,
  id: number,
  accion: keyof typeof NO_APLICA,
  desde: EstadoCuenta[],
  hacia: EstadoCuenta,
  extra: D1PreparedStatement[] = [],
  datos: Record<string, unknown> = {},
) {
  const u = await cargarUsuario(ctx, id);
  if (!desde.includes(u.estado)) throw new ApiError(409, NO_APLICA[accion]);
  await ctx.env.DB.batch([
    sentenciaEstado(ctx, id, hacia),
    ...extra,
    sentenciaAuditoria(ctx.env, ctx.usuario.id, accion, 'usuario', id, { estado: u.estado }, { estado: hacia, ...datos }, ctx.ahora),
  ]);
  return { id, estado: hacia };
}

/** Aprueba una solicitud de cuenta con el perfil y los permisos que elige el administrador. */
export async function aprobarCuenta(ctx: Ctx, id: number, d: z.output<typeof aprobarCuentaEsquema>) {
  const acceso = accesoInicial(d.rol, d.permisos);
  return cambiarEstado(ctx, id, 'aprobar', ['pendiente', 'rechazada'], 'activa', sentenciasAcceso(ctx, id, acceso), {
    rol: acceso.rol,
    permisos: [...acceso.permisos].sort(),
  });
}

/** La solicitud queda rechazada (no se borra: queda el registro); la persona puede volver a solicitar. */
export const rechazarCuenta = (ctx: Ctx, id: number, motivo: string | null) => cambiarEstado(ctx, id, 'rechazar', ['pendiente'], 'rechazada', [], { motivo });

/** Quita el acceso de inmediato (cierra sus sesiones); su historial se conserva. */
export async function desactivarCuenta(ctx: Ctx, id: number, motivo: string | null) {
  await protegerAcceso(ctx, id, { desactivar: true });
  const cerrar = ctx.env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(id);
  return cambiarEstado(ctx, id, 'desactivar', ['activa'], 'inactiva', [cerrar], { motivo });
}

export const activarCuenta = (ctx: Ctx, id: number) => cambiarEstado(ctx, id, 'activar', ['inactiva'], 'activa');
