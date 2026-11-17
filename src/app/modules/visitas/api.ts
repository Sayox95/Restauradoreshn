/** Llamadas HTTP del módulo Visitas (ruta base /api/v1/visitas). */
import type { Pagina, VisitaDetalle, VisitaResumen } from '@shared/tipos';
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

export const misVisitas = (f: Filtros = {}) => get<ListaVisitas>(`${BASE}/mios${qs({ ...f })}`);
export const listarVisitas = (f: Filtros = {}) => get<ListaVisitas>(`${BASE}${qs({ ...f })}`);
export const verVisita = (id: number) => get<VisitaDetalle>(`${BASE}/${id}`);
export const urlExportar = ({ page: _page, ...f }: Filtros = {}) => `${BASE}/exportar${qs({ ...f })}`;
export const urlFoto = (id: number, orden: number, v = '') => `${BASE}/${id}/fotos/${orden}${v ? `?v=${encodeURIComponent(v)}` : ''}`;
export const urlPdf = (id: number) => `${BASE}/${id}/pdf`;
/** Copia reducida de una foto (la que se muestra en pantalla; E2). */
export const urlFotoCopia = (id: number, orden: number, v = '') => `${BASE}/${id}/fotos/${orden}/copia${v ? `?v=${encodeURIComponent(v)}` : ''}`;
/** Foto original como archivo (para generar la copia de pantalla de las inspecciones que no la tienen). */
export async function descargarFotoOriginal(id: number, orden: number, v = '') {
  const r = await fetch(urlFoto(id, orden, v), { credentials: 'same-origin' });
  if (!r.ok) throw new Error('No se pudo descargar la foto.');
  return r.blob();
}
export const subirCopiaFoto = (id: number, orden: number, copia: Blob, signal?: AbortSignal) =>
  subirArchivo(`${BASE}/${id}/fotos/${orden}/copia`, copia, { tipo: 'image/jpeg', signal });
/** Elimina (oculta) una inspección con el motivo. */
export const eliminarVisita = (id: number, motivo: string) => post(`${BASE}/${id}/eliminar`, { motivo });

/** Registra la visita (idempotente por número de visita: reenviarla no la duplica). */
export const registrarVisita = (v: VisitaEntrada, signal?: AbortSignal) =>
  pedir<{ visita: VisitaResumen; creada: boolean }>(BASE, { method: 'POST', json: v, signal });
/** Sube una foto ORIGINAL, como archivo binario (excepción E2). */
export const subirFoto = (id: number, orden: number, archivo: Blob, observacion: string | null, signal?: AbortSignal) =>
  subirArchivo(`${BASE}/${id}/fotos/${orden}${qs({ obs: observacion })}`, archivo, { signal });
/** Archiva el PDF de la ficha (excepción E3). */
export const subirPdf = (id: number, pdf: Blob, signal?: AbortSignal) => subirArchivo(`${BASE}/${id}/pdf`, pdf, { tipo: 'application/pdf', signal });
