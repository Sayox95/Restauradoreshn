import { ZONA_HORARIA_DEFECTO } from '@shared/constantes';

let zona = ZONA_HORARIA_DEFECTO;
export const fijarZona = (tz: string) => {
  zona = tz;
};
export const zonaActual = () => zona;

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(opciones: Intl.DateTimeFormatOptions) {
  const k = zona + JSON.stringify(opciones);
  let f = cache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat('es-HN', { timeZone: zona, ...opciones });
    cache.set(k, f);
  }
  return f;
}

/** 14/10/2026 08:30 */
export const fechaHora = (iso: string) =>
  fmt({ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
/** 14/10/2026 */
export const fecha = (iso: string) => fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
/** "octubre 2026" (mes local, para agrupar). */
export const mesDe = (iso: string) => {
  const t = fmt({ month: 'long', year: 'numeric' }).format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
/** 14 oct */
export const fechaCorta = (iso: string) => fmt({ day: 'numeric', month: 'short' }).format(new Date(iso)).replace('.', '');
/** 08:30 */
export const hora = (iso: string) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

/** Etiqueta de mes "oct 26" a partir de "2026-10". */
export function etiquetaMes(clave: string) {
  const [y, m] = clave.split('-').map(Number) as [number, number];
  return (
    new Intl.DateTimeFormat('es', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15))).replace('.', '') + ` ${String(y).slice(2)}`
  );
}

/** Valor para <input type="datetime-local"> en la zona configurada. */
export function aInputLocal(iso: string) {
  const p = Object.fromEntries(
    fmt({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

/** Convierte "YYYY-MM-DDTHH:mm" interpretado en la zona configurada a ISO UTC. */
export function desdeInputLocal(valor: string): string {
  const [f, h] = valor.split('T') as [string, string];
  const [y, mo, d] = f.split('-').map(Number) as [number, number, number];
  const [hh, mm] = h.split(':').map(Number) as [number, number];
  const supuesto = Date.UTC(y, mo - 1, d, hh, mm);
  // Desfase de la zona en ese instante (iterado dos veces para cubrir cambios de horario).
  let ts = supuesto;
  for (let i = 0; i < 2; i++) {
    const local = aInputLocal(new Date(ts).toISOString());
    const [lf, lh] = local.split('T') as [string, string];
    const [ly, lmo, ld] = lf.split('-').map(Number) as [number, number, number];
    const [lhh, lmm] = lh.split(':').map(Number) as [number, number];
    ts += supuesto - Date.UTC(ly, lmo - 1, ld, lhh, lmm);
  }
  return new Date(ts).toISOString();
}

/** Día local (zona configurada) como "YYYY-MM-DD". */
export function claveDia(ms: number) {
  const p = Object.fromEntries(
    fmt({ year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}
