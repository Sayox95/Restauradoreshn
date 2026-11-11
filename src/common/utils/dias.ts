/** Días de calendario "YYYY-MM-DD": aritmética en UTC, que no depende de la zona horaria. */
export const DIA_MS = 86_400_000;

export const aUtc = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
export const deUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function* recorrerDias(desde: string, hasta: string) {
  for (let t = aUtc(desde); t <= aUtc(hasta); t += DIA_MS) yield deUtc(t);
}

/** Lunes de la semana del día. */
export const lunesDe = (k: string) => deUtc(aUtc(k) - ((new Date(aUtc(k)).getUTCDay() + 6) % 7) * DIA_MS);

/** "martes, 20 de octubre" */
export const nombreDia = (k: string) =>
  new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(aUtc(k)));
/** "20 oct" */
export const diaCorto = (k: string) =>
  new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(aUtc(k))).replace('.', '');
/** "Octubre de 2026" a partir de "2026-10" */
export const nombreMes = (m: string) => {
  const t = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(aUtc(`${m}-01`)));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
