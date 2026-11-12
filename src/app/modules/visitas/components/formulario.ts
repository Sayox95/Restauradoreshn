/**
 * Estado del formulario de visita y su conversión a una visita validada con las mismas reglas que el
 * servidor (shared/visitas.ts).
 */
import type { CatalogosVisita } from '@shared/tipos';
import { type ContextoReglas, type Visita, type VisitaEntrada, folioNuevo, requisitosVisita, visitaEsquema } from '@shared/visitas';
import { opcionesDe } from './catalogos';

export interface MaterialB {
  /** Código del catálogo, «OTRO» (se escribe a mano) o vacío (sin elegir). */
  eleccion?: string;
  codigo: string;
  desc: string;
  unidad: string;
  cant: string;
  motivo: string;
}
export interface PersonaB {
  /** Nombre del catálogo, o «OTRO» para escribirlo a mano. */
  eleccion: string;
  nombre: string;
  cargo: string;
  id: string;
}

/** Todo lo del formulario, como lo escribe la persona (textos). */
export type Borrador = Record<string, string> & {
  tablero_campos: Record<string, 'ON' | 'OFF'>;
  materiales: MaterialB[];
  personal: PersonaB[];
  firma_img: string | null;
  /** El nombre del responsable lo escribió la persona (deja de copiarse del técnico #1). */
  responsable_a_mano: boolean;
};

/** Cambios a aplicar al borrador (textos, listas o la firma). */
export type Cambios = { [K in keyof Borrador]?: Borrador[K] } | Record<string, unknown>;

const hoy = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const horaActual = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function borradorNuevo(): Borrador {
  const ahora = new Date();
  return {
    visita_num: folioNuevo(ahora),
    fecha_visita: hoy(ahora),
    hora_llegada: horaActual(ahora),
    tablero_campos: {},
    materiales: [],
    personal: [{ eleccion: '', nombre: '', cargo: '', id: '' }],
    firma_img: null,
    responsable_a_mano: false,
  } as unknown as Borrador;
}

/** ¿La persona ya escribió algo? (más allá de lo que se llena solo al abrir). */
export function tieneDatos(b: Borrador, fotos: number) {
  const auto = new Set(['visita_num', 'fecha_visita', 'hora_llegada', 'tablero_campos', 'materiales', 'personal', 'firma_img', 'responsable_a_mano']);
  return (
    fotos > 0 ||
    !!b.firma_img ||
    b.materiales.length > 0 ||
    b.personal.some((p) => p.nombre || p.eleccion) ||
    Object.keys(b.tablero_campos).length > 0 ||
    Object.entries(b).some(([k, v]) => !auto.has(k) && typeof v === 'string' && v.trim() !== '')
  );
}

/** Borrador → datos que se envían (los campos de pantalla se traducen al esquema compartido). */
export function aEntrada(b: Borrador, numFotos: number): VisitaEntrada {
  const { tablero_campos, materiales, personal, firma_img, responsable_a_mano: _r, ...resto } = b;
  return {
    ...resto,
    visita_num: b.visita_num,
    tablero_campos,
    materiales: materiales.map((m) => ({ codigo: m.codigo, desc: m.desc, unidad: m.unidad, cant: m.cant, motivo: (m.motivo || null) as never })),
    personal: personal.map((p) => ({ nombre: p.nombre, cargo: (p.cargo || null) as never, id: p.id })),
    firma_img,
    num_fotos: numFotos,
  } as VisitaEntrada;
}

/**
 * Visita validada para calcular avance y requisitos. Un valor a medio escribir (p. ej. «12,») no
 * debe romper el cálculo: los campos que no pasan la forma se toman como vacíos.
 */
export function aVisita(e: VisitaEntrada): Visita {
  let datos: Record<string, unknown> = { ...e };
  for (let i = 0; i < 20; i++) {
    const r = visitaEsquema.safeParse(datos);
    if (r.success) return r.data;
    datos = { ...datos };
    for (const issue of r.error.issues) {
      const [campo, indice, sub] = issue.path;
      if (campo === 'visita_num') datos.visita_num = folioNuevo();
      else if (typeof indice === 'number' && typeof sub === 'string') {
        const lista = [...(datos[campo as string] as Record<string, unknown>[])];
        lista[indice] = { ...lista[indice], [sub]: null };
        datos[campo as string] = lista;
      } else datos[campo as string] = null;
    }
  }
  return visitaEsquema.parse({ visita_num: folioNuevo() });
}

/** Contexto de las reglas según los catálogos y lo elegido. */
export function contexto(v: Visita, c: CatalogosVisita | undefined, fotos: number): ContextoReglas {
  const o = opcionesDe(c, v.marca_reconectador);
  return {
    camposTablero: o.camposTablero,
    fotos,
    hayOpciones: (campo) => {
      if (!c) return false;
      if (campo === 'tipo_recon') return c.tipos.length > 0;
      if (campo === 'marca_reconectador') return c.marcas.length > 0;
      if (campo === 'modelo_recon') return (o.marca?.modelos.length ?? 0) > 0;
      if (campo === 'tipo_control') return (o.marca?.controles.length ?? 0) > 0;
      if (campo === 'marca_modem1' || campo === 'marca_modem2') return c.modems.length > 0;
      const marcaModem = campo === 'modelo_modem1' ? v.marca_modem1 : v.marca_modem2;
      return (o.modem(marcaModem)?.modelos.length ?? 0) > 0;
    },
  };
}

export const requisitos = (b: Borrador, c: CatalogosVisita | undefined, fotos: number) => {
  const v = aVisita(aEntrada(b, fotos));
  return requisitosVisita(v, contexto(v, c, fotos));
};
