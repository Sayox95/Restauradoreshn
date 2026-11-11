const LADO_MAX = 1600;
const CALIDAD = 0.85;

/**
 * Copia reducida de una foto (data URL JPEG) para la vista previa y la ficha PDF. Excepción E2: el
 * archivo ORIGINAL no se modifica y es el que se sube. Si el navegador no puede leer el formato
 * (p. ej. HEIC en Android), devuelve null: la foto se sube igual y el PDF indica «Imagen no disponible».
 */
export async function copiaReducida(archivo: Blob, ladoMax = LADO_MAX, calidad = CALIDAD): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', calidad);
}
