import { type Ctx, filtroVisitas, visitasPropias } from '../../../plumbing/contexto';
import { EQUIPOS } from '../../../../shared/constantes';
import { DESDE_VISITAS, SELECT_RESUMEN, resumen } from '../comun';

/**
 * Filtros de la lista (y del CSV): texto (folio, Energis, circuito, ubicación), rango de fechas de visita,
 * equipo, zona y circuitos (varios, separados por coma). Un equipo fuera de la lista se ignora.
 */
export function filtrosVisitas(ctx: Ctx, soloMias: boolean) {
  const q = ctx.url.searchParams.get('q')?.trim();
  const desde = ctx.url.searchParams.get('desde');
  const hasta = ctx.url.searchParams.get('hasta');
  const equipo = ctx.url.searchParams.get('equipo');
  const zona = ctx.url.searchParams.get('zona')?.trim();
  const circuitos = [
    ...new Set(
      (ctx.url.searchParams.get('circuitos') ?? '')
        .split(',')
        .map((c) => c.trim().toLowerCase().slice(0, 80))
        .filter(Boolean),
    ),
  ].slice(0, 300);
  const fv = soloMias ? visitasPropias(ctx.usuario) : filtroVisitas(ctx.usuario);
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
  if (equipo && (EQUIPOS as readonly string[]).includes(equipo)) {
    condiciones.push("COALESCE(v.equipo, 'restaurador') = ?");
    binds.push(equipo);
  }
  if (zona) {
    condiciones.push('lower(r.zona) = lower(?)');
    binds.push(zona.slice(0, 80));
  }
  if (circuitos.length) {
    condiciones.push(`lower(r.circuito) IN (${circuitos.map(() => '?').join(',')})`);
    binds.push(...circuitos);
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
