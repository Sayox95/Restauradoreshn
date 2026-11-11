/**
 * Hoja de visita: forma de los datos (zod) y reglas puras. La usan el formulario (validación por
 * sección, porcentaje de avance) y el servidor (rechaza una visita incompleta), así las reglas se
 * escriben una sola vez.
 *
 * Las claves coinciden con las columnas de la tabla `registros` (las listas se guardan como JSON).
 */
import { z } from 'zod';
import {
  ANTENAS,
  CARGOS_PERSONAL,
  FASES_CONEXION,
  GRUPOS_AJUSTE,
  MEDIOS_EXTINCION,
  MOTIVOS_MATERIAL,
  OK_NOK,
  ON_OFF,
  RANGO_LATITUD,
  RANGO_LONGITUD,
  SI_NO,
  TECNOLOGIAS_MODEM,
  TIPOS_ANTENA,
  TIPOS_BATERIA,
  TIPOS_CUCHILLA,
  TIPOS_MODEM,
  TIPOS_VISITA,
} from './constantes';

// ── Piezas de forma ─────────────────────────────────────────────────────────────────────────
const texto = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
/** Opción de una lista cerrada; vacío = sin responder. */
const opcion = <T extends readonly [string, ...string[]]>(lista: T) =>
  z
    .union([z.enum(lista), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null));
const numero = (min = -1e9, max = 1e9) =>
  z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: 'Número no válido' });
        return z.NEVER;
      }
      return n;
    });
const entero = (max = 1000) => numero(0, max).refine((v) => v === null || Number.isInteger(v), 'Debe ser un número entero');

/** Folio de la visita: lo genera el dispositivo (HV-AAAAMMDD-HHMMSS) y permite reenviar sin duplicar. */
export const PATRON_FOLIO = /^[A-Za-z0-9_-]{3,40}$/;
export function folioNuevo(fecha = new Date()): string {
  const d = (n: number) => String(n).padStart(2, '0');
  return `HV-${fecha.getFullYear()}${d(fecha.getMonth() + 1)}${d(fecha.getDate())}-${d(fecha.getHours())}${d(fecha.getMinutes())}${d(fecha.getSeconds())}`;
}

export const materialEsquema = z.object({
  codigo: texto(40),
  desc: z.string().trim().max(200).default(''),
  unidad: texto(20),
  cant: numero(0, 1e6),
  motivo: opcion(MOTIVOS_MATERIAL),
});
export const personaEsquema = z.object({
  nombre: z.string().trim().max(100).default(''),
  cargo: opcion(CARGOS_PERSONAL),
  id: texto(40),
});

export const visitaEsquema = z.object({
  visita_num: z.string().trim().regex(PATRON_FOLIO, 'Número de visita no válido'),
  // Datos generales
  fecha_visita: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')
    .optional()
    .nullable()
    .transform((v) => v || null),
  hora_llegada: texto(5),
  hora_salida: texto(5),
  tipo_visita: opcion(TIPOS_VISITA),
  codigo_energis: texto(40),
  circuito: texto(80),
  ubicacion: texto(200),
  zona: texto(80),
  sector: texto(80),
  subestacion: texto(80),
  latitud: numero(-90, 90),
  longitud: numero(-180, 180),
  gen_distribuida: opcion(SI_NO),
  // Reconectador
  tipo_recon: texto(40),
  marca_reconectador: texto(60),
  modelo_recon: texto(60),
  serie_recon: texto(60),
  medio_extincion: opcion(MEDIOS_EXTINCION),
  tipo_control: texto(60),
  serie_control: texto(60),
  proview_control: texto(60),
  term_sens_v: opcion(SI_NO),
  mangu_sens_v: opcion(SI_NO),
  term_mangu_aux: opcion(SI_NO),
  mangu_aux: opcion(SI_NO),
  // Módems
  has_modem1: opcion(SI_NO),
  tipo_modem1: opcion(TIPOS_MODEM),
  marca_modem1: texto(60),
  modelo_modem1: texto(60),
  serie_modem1: texto(60),
  antena_modem1: opcion(ANTENAS),
  tipo_antena1: opcion(TIPOS_ANTENA),
  tec_modem1: opcion(TECNOLOGIAS_MODEM),
  has_modem2: opcion(SI_NO),
  tipo_modem2: opcion(TIPOS_MODEM),
  marca_modem2: texto(60),
  modelo_modem2: texto(60),
  serie_modem2: texto(60),
  antena_modem2: opcion(ANTENAS),
  tipo_antena2: opcion(TIPOS_ANTENA),
  tec_modem2: opcion(TECNOLOGIAS_MODEM),
  // Tablero, alarma y batería
  tablero_campos: z.record(z.string().max(80), z.enum(ON_OFF)).default({}),
  ajuste_activo: opcion(GRUPOS_AJUSTE),
  alarma_presente: opcion(SI_NO),
  desc_alarma: texto(1000),
  medicion_ac: numero(0, 1000),
  medicion_bat: numero(0, 1000),
  medicion_cargador: numero(0, 1000),
  battery_test: opcion(OK_NOK),
  cambio_baterias: opcion(SI_NO),
  tipo_bateria: opcion(TIPOS_BATERIA),
  // Corrientes
  corr_ia: numero(0, 100000),
  corr_ib: numero(0, 100000),
  corr_ic: numero(0, 100000),
  corr_in: numero(0, 100000),
  // Estado físico
  gabinete: opcion(OK_NOK),
  borneras: opcion(OK_NOK),
  obs_estado_fisico: texto(1000),
  ater_rest_state: opcion(OK_NOK),
  ater_ctrl_state: opcion(OK_NOK),
  cable_tierra: opcion(OK_NOK),
  num_varillas: entero(),
  ater_control: numero(0, 1e6),
  ater_restaurador: numero(0, 1e6),
  ater_otros: numero(0, 1e6),
  tipo_cuchilla: opcion(TIPOS_CUCHILLA),
  estado_cuchillas: opcion(OK_NOK),
  num_cuchillas: entero(),
  pararrayos: opcion(OK_NOK),
  num_pararrayos: entero(),
  tiene_potencial: opcion(SI_NO),
  pot_cantidad: entero(),
  fase_conexion: opcion(FASES_CONEXION),
  pot_pararrayos: opcion(SI_NO),
  pot_cuchilla: opcion(SI_NO),
  ater_pot_state: opcion(OK_NOK),
  alimentado_acometida: opcion(SI_NO),
  obs_potencial: texto(1000),
  // Materiales, observaciones y personal
  materiales: z.array(materialEsquema).max(50).default([]),
  obs_materiales: texto(1000),
  obs_generales: texto(2000),
  personal: z.array(personaEsquema).max(20).default([]),
  firma_responsable: texto(100),
  /** Firma dibujada (PNG en data URL). */
  firma_img: z
    .string()
    .max(400_000, 'La firma es demasiado grande')
    .refine((v) => !v || v.startsWith('data:image/png;base64,'), 'Firma no válida')
    .optional()
    .nullable()
    .transform((v) => v || null),
  /** Hora en que se guardó en el dispositivo (excepción E1: puede ser anterior al envío). */
  capturado_en: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida')
    .transform((v) => new Date(v).toISOString())
    .optional()
    .nullable()
    .transform((v) => v || null),
  /** Cantidad de fotos que acompañan la visita (se suben aparte, excepción E2). */
  num_fotos: entero(4),
});
export type VisitaEntrada = z.input<typeof visitaEsquema>;
export type Visita = z.output<typeof visitaEsquema>;

// ── Reglas puras ────────────────────────────────────────────────────────────────────────────
export const esCooper = (v: Pick<Visita, 'marca_reconectador'>) => (v.marca_reconectador ?? '').toUpperCase().includes('COOPER');
/** IB e IC no aplican a reconectadores monofásicos (tipo que empieza con «1», p. ej. 1F). */
export const esMonofasico = (v: Pick<Visita, 'tipo_recon'>) => /^1/.test(v.tipo_recon ?? '');

/** Secciones del formulario (el orden de pasos de la hoja de visita). */
export const SECCIONES = [
  'Datos generales',
  'Reconectador',
  'Módems',
  'Tablero',
  'Corrientes',
  'Estado físico',
  'Materiales',
  'Fotografías',
  'Observaciones',
  'Personal',
] as const;

export interface Requisito {
  /** Índice en SECCIONES. */
  seccion: number;
  /** Campo de la visita (o clave de la pantalla, p. ej. «fotos», «material.0.desc»). */
  campo: string;
  etiqueta: string;
  ok: boolean;
  /** Solo se exige al guardar (no al pasar de sección). */
  alGuardar?: boolean;
}

export interface ContextoReglas {
  /** Campos de tablero que corresponden a la marca elegida. */
  camposTablero: string[];
  /** ¿El catálogo ofrece opciones para este campo? Si está vacío, el campo no se exige. */
  hayOpciones: (
    campo: 'tipo_recon' | 'marca_reconectador' | 'modelo_recon' | 'tipo_control' | 'marca_modem1' | 'modelo_modem1' | 'marca_modem2' | 'modelo_modem2',
  ) => boolean;
  /** Fotos cargadas (en pantalla) o anunciadas (en el servidor). */
  fotos: number;
}

const lleno = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';

/**
 * Lista de requisitos de la visita según lo que aplica (módems, COOPER, batería, potencial…).
 * Regla general: todo lo visible es obligatorio salvo observaciones, descripción de fotos y
 * «Aterrizaje otros». Los condicionales solo se exigen cuando aplican.
 */
export function requisitosVisita(v: Visita, c: ContextoReglas): Requisito[] {
  const R: Requisito[] = [];
  const req = (seccion: number, campo: string, etiqueta: string, ok: unknown, alGuardar = false) =>
    R.push({ seccion, campo, etiqueta, ok: !!ok, ...(alGuardar ? { alGuardar } : {}) });
  const campo = (seccion: number, k: keyof Visita, etiqueta: string, alGuardar = false) => req(seccion, k, etiqueta, lleno(v[k]), alGuardar);
  const catalogo = (seccion: number, k: Parameters<ContextoReglas['hayOpciones']>[0], etiqueta: string) => {
    if (c.hayOpciones(k)) campo(seccion, k, etiqueta);
  };

  // 1 · Datos generales
  campo(0, 'fecha_visita', 'Fecha de visita');
  campo(0, 'tipo_visita', 'Tipo de visita');
  campo(0, 'hora_llegada', 'Hora de llegada');
  campo(0, 'hora_salida', 'Hora de salida', true);
  campo(0, 'codigo_energis', 'Código Energis');
  campo(0, 'gen_distribuida', 'Generación distribuida');
  if (v.latitud !== null && (v.latitud < RANGO_LATITUD[0] || v.latitud > RANGO_LATITUD[1]))
    req(0, 'latitud', `Latitud fuera de Honduras (${RANGO_LATITUD[0]} a ${RANGO_LATITUD[1]}); ¿está invertida con la longitud?`, false);
  if (v.longitud !== null && (v.longitud < RANGO_LONGITUD[0] || v.longitud > RANGO_LONGITUD[1]))
    req(0, 'longitud', `Longitud fuera de Honduras (${RANGO_LONGITUD[0]} a ${RANGO_LONGITUD[1]})`, false);

  // 2 · Reconectador
  catalogo(1, 'tipo_recon', 'Tipo de reconectador');
  catalogo(1, 'marca_reconectador', 'Marca');
  catalogo(1, 'modelo_recon', 'Modelo');
  catalogo(1, 'tipo_control', 'Tipo de control');
  campo(1, 'serie_recon', 'Serie del reconectador');
  campo(1, 'serie_control', 'Serie del control');
  campo(1, 'medio_extincion', 'Medio de extinción');
  if (esCooper(v)) {
    campo(1, 'proview_control', 'Firmware / Proview');
    campo(1, 'term_sens_v', 'Terminal p/sensores V');
    campo(1, 'mangu_sens_v', 'Manguera sensores V');
    campo(1, 'term_mangu_aux', 'Terminal manguera aux');
    campo(1, 'mangu_aux', 'Manguera auxiliar');
  }

  // 3 · Módems
  for (const n of [1, 2] as const) {
    campo(2, `has_modem${n}`, `¿Tiene módem ${n}?`);
    if (v[`has_modem${n}`] !== 'SI') continue;
    campo(2, `tipo_modem${n}`, `Tipo módem ${n}`);
    catalogo(2, `marca_modem${n}`, `Marca módem ${n}`);
    catalogo(2, `modelo_modem${n}`, `Modelo módem ${n}`);
    campo(2, `serie_modem${n}`, `Serie módem ${n}`);
    campo(2, `antena_modem${n}`, `Antena módem ${n}`);
    if (v[`antena_modem${n}`] === 'EXTERNA') campo(2, `tipo_antena${n}`, `Tipo de antena ${n}`);
    campo(2, `tec_modem${n}`, `Tecnología módem ${n}`);
  }

  // 4 · Tablero, alarma y batería
  for (const t of c.camposTablero) req(3, `tablero.${t}`, t, lleno(v.tablero_campos[t]));
  if (c.camposTablero.length) campo(3, 'ajuste_activo', 'Grupo activo');
  campo(3, 'alarma_presente', 'Alarma presente');
  if (v.alarma_presente === 'SI') campo(3, 'desc_alarma', 'Descripción de la alarma');
  campo(3, 'medicion_ac', 'Medición AC');
  campo(3, 'medicion_bat', 'Medición baterías');
  campo(3, 'medicion_cargador', 'Medición cargador');
  campo(3, 'battery_test', 'Battery test');
  campo(3, 'cambio_baterias', 'Cambio de baterías');
  if (v.cambio_baterias === 'SI') campo(3, 'tipo_bateria', 'Tipo de batería instalada');

  // 5 · Corrientes
  campo(4, 'corr_ia', 'Corriente IA');
  if (!esMonofasico(v)) {
    campo(4, 'corr_ib', 'Corriente IB');
    campo(4, 'corr_ic', 'Corriente IC');
  }
  campo(4, 'corr_in', 'Corriente IN');

  // 6 · Estado físico
  campo(5, 'gabinete', 'Gabinete');
  campo(5, 'borneras', 'Borneras');
  if (v.gabinete === 'NOK' || v.borneras === 'NOK') campo(5, 'obs_estado_fisico', 'Observación del estado físico (hay un NOK)');
  campo(5, 'ater_rest_state', 'Aterrizaje restaurador');
  campo(5, 'ater_ctrl_state', 'Aterrizaje control');
  campo(5, 'cable_tierra', 'Cable de tierra');
  campo(5, 'num_varillas', '# Varillas');
  campo(5, 'ater_control', 'Resistencia de aterrizaje del control');
  campo(5, 'ater_restaurador', 'Resistencia de aterrizaje del restaurador');
  campo(5, 'tipo_cuchilla', 'Tipo de cuchilla');
  campo(5, 'estado_cuchillas', 'Estado de cuchillas');
  campo(5, 'num_cuchillas', '# Cuchillas');
  campo(5, 'pararrayos', 'Pararrayos');
  campo(5, 'num_pararrayos', '# Pararrayos');
  campo(5, 'tiene_potencial', '¿Tiene potencial?');
  if (v.tiene_potencial === 'SI') {
    campo(5, 'pot_cantidad', 'Cantidad de potencial');
    campo(5, 'fase_conexion', 'Fase de conexión');
    campo(5, 'pot_pararrayos', 'Pararrayos del potencial');
    campo(5, 'pot_cuchilla', 'Cuchilla del potencial');
    campo(5, 'ater_pot_state', 'Aterrizaje del potencial');
  } else if (v.tiene_potencial === 'NO') {
    campo(5, 'alimentado_acometida', 'Alimentado por acometida');
  }

  // 7 · Materiales (opcionales; si se agrega uno, debe estar completo)
  v.materiales.forEach((m, i) => {
    req(6, `material.${i}.desc`, `Descripción del material #${i + 1}`, lleno(m.desc));
    req(6, `material.${i}.cant`, `Cantidad del material #${i + 1}`, (m.cant ?? 0) > 0);
  });

  // 8 · Fotografías (excepción E2: 1 obligatoria)
  req(7, 'fotos', 'Al menos 1 fotografía', c.fotos > 0);

  // 10 · Personal y firma
  if (!v.personal.length) req(9, 'personal.0.nombre', 'Al menos un técnico', false);
  v.personal.forEach((p, i) => req(9, `personal.${i}.nombre`, `Nombre del técnico #${i + 1}`, lleno(p.nombre)));
  campo(9, 'firma_responsable', 'Nombre del responsable');
  campo(9, 'firma_img', 'Firma del responsable');

  return R;
}

/** Requisitos sin cumplir (al guardar se incluyen los de `alGuardar`). */
export const faltantes = (r: Requisito[], alGuardar: boolean) => r.filter((x) => !x.ok && (alGuardar || !x.alGuardar));

/** Porcentaje de avance: requisitos cumplidos sobre los que aplican. */
export const avance = (r: Requisito[]) => (r.length ? Math.floor((r.filter((x) => x.ok).length / r.length) * 100) : 0);

/** Resúmenes legibles que se guardan junto al JSON (para consultas y CSV). */
export const resumenMateriales = (m: Visita['materiales']) =>
  m
    .filter((x) => x.desc)
    .map((x) => `${x.codigo ? `[${x.codigo}] ` : ''}${x.desc} x${x.cant ?? ''} ${x.unidad ?? ''}`.trim())
    .join(' | ');
export const resumenPersonal = (p: Visita['personal']) =>
  p
    .filter((x) => x.nombre)
    .map((x) => `${x.nombre}${x.cargo ? ` (${x.cargo})` : ''}`)
    .join(', ');
