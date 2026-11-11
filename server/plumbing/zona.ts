import { ZONA_HORARIA_DEFECTO } from '../../shared/constantes';
import { type Env } from './contexto';

export async function zonaHoraria(env: Env): Promise<string> {
  const r = await env.DB.prepare("SELECT valor FROM configuracion WHERE clave = 'zona_horaria'").first<{ valor: string }>();
  return r?.valor ?? ZONA_HORARIA_DEFECTO;
}

/** Clave "YYYY-MM" del mes local en la zona horaria indicada. */
export function mesLocal(iso: string, tz: string): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(iso));
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`;
}

/** "dd/mm/aaaa hh:mm" en la zona horaria indicada. */
export function fechaLocal(iso: string | null, tz: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-HN', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Últimos `n` meses locales terminando en el mes de `ahora`, en orden cronológico. */
export function ultimosMeses(ahora: string, tz: string, n: number): string[] {
  const [y, m] = mesLocal(ahora, tz).split('-').map(Number) as [number, number];
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return meses;
}

/** Clave "YYYY-MM-DD" del día local en la zona horaria indicada. */
export function diaLocal(iso: string, tz: string): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}-${p.find((x) => x.type === 'day')!.value}`;
}

/** Lunes de la semana del día "YYYY-MM-DD" (aritmética de calendario, sin zona). */
export function lunesDe(dia: string): string {
  const t = Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)));
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * 86_400_000).toISOString().slice(0, 10);
}
