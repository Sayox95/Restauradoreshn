import { EXTENSION_FOTO, MAX_FOTO_BYTES, type MimeFoto } from '../../shared/constantes';
import { type Ctx } from './contexto';
import { ApiError } from './http';

/** Detecta el formato por la firma del archivo, no por lo que declare el cliente. */
export function detectarMime(bytes: Uint8Array): MimeFoto | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  const txt = (i: number, n: number) => String.fromCharCode(...bytes.slice(i, i + n));
  if (txt(0, 4) === 'RIFF' && txt(8, 4) === 'WEBP') return 'image/webp';
  // HEIC/HEIF (fotos de iPhone): caja «ftyp» con su marca.
  if (txt(4, 4) === 'ftyp') {
    const marca = txt(8, 4);
    if (['heic', 'heix', 'hevc', 'hevx'].includes(marca)) return 'image/heic';
    if (['mif1', 'msf1', 'heif'].includes(marca)) return 'image/heif';
  }
  return null;
}

export const EXT = EXTENSION_FOTO;
const MB = Math.round(MAX_FOTO_BYTES / 1024 / 1024);

/**
 * Lee una foto ORIGINAL enviada como archivo binario en el cuerpo (excepción E2: sin comprimir, una
 * solicitud por foto). Valida el tamaño y el formato por su contenido.
 */
export async function leerFoto(req: Request) {
  const largo = Number(req.headers.get('Content-Length') || 0);
  if (largo > MAX_FOTO_BYTES) throw new ApiError(413, `La fotografía supera el tamaño máximo de ${MB} MB.`);
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0) throw new ApiError(422, 'No se recibió ninguna fotografía.');
  if (buf.byteLength > MAX_FOTO_BYTES) throw new ApiError(413, `La fotografía supera el tamaño máximo de ${MB} MB.`);
  const mime = detectarMime(buf);
  if (!mime) throw new ApiError(415, 'Formato no admitido. Use JPG, PNG, WebP o HEIC.');
  return { buf, mime };
}

// Las claves de R2 con versión sirven de ETag. Con «no-cache» el navegador pregunta siempre (con
// sesión válida responde 304 sin volver a descargar): tras cerrar sesión una foto guardada en caché
// no se vuelve a mostrar.
export const etag = (clave: string) => `"${clave}"`;
export const CABECERAS_IMAGEN = {
  'Cache-Control': 'private, no-cache',
  'X-Content-Type-Options': 'nosniff',
};

export function noModificada(ctx: Ctx, clave: string) {
  return ctx.req.headers.get('If-None-Match') === etag(clave)
    ? new Response(null, {
        status: 304,
        headers: { ...CABECERAS_IMAGEN, ETag: etag(clave) },
      })
    : null;
}

export function respuestaArchivo(obj: R2ObjectBody, mime: string, clave: string, nombreDescarga?: string) {
  return new Response(obj.body, {
    headers: {
      ...CABECERAS_IMAGEN,
      'Content-Type': mime,
      ETag: etag(clave),
      ...(nombreDescarga ? { 'Content-Disposition': `inline; filename="${nombreDescarga}"` } : {}),
    },
  });
}
