/** Llamadas HTTP del módulo Visitas (ruta base /api/v1/visitas). */
import type { VisitaDetalle, VisitaResumen } from '@shared/tipos';
import type { VisitaEntrada } from '@shared/visitas';
import { get, pedir, qs, subirArchivo } from '@/common/http/api';

const BASE = '/api/v1/visitas';

export interface Filtros {
  q?: string;
  desde?: string;
  hasta?: string;
  pagina?: number;
}
export interface ListaVisitas {
  filas: VisitaResumen[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export const misVisitas = (f: Filtros = {}) => get<ListaVisitas>(`${BASE}/mios${qs({ ...f })}`);
export const listarVisitas = (f: Filtros = {}) => get<ListaVisitas>(`${BASE}${qs({ ...f })}`);
export const verVisita = (id: number) => get<VisitaDetalle>(`${BASE}/${id}`);
export const urlExportar = (f: Filtros = {}) => `${BASE}/exportar${qs({ q: f.q, desde: f.desde, hasta: f.hasta })}`;
export const urlFoto = (id: number, orden: number, v = '') => `${BASE}/${id}/fotos/${orden}${v ? `?v=${encodeURIComponent(v)}` : ''}`;
export const urlPdf = (id: number) => `${BASE}/${id}/pdf`;

/** Registra la visita (idempotente por número de visita: reenviarla no la duplica). */
export const registrarVisita = (v: VisitaEntrada, signal?: AbortSignal) =>
  pedir<{ visita: VisitaResumen; creada: boolean }>(BASE, { method: 'POST', json: v, signal });
/** Sube una foto ORIGINAL, como archivo binario (excepción E2). */
export const subirFoto = (id: number, orden: number, archivo: Blob, observacion: string | null, signal?: AbortSignal) =>
  subirArchivo(`${BASE}/${id}/fotos/${orden}${qs({ obs: observacion })}`, archivo, { signal });
/** Archiva el PDF de la ficha (excepción E3). */
export const subirPdf = (id: number, pdf: Blob, signal?: AbortSignal) => subirArchivo(`${BASE}/${id}/pdf`, pdf, { tipo: 'application/pdf', signal });
