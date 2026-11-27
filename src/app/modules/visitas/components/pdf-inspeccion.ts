/**
 * PDF de una inspección registrada, generado al descargarlo (E3): datos y firma de la base y las
 * copias reducidas de las fotos. Así el PDF siempre coincide con la base y no depende de un archivo
 * que pudo no subirse. Las inspecciones anteriores sin firma en la base (HV-…) entregan su PDF
 * archivado, que es el único que conserva la firma.
 */
import type { FotoVisita, VisitaDetalle } from '@shared/tipos';
import { copiaReducida } from '@common/utils/imagen';
import {
  descargarFotoCopia,
  descargarFotoOriginal,
  descargarPdfArchivado,
} from '../api';
import { generarFicha } from './ficha-pdf';

/** Lo que decide de dónde sale el PDF (sin red, para poder probarlo). */
export const usaPdfArchivado = (
  d: Pick<VisitaDetalle, 'tiene_pdf' | 'datos'>,
) => d.tiene_pdf && !d.datos.firma_img;

const dataUrlDe = (b: Blob) =>
  new Promise<string>((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(r.error);
    r.readAsDataURL(b);
  });

/**
 * Imagen de la foto para el PDF: la copia del servidor; si no hay o falla, se deriva del original.
 * Sin ninguna, vacía: el PDF conserva el lugar con «Imagen no disponible».
 */
async function imagenDeFoto(id: number, f: FotoVisita): Promise<string> {
  if (f.copia)
    try {
      return await dataUrlDe(await descargarFotoCopia(id, f.orden, f.v));
    } catch {
      // Se intenta con el original.
    }
  if (f.original)
    try {
      const blob = await descargarFotoOriginal(id, f.orden, f.v);
      return (await copiaReducida(blob)) ?? '';
    } catch {
      // Sin imagen.
    }
  return '';
}

export async function pdfDeInspeccion(d: VisitaDetalle): Promise<Blob> {
  if (usaPdfArchivado(d)) return descargarPdfArchivado(d.id);
  // Una por una: en teléfonos modestos evita tener todas las imágenes a la vez en memoria.
  const fotos = [];
  for (const f of d.fotos)
    fotos.push({
      base64: await imagenDeFoto(d.id, f),
      observacion: f.observacion,
    });
  return generarFicha(d.datos, fotos);
}
