/** Convierte un data URL (la copia reducida guardada en el teléfono) en un archivo para subirlo. */
export function blobDeDataUrl(dataUrl: string): Blob {
  const [cabecera, datos = ''] = dataUrl.split(',');
  const tipo = /data:([^;]+)/.exec(cabecera ?? '')?.[1] ?? 'image/jpeg';
  const binario = atob(datos);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

/**
 * Copia reducida para mostrar en pantalla, generada del original ya descargado. `createImageBitmap` con
 * `resizeWidth` decodifica y achica fuera del hilo principal, así la pantalla no se traba con un
 * original de varios MB. Devuelve una URL local (revocarla al dejar de usarla) o null si no se puede.
 */
export async function vistaReducida(
  original: Blob,
  ancho = 800,
): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(original, {
      imageOrientation: 'from-image',
      resizeWidth: ancho,
      resizeQuality: 'medium',
    });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>(ok =>
      canvas.toBlob(ok, 'image/jpeg', 0.8),
    );
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

const LADO_MAX = 1600;
const CALIDAD = 0.85;

/**
 * Copia reducida de una foto (data URL JPEG) para la vista previa y la ficha PDF. Excepción E2: el
 * archivo ORIGINAL no se modifica y es el que se sube. Si el navegador no puede leer el formato
 * (p. ej. HEIC en Android), devuelve null: la foto se sube igual y el PDF indica «Imagen no disponible».
 */
export async function copiaReducida(
  archivo: Blob,
  ladoMax = LADO_MAX,
  calidad = CALIDAD,
): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo, {
      imageOrientation: 'from-image',
    });
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
