import type { Ctx } from '../../../plumbing/contexto';
import { fechaLocal, zonaHoraria } from '../../../plumbing/zona';
import { filtrosVisitas } from './listar-visitas';

const COLUMNAS: [string, string][] = [
  ['visita_num', 'N° visita'],
  ['fecha_visita', 'Fecha'],
  ['tipo_visita', 'Tipo de visita'],
  ['hora_llegada', 'Llegada'],
  ['hora_salida', 'Salida'],
  ['codigo_energis', 'Energis'],
  ['circuito', 'Circuito'],
  ['ubicacion', 'Ubicación'],
  ['zona', 'Zona'],
  ['sector', 'Sector'],
  ['subestacion', 'Subestación'],
  ['latitud', 'Latitud'],
  ['longitud', 'Longitud'],
  ['tipo_recon', 'Tipo reconectador'],
  ['marca_reconectador', 'Marca'],
  ['modelo_recon', 'Modelo'],
  ['serie_recon', 'Serie reconectador'],
  ['tipo_control', 'Tipo control'],
  ['serie_control', 'Serie control'],
  ['alarma_presente', 'Alarma'],
  ['battery_test', 'Battery test'],
  ['cambio_baterias', 'Cambio baterías'],
  ['tipo_bateria', 'Batería instalada'],
  ['corr_ia', 'IA'],
  ['corr_ib', 'IB'],
  ['corr_ic', 'IC'],
  ['corr_in', 'IN'],
  ['tiene_potencial', 'Tiene potencial'],
  ['materiales_resumen', 'Materiales'],
  ['personal_resumen', 'Personal'],
  ['firma_responsable', 'Responsable'],
  ['obs_generales', 'Observaciones'],
  ['estado', 'Estado'],
  ['registrado_por', 'Registrado por'],
  ['registrado_en', 'Registrado en'],
];

const celda = (v: unknown) => {
  const t = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Visitas filtradas en CSV (con BOM para que Excel respete los acentos). */
export async function exportarVisitas(ctx: Ctx) {
  const f = filtrosVisitas(ctx, false);
  const tz = await zonaHoraria(ctx.env);
  const { results } = await ctx.env.DB.prepare(
    `SELECT ${COLUMNAS.filter(([c]) => c !== 'registrado_por')
      .map(([c]) => `r.${c}`)
      .join(', ')}, u.nombre AS registrado_por FROM registros r LEFT JOIN usuarios u ON u.id = r.registrado_por
     WHERE ${f.sql} ORDER BY r.fecha_visita DESC, r.id DESC LIMIT 10000`,
  )
    .bind(...f.binds)
    .all<Record<string, unknown>>();
  const lineas = [
    COLUMNAS.map(([, t]) => celda(t)).join(','),
    ...results.map((r) => COLUMNAS.map(([c]) => celda(c === 'registrado_en' ? fechaLocal((r[c] as string) ?? null, tz) : r[c])).join(',')),
  ];
  return new Response('﻿' + lineas.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="visitas_${ctx.ahora.slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
