/**
 * Edición de una inspección registrada: qué cambió (campo, antes y después) y en qué sección. Lo usan
 * la app (marca «Modificada», resumen antes de guardar) y el servidor (validación y auditoría), así el
 * resumen que ve la persona es el mismo que queda en el historial.
 */
import { type NombreSeccion, SECCIONES, type Visita } from './visitas';

/** Campos que se pueden editar, con su sección y su nombre en pantalla. */
export const CAMPOS_EDITABLES: Partial<
  Record<keyof Visita, [NombreSeccion, string]>
> = {
  fecha_visita: ['Datos generales', 'Fecha de visita'],
  tipo_visita: ['Datos generales', 'Tipo de visita'],
  hora_llegada: ['Datos generales', 'Hora de llegada'],
  hora_salida: ['Datos generales', 'Hora de salida'],
  codigo_energis: ['Datos generales', 'Código Energis'],
  circuito: ['Datos generales', 'Circuito'],
  ubicacion: ['Datos generales', 'Ubicación'],
  zona: ['Datos generales', 'Zona'],
  sector: ['Datos generales', 'Sector'],
  subestacion: ['Datos generales', 'Subestación'],
  latitud: ['Datos generales', 'Latitud'],
  longitud: ['Datos generales', 'Longitud'],
  gen_distribuida: ['Datos generales', 'Generación distribuida'],
  tipo_recon: ['Reconectador', 'Tipo de reconectador'],
  marca_reconectador: ['Reconectador', 'Marca'],
  modelo_recon: ['Reconectador', 'Modelo'],
  serie_recon: ['Reconectador', 'Serie del reconectador'],
  medio_extincion: ['Reconectador', 'Medio de extinción'],
  tipo_control: ['Reconectador', 'Tipo de control'],
  serie_control: ['Reconectador', 'Serie del control'],
  proview_control: ['Reconectador', 'Firmware / Proview'],
  term_sens_v: ['Reconectador', 'Terminal p/sensores V'],
  mangu_sens_v: ['Reconectador', 'Manguera sensores V'],
  term_mangu_aux: ['Reconectador', 'Terminal manguera aux'],
  mangu_aux: ['Reconectador', 'Manguera auxiliar'],
  has_modem1: ['Módems', '¿Tiene módem 1?'],
  tipo_modem1: ['Módems', 'Tipo módem 1'],
  marca_modem1: ['Módems', 'Marca módem 1'],
  modelo_modem1: ['Módems', 'Modelo módem 1'],
  serie_modem1: ['Módems', 'Serie módem 1'],
  antena_modem1: ['Módems', 'Antena módem 1'],
  tipo_antena1: ['Módems', 'Tipo de antena 1'],
  tec_modem1: ['Módems', 'Tecnología módem 1'],
  has_modem2: ['Módems', '¿Tiene módem 2?'],
  tipo_modem2: ['Módems', 'Tipo módem 2'],
  marca_modem2: ['Módems', 'Marca módem 2'],
  modelo_modem2: ['Módems', 'Modelo módem 2'],
  serie_modem2: ['Módems', 'Serie módem 2'],
  antena_modem2: ['Módems', 'Antena módem 2'],
  tipo_antena2: ['Módems', 'Tipo de antena 2'],
  tec_modem2: ['Módems', 'Tecnología módem 2'],
  ajuste_activo: ['Tablero y mediciones', 'Grupo activo'],
  alarma_presente: ['Tablero y mediciones', 'Alarma presente'],
  desc_alarma: ['Tablero y mediciones', 'Descripción de la alarma'],
  medicion_ac: ['Tablero y mediciones', 'Medición AC'],
  medicion_bat: ['Tablero y mediciones', 'Medición baterías'],
  medicion_cargador: ['Tablero y mediciones', 'Medición cargador'],
  battery_test: ['Tablero y mediciones', 'Battery test'],
  cambio_baterias: ['Tablero y mediciones', 'Cambio de baterías'],
  tipo_bateria: ['Tablero y mediciones', 'Tipo de batería instalada'],
  corr_ia: ['Tablero y mediciones', 'Corriente IA'],
  corr_ib: ['Tablero y mediciones', 'Corriente IB'],
  corr_ic: ['Tablero y mediciones', 'Corriente IC'],
  corr_in: ['Tablero y mediciones', 'Corriente IN'],
  gabinete: ['Estado físico', 'Gabinete'],
  borneras: ['Estado físico', 'Borneras'],
  obs_estado_fisico: ['Estado físico', 'Observación del estado físico'],
  ater_rest_state: ['Estado físico', 'Aterrizaje restaurador'],
  ater_ctrl_state: ['Estado físico', 'Aterrizaje control'],
  cable_tierra: ['Estado físico', 'Cable de tierra'],
  num_varillas: ['Estado físico', '# Varillas'],
  ater_control: ['Estado físico', 'Resistencia de aterrizaje del control'],
  ater_restaurador: [
    'Estado físico',
    'Resistencia de aterrizaje del restaurador',
  ],
  ater_otros: ['Estado físico', 'Aterrizaje otros'],
  tipo_cuchilla: ['Estado físico', 'Tipo de cuchilla'],
  estado_cuchillas: ['Estado físico', 'Estado de cuchillas'],
  num_cuchillas: ['Estado físico', '# Cuchillas'],
  pararrayos: ['Estado físico', 'Pararrayos'],
  num_pararrayos: ['Estado físico', '# Pararrayos'],
  tiene_potencial: ['Estado físico', '¿Tiene potencial?'],
  pot_cantidad: ['Estado físico', 'Cantidad de potencial'],
  fase_conexion: ['Estado físico', 'Fase de conexión'],
  pot_pararrayos: ['Estado físico', 'Pararrayos del potencial'],
  pot_cuchilla: ['Estado físico', 'Cuchilla del potencial'],
  ater_pot_state: ['Estado físico', 'Aterrizaje del potencial'],
  alimentado_acometida: ['Estado físico', 'Alimentado por acometida'],
  obs_potencial: ['Estado físico', 'Observación del potencial'],
  materiales: ['Materiales', 'Materiales'],
  obs_materiales: ['Materiales', 'Observación de materiales'],
  obs_generales: ['Observaciones', 'Observaciones generales'],
  personal: ['Personal', 'Personal de la inspección'],
  firma_responsable: ['Personal', 'Nombre del responsable'],
};

export interface Cambio {
  /** Campo de la visita (o «tablero.<campo>», «foto.<orden>»). */
  campo: string;
  /** Índice en SECCIONES. */
  seccion: number;
  etiqueta: string;
  antes: string;
  despues: string;
}

/** Valor en palabras para comparar y mostrar («—» si está vacío). */
const texto = (v: unknown) => {
  if (v === null || v === undefined) return '';
  return String(v).trim();
};
const mostrar = (t: string) => t || '—';

/** Sin valor (lo que aparece al agregar o quitar un elemento de una lista). */
export const SIN_VALOR = '—';

/**
 * Cambios de una lista (materiales, personal) elemento por elemento: quitado, agregado o con otro
 * detalle (p. ej. la cantidad). Así el historial dice qué se quitó, no dos textos corridos.
 */
function cambiosLista<T>(
  antes: T[],
  despues: T[],
  base: string,
  seccion: number,
  e: {
    clave: (x: T) => string;
    nombre: (x: T) => string;
    detalle: (x: T) => string;
    quitado: string;
    agregado: string;
  },
): Cambio[] {
  // Clave con su número de aparición: dos elementos iguales no se confunden.
  const indexar = (l: T[]) => {
    const vistos = new Map<string, number>();
    return new Map(
      l.map(x => {
        const k = e.clave(x);
        const n = (vistos.get(k) ?? 0) + 1;
        vistos.set(k, n);
        return [`${k}#${n}`, x] as const;
      }),
    );
  };
  const a = indexar(antes);
  const d = indexar(despues);
  const completo = (x: T) =>
    [e.nombre(x), e.detalle(x)].filter(Boolean).join(' · ');
  const lista: Cambio[] = [];
  const cambio = (etiqueta: string, antes: string, despues: string) =>
    lista.push({
      campo: `${base}.${lista.length + 1}`,
      seccion,
      etiqueta,
      antes: mostrar(antes),
      despues: mostrar(despues),
    });
  for (const [k, x] of a) {
    const y = d.get(k);
    if (!y) cambio(e.quitado, completo(x), '');
    else if (e.detalle(x) !== e.detalle(y))
      cambio(e.nombre(x), e.detalle(x), e.detalle(y));
  }
  for (const [k, y] of d) if (!a.has(k)) cambio(e.agregado, '', completo(y));
  return lista;
}

const cambiosMateriales = (a: Visita, d: Visita, seccion: number) =>
  cambiosLista(a.materiales ?? [], d.materiales ?? [], 'materiales', seccion, {
    clave: m => (texto(m.codigo) || texto(m.desc)).toUpperCase(),
    nombre: m => texto(m.desc),
    detalle: m =>
      [`${texto(m.cant)} ${texto(m.unidad)}`.trim(), texto(m.motivo)]
        .filter(Boolean)
        .join(' · '),
    quitado: 'Material quitado',
    agregado: 'Material agregado',
  });

const cambiosPersonal = (a: Visita, d: Visita, seccion: number) =>
  cambiosLista(a.personal ?? [], d.personal ?? [], 'personal', seccion, {
    clave: p => (p.usuario_id ? `u${p.usuario_id}` : texto(p.nombre)),
    nombre: p => texto(p.nombre),
    detalle: p => texto(p.cargo),
    quitado: 'Técnico quitado',
    agregado: 'Técnico agregado',
  });

/** Valor comparable de un campo. */
const valorDe = (v: Visita, campo: keyof Visita) => texto(v[campo]);

/** Observación de cada foto por su orden. */
export type ObservacionesFotos = Record<number, string | null>;

/**
 * Lo que cambió entre la inspección guardada y la editada, en el orden de las secciones. La firma, el
 * folio y la fecha de captura no se editan; las fotos solo cambian su observación.
 */
export function cambiosVisita(
  antes: Visita,
  despues: Visita,
  obsAntes: ObservacionesFotos = {},
  obsDespues: ObservacionesFotos = {},
): Cambio[] {
  const lista: Cambio[] = [];
  const S = (n: NombreSeccion) => SECCIONES.indexOf(n);
  for (const [campo, [seccion, etiqueta]] of Object.entries(
    CAMPOS_EDITABLES,
  ) as [keyof Visita, [NombreSeccion, string]][]) {
    if (campo === 'materiales') {
      lista.push(...cambiosMateriales(antes, despues, S(seccion)));
      continue;
    }
    if (campo === 'personal') {
      lista.push(...cambiosPersonal(antes, despues, S(seccion)));
      continue;
    }
    const a = valorDe(antes, campo);
    const d = valorDe(despues, campo);
    if (a !== d)
      lista.push({
        campo,
        seccion: S(seccion),
        etiqueta,
        antes: mostrar(a),
        despues: mostrar(d),
      });
  }
  // Campos del tablero (dependen de la marca): al final de su sección.
  const tA = antes.tablero_campos ?? {};
  const tD = despues.tablero_campos ?? {};
  for (const k of [...new Set([...Object.keys(tA), ...Object.keys(tD)])]) {
    const a = texto(tA[k]);
    const d = texto(tD[k]);
    if (a !== d)
      lista.push({
        campo: `tablero.${k}`,
        seccion: S('Tablero y mediciones'),
        etiqueta: `Tablero: ${k}`,
        antes: mostrar(a),
        despues: mostrar(d),
      });
  }
  for (const orden of [
    ...new Set([...Object.keys(obsAntes), ...Object.keys(obsDespues)]),
  ]
    .map(Number)
    .sort((x, y) => x - y)) {
    const a = texto(obsAntes[orden]);
    const d = texto(obsDespues[orden]);
    if (a !== d)
      lista.push({
        campo: `foto.${orden}`,
        seccion: S('Fotografías'),
        etiqueta: `Observación de la foto ${orden}`,
        antes: mostrar(a),
        despues: mostrar(d),
      });
  }
  return lista.sort((x, y) => x.seccion - y.seccion);
}

/** Secciones con algún cambio. */
export const seccionesConCambios = (c: Cambio[]) =>
  new Set(c.map(x => x.seccion));
