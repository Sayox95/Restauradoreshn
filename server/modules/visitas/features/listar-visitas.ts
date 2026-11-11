import { type Ctx, filtroVisitas } from '../../../plumbing/contexto';
import { DESDE_VISITAS, SELECT_RESUMEN, resumen } from '../comun';

/** Filtros de la lista: texto (folio, Energis, circuito, ubicación) y rango de fechas de visita. */
export function filtrosVisitas(ctx: Ctx, soloMias: boolean) {
  const q = ctx.url.searchParams.get('q')?.trim();
  const desde = ctx.url.searchParams.get('desde');
  const hasta = ctx.url.searchParams.get('hasta');
  const fv = soloMias ? { sql: 'v.registrado_por = ?', binds: [ctx.usuario.id] as unknown[] } : filtroVisitas(ctx.usuario);
  const condiciones = [fv.sql];
  const binds: unknown[] = [...fv.binds];
  if (q) {
    condiciones.push('(r.visita_num LIKE ? OR CAST(r.codigo_energis AS TEXT) LIKE ? OR r.circuito LIKE ? OR r.ubicacion LIKE ?)');
    binds.push(...Array(4).fill(`%${q}%`));
  }
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  if (desde && fecha.test(desde)) {
    condiciones.push('r.fecha_visita >= ?');
    binds.push(desde);
  }
  if (hasta && fecha.test(hasta)) {
    condiciones.push('r.fecha_visita <= ?');
    binds.push(hasta);
  }
  return { sql: condiciones.join(' AND '), binds };
}

/** Lista paginada, de la más reciente a la más antigua. */
export async function listarVisitas(ctx: Ctx, pagina: number, porPagina: number, offset: number, soloMias = false) {
  const f = filtrosVisitas(ctx, soloMias);
  const db = ctx.env.DB;
  const [filas, total] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT ${SELECT_RESUMEN} FROM ${DESDE_VISITAS}
         WHERE ${f.sql} ORDER BY r.fecha_visita DESC, r.id DESC LIMIT ? OFFSET ?`,
      )
      .bind(...f.binds, porPagina, offset),
    db.prepare(`SELECT COUNT(*) AS n FROM ${DESDE_VISITAS} WHERE ${f.sql}`).bind(...f.binds),
  ]);
  return { filas: filas!.results.map(resumen), total: Number(total!.results[0]!.n), pagina, por_pagina: porPagina };
}
