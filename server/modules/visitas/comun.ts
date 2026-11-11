import type { EstadoVisita } from '../../../shared/constantes';
import type { FotoVisita, VisitaDetalle, VisitaResumen } from '../../../shared/tipos';
import type { Visita } from '../../../shared/visitas';
import { type Ctx, filtroVisitas } from '../../plumbing/contexto';
import { noEncontrado } from '../../plumbing/http';

/**
 * Columnas de `registros` que corresponden a cada dato de la visita. La tabla viene del sistema
 * original: los módems se guardan 1/0, las listas como JSON con su resumen legible.
 */
export const COLUMNAS_DATOS = [
  'visita_num',
  'fecha_visita',
  'hora_llegada',
  'hora_salida',
  'tipo_visita',
  'codigo_energis',
  'circuito',
  'ubicacion',
  'zona',
  'sector',
  'subestacion',
  'latitud',
  'longitud',
  'gen_distribuida',
  'tipo_recon',
  'marca_reconectador',
  'modelo_recon',
  'serie_recon',
  'medio_extincion',
  'tipo_control',
  'serie_control',
  'proview_control',
  'term_sens_v',
  'mangu_sens_v',
  'term_mangu_aux',
  'mangu_aux',
  'has_modem1',
  'tipo_modem1',
  'marca_modem1',
  'modelo_modem1',
  'serie_modem1',
  'antena_modem1',
  'tipo_antena1',
  'tec_modem1',
  'has_modem2',
  'tipo_modem2',
  'marca_modem2',
  'modelo_modem2',
  'serie_modem2',
  'antena_modem2',
  'tipo_antena2',
  'tec_modem2',
  'tablero_marca',
  'tablero_campos',
  'ajuste_activo',
  'alarma_presente',
  'desc_alarma',
  'battery_test',
  'cambio_baterias',
  'tipo_bateria',
  'medicion_ac',
  'medicion_bat',
  'medicion_cargador',
  'corr_ia',
  'corr_ib',
  'corr_ic',
  'corr_in',
  'gabinete',
  'borneras',
  'obs_estado_fisico',
  'ater_rest_state',
  'ater_ctrl_state',
  'cable_tierra',
  'num_varillas',
  'ater_control',
  'ater_restaurador',
  'ater_otros',
  'tipo_cuchilla',
  'estado_cuchillas',
  'num_cuchillas',
  'pararrayos',
  'num_pararrayos',
  'tiene_potencial',
  'pot_cantidad',
  'fase_conexion',
  'pot_pararrayos',
  'pot_cuchilla',
  'ater_pot_state',
  'alimentado_acometida',
  'obs_potencial',
  'materiales_json',
  'materiales_resumen',
  'obs_materiales',
  'obs_generales',
  'personal_json',
  'personal_resumen',
  'firma_responsable',
  'firma_img',
  'num_fotos',
  'capturado_en',
] as const;

const siNo = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v) === 1 || v === 'SI' ? 'SI' : 'NO');
const json = <T>(v: unknown, porDefecto: T): T => {
  if (typeof v !== 'string' || !v) return porDefecto;
  try {
    return JSON.parse(v) as T;
  } catch {
    return porDefecto;
  }
};

/** Fila de `registros` → datos de la visita (tolera filas del sistema anterior). */
export function filaAVisita(f: Record<string, unknown>): Visita {
  const d: Record<string, unknown> = {};
  for (const c of COLUMNAS_DATOS) d[c] = f[c] ?? null;
  d.has_modem1 = siNo(f.has_modem1);
  d.has_modem2 = siNo(f.has_modem2);
  d.tablero_campos = json(f.tablero_campos, {});
  d.materiales = json(f.materiales_json, []);
  d.personal = json(f.personal_json, []);
  for (const c of ['tablero_marca', 'materiales_json', 'materiales_resumen', 'personal_json', 'personal_resumen']) delete d[c];
  return d as unknown as Visita;
}

export const SELECT_RESUMEN = `
  r.id, r.visita_num, r.fecha_visita, r.tipo_visita, r.codigo_energis, r.circuito, r.ubicacion, r.zona, r.marca_reconectador,
  r.estado, r.registrado_en, u.nombre AS registrado_por, COALESCE(r.num_fotos, 0) AS num_fotos, (r.pdf_r2_key IS NOT NULL AND r.pdf_r2_key <> '') AS tiene_pdf`;

export const resumen = (f: Record<string, unknown>): VisitaResumen => ({
  id: Number(f.id),
  visita_num: String(f.visita_num),
  fecha_visita: (f.fecha_visita as string) ?? null,
  tipo_visita: (f.tipo_visita as string) ?? null,
  codigo_energis: f.codigo_energis === null || f.codigo_energis === undefined ? null : String(f.codigo_energis),
  circuito: (f.circuito as string) ?? null,
  ubicacion: (f.ubicacion as string) ?? null,
  zona: (f.zona as string) ?? null,
  marca_reconectador: (f.marca_reconectador as string) ?? null,
  estado: (f.estado as EstadoVisita) ?? 'registrada',
  registrado_por: (f.registrado_por as string) ?? null,
  registrado_en: (f.registrado_en as string) ?? null,
  num_fotos: Number(f.num_fotos ?? 0),
  tiene_pdf: !!f.tiene_pdf,
});

/**
 * Visita (resumen, dueño y PDF), si el usuario puede verla (sin permiso de consultar: solo las suyas).
 * Nunca `r.*`: la tabla tiene más de 100 columnas y D1 no devuelve resultados tan anchos.
 */
export async function cargarVisita(ctx: Ctx, id: number) {
  const fv = filtroVisitas(ctx.usuario);
  const f = await ctx.env.DB.prepare(
    `SELECT ${SELECT_RESUMEN}, r.registrado_por AS registrado_por_id, r.pdf_r2_key
     FROM registros r LEFT JOIN usuarios u ON u.id = r.registrado_por
     WHERE r.id = ? AND ${fv.sql}`,
  )
    .bind(id, ...fv.binds)
    .first<Record<string, unknown>>();
  if (!f) throw noEncontrado('La visita');
  return f;
}

export async function detalleVisita(ctx: Ctx, id: number): Promise<VisitaDetalle> {
  const f = await cargarVisita(ctx, id);
  // Los datos van en una consulta aparte (menos de 100 columnas).
  const datos = await ctx.env.DB.prepare(`SELECT ${COLUMNAS_DATOS.join(', ')} FROM registros WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  const { results } = await ctx.env.DB.prepare(
    "SELECT orden, observacion, content_type, size, r2_key, COALESCE(created_at, '') AS v FROM registros_fotos WHERE visita_num = ? ORDER BY orden",
  )
    .bind(f.visita_num)
    .all<Record<string, unknown>>();
  const fotos: FotoVisita[] = results.map((x) => ({
    orden: Number(x.orden),
    observacion: (x.observacion as string) || null,
    content_type: String(x.content_type ?? 'image/jpeg'),
    size: Number(x.size ?? 0),
    v: `${x.size ?? 0}-${x.v}`,
  }));
  return { ...resumen(f), datos: filaAVisita(datos ?? {}), fotos };
}

/** Nombre seguro para las claves de R2 (mismo criterio que el sistema anterior). */
export const nombreSeguro = (folio: string) => folio.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
