import type { Ctx } from '../../../plumbing/contexto';
import { COLUMNAS, type FilaUsuario, cargarUsuario, listaRoles } from '../comun';

const formato = (u: FilaUsuario) => ({
  ...u,
  roles: listaRoles(u.roles),
  debe_cambiar_password: !!u.debe_cambiar_password,
});

/** Todas las cuentas: primero las solicitudes pendientes, luego las activas. */
export async function listarUsuarios(ctx: Ctx) {
  const { results } = await ctx.env.DB.prepare(
    `SELECT ${COLUMNAS}
     FROM usuarios
     ORDER BY CASE estado WHEN 'pendiente' THEN 0 WHEN 'activa' THEN 1 WHEN 'inactiva' THEN 2 ELSE 3 END, nombre`,
  ).all<FilaUsuario>();
  return results.map(formato);
}

interface Evento {
  id: number;
  accion: string;
  antes: string | null;
  despues: string | null;
  creado_en: string;
  por: string | null;
}

/** Ficha de una cuenta: datos, sesiones abiertas, visitas registradas e historial de cambios. */
export async function verUsuario(ctx: Ctx, id: number) {
  await cargarUsuario(ctx, id);
  const db = ctx.env.DB;
  const [u, sesiones, reportes, historial] = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT ${COLUMNAS} FROM usuarios WHERE id = ?`).bind(id),
    db.prepare('SELECT COUNT(*) AS n FROM sesiones WHERE usuario_id = ? AND expira_en > ?').bind(id, ctx.ahora),
    db.prepare('SELECT COUNT(*) AS n FROM visitas_registro WHERE registrado_por = ?').bind(id),
    db
      .prepare(
        `SELECT a.id, a.accion, a.antes, a.despues, a.creado_en, p.nombre AS por
         FROM auditoria a LEFT JOIN usuarios p ON p.id = a.usuario_id
         WHERE a.entidad = 'usuario' AND a.entidad_id = ? ORDER BY a.creado_en DESC, a.id DESC LIMIT 50`,
      )
      .bind(id),
  ]);
  return {
    ...formato(u!.results[0] as unknown as FilaUsuario),
    sesiones_activas: Number(sesiones!.results[0]!.n),
    visitas_registradas: Number(reportes!.results[0]!.n),
    historial: (historial!.results as unknown as Evento[]).map((h) => ({
      ...h,
      antes: h.antes ? JSON.parse(h.antes) : null,
      despues: h.despues ? JSON.parse(h.despues) : null,
    })),
  };
}
