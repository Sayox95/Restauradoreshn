import { type Ctx, filtroVisitas, visitasPropias } from '../../../plumbing/contexto';
import { EQUIPOS } from '../../../../shared/constantes';
import { pagina as paginaDe } from '../../../plumbing/http';
import { DESDE_VISITAS, SELECT_RESUMEN, resumen } from '../comun';

/** Valores de un parámetro separado por coma (sin repetidos, en minúsculas y acotados). */
const valoresDe = (ctx: Ctx, clave: string, max = 300) =>
  [
    ...new Set(
      (ctx.url.searchParams.get(clave) ?? '')
        .split(',')
        .map((c) => c.trim().toLowerCase().slice(0, 80))
        .filter(Boolean),
    ),
  ].slice(0, max);

/**
 * Filtros de la lista (y del CSV): texto (folio, Energis, circuito, ubicación), rango de fechas de visita
 * y, con varios valores separados por coma, equipos, zonas y circuitos. Un equipo fuera de la lista se
 * ignora.
 */
export function filtrosVisitas(ctx: Ctx, soloMias: boolean) {
  const q = ctx.url.searchParams.get('q')?.trim();
  const desde = ctx.url.searchParams.get('desde');
  const hasta = ctx.url.searchParams.get('hasta');
  const equipos = valoresDe(ctx, 'equipo').filter((e) => (EQUIPOS as readonly string[]).includes(e));
  const zonas = valoresDe(ctx, 'zona');
  const circuitos = valoresDe(ctx, 'circuitos');
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
  const enLista = (columna: string, valores: string[]) => {
    if (!valores.length) return;
    condiciones.push(`${columna} IN (${valores.map(() => '?').join(',')})`);
    binds.push(...valores);
  };
  enLista("COALESCE(v.equipo, 'restaurador')", equipos);
  enLista('lower(trim(r.zona))', zonas);
  enLista('lower(trim(r.circuito))', circuitos);
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
  return paginaDe(filas!.results.map(resumen), Number(total!.results[0]!.n), pagina, porPagina);
}
