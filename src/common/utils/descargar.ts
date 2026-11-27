/** Descarga un archivo generado en el navegador (p. ej. el PDF de una inspección). */
export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: nombre,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
