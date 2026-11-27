/** Llamadas HTTP del módulo Visitas (ruta base /api/v1/visitas). */
import type {
  EdicionVisita,
  Pagina,
  VisitaDetalle,
  VisitaResumen,
} from '@shared/tipos';
import type { VisitaEntrada } from '@shared/visitas';
import { get, pedir, post, qs, subirArchivo } from '@common/http/api';

const BASE = '/api/v1/visitas';

export interface Filtros {
  q?: string;
  desde?: string;
  hasta?: string;
  equipo?: string;
  zona?: string;
  /** Varios circuitos separados por coma. */
  circuitos?: string;
  /** Página (como en TI: `page`; 25 por página). */
  page?: number;
}
/** Una página de inspecciones con la forma paginada de TI. */
export type ListaVisitas = Pagina<VisitaResumen>;

export const misVisitas = (f: Filtros = {}) =>
  get<ListaVisitas>(`${BASE}/mios${qs({ ...f })}`);
export const listarVisitas = (f: Filtros = {}) =>
  get<ListaVisitas>(`${BASE}${qs({ ...f })}`);
export const verVisita = (id: number) => get<VisitaDetalle>(`${BASE}/${id}`);
/** Lo que se envía al editar (ver editarVisitaEsquema). */
export interface EdicionEntrada {
  datos: VisitaEntrada;
  observaciones: { orden: number; observacion: string | null }[];
  motivo: string;
  version: string;
}
/** Guarda la edición (permiso Editar); responde con la inspección ya actualizada. */
export const editarVisita = (id: number, e: EdicionEntrada, clave: string) =>
  pedir<VisitaDetalle>(`${BASE}/${id}`, {
    method: 'PUT',
    json: e,
    headers: { 'Idempotency-Key': clave },
  });
/** Ediciones de la inspección, la más reciente primero (permiso Editar). */
export const historialVisita = (id: number) =>
  get<EdicionVisita[]>(`${BASE}/${id}/historial`);
export const urlExportar = ({ page: _page, ...f }: Filtros = {}) =>
  `${BASE}/exportar${qs({ ...f })}`;
export const urlFoto = (id: number, orden: number, v = '') =>
  `${BASE}/${id}/fotos/${orden}${v ? `?v=${encodeURIComponent(v)}` : ''}`;
const urlPdf = (id: number) => `${BASE}/${id}/pdf`;
/** Copia reducida de una foto (la que se muestra en pantalla; E2). */
export const urlFotoCopia = (id: number, orden: number, v = '') =>
  `${BASE}/${id}/fotos/${orden}/copia${v ? `?v=${encodeURIComponent(v)}` : ''}`;
/** Foto original como archivo (para generar la copia de pantalla de las inspecciones que no la tienen). */
export async function descargarFotoOriginal(id: number, orden: number, v = '') {
  const r = await fetch(urlFoto(id, orden, v), { credentials: 'same-origin' });
  if (!r.ok) throw new Error('No se pudo descargar la foto.');
  return r.blob();
}
/** Copia reducida como archivo (para el PDF generado al descargar; E3). */
export async function descargarFotoCopia(id: number, orden: number, v = '') {
  const r = await fetch(urlFotoCopia(id, orden, v), {
    credentials: 'same-origin',
  });
  if (!r.ok) throw new Error('No se pudo descargar la foto.');
  return r.blob();
}
/** PDF archivado de las inspecciones anteriores sin firma en la base (HV-…). */
export async function descargarPdfArchivado(id: number) {
  const r = await fetch(urlPdf(id), { credentials: 'same-origin' });
  if (!r.ok) throw new Error('No se pudo descargar el PDF.');
  return r.blob();
}
/** Copia reducida de una foto; sube antes que el original y lleva su observación. */
export const subirCopiaFoto = (
  id: number,
  orden: number,
  copia: Blob,
  observacion: string | null,
  signal?: AbortSignal,
) =>
  subirArchivo(
    `${BASE}/${id}/fotos/${orden}/copia${qs({ obs: observacion })}`,
    copia,
    { tipo: 'image/jpeg', signal },
  );
/** Elimina (oculta) una inspección con el motivo. */
export const eliminarVisita = (id: number, motivo: string) =>
  post(`${BASE}/${id}/eliminar`, { motivo });

/** Registra la visita (idempotente por número de visita: reenviarla no la duplica). */
export const registrarVisita = (v: VisitaEntrada, signal?: AbortSignal) =>
  pedir<{ visita: VisitaResumen; creada: boolean }>(BASE, {
    method: 'POST',
    json: v,
    signal,
  });
/** Sube una foto ORIGINAL, como archivo binario (excepción E2). */
/** Foto original (E2); `onProgreso` informa el avance de la subida (0 a 1). */
export const subirFoto = (
  id: number,
  orden: number,
  archivo: Blob,
  observacion: string | null,
  signal?: AbortSignal,
  onProgreso?: (fraccion: number) => void,
) =>
  subirArchivo(
    `${BASE}/${id}/fotos/${orden}${qs({ obs: observacion })}`,
    archivo,
    { signal, onProgreso },
  );
/** Archiva el PDF de la ficha (excepción E3). */
export const subirPdf = (id: number, pdf: Blob, signal?: AbortSignal) =>
  subirArchivo(`${BASE}/${id}/pdf`, pdf, { tipo: 'application/pdf', signal });
