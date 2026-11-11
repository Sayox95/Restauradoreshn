/**
 * Tonos de estado de toda la app (lineamiento UX: colores suaves, desde un archivo común).
 * Cambiar un tono aquí lo cambia en etiquetas, botones de respuesta y avisos.
 */
import type { EstadoCuenta, EstadoVisita } from '@shared/constantes';

export const TONO = {
  bien: {
    etiqueta: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    caja: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    boton: 'border-emerald-300 bg-emerald-100 text-emerald-900',
    texto: 'text-emerald-700',
  },
  atencion: {
    etiqueta: 'bg-amber-50 text-amber-800 ring-amber-200',
    caja: 'border-amber-200 bg-amber-50 text-amber-900',
    boton: 'border-amber-300 bg-amber-100 text-amber-900',
    texto: 'text-amber-700',
  },
  mal: {
    etiqueta: 'bg-rose-50 text-rose-800 ring-rose-200',
    caja: 'border-rose-200 bg-rose-50 text-rose-900',
    boton: 'border-rose-300 bg-rose-100 text-rose-900',
    texto: 'text-rose-700',
  },
  neutro: {
    etiqueta: 'bg-slate-100 text-slate-700 ring-slate-200',
    caja: 'border-slate-200 bg-slate-50 text-slate-700',
    boton: 'border-sky-300 bg-sky-100 text-sky-900',
    texto: 'text-slate-600',
  },
} as const;

/**
 * Tono de la respuesta elegida en los botones de dos opciones: SI/OK/ON en verde suave, NO/NOK/OFF
 * en rojo suave; cualquier otra opción (INTERNA, 2G…) en azul suave.
 */
export function tonoRespuesta(valor: string): string {
  const v = valor.toUpperCase();
  if (['SI', 'OK', 'ON'].includes(v)) return TONO.bien.boton;
  if (['NO', 'NOK', 'OFF'].includes(v)) return TONO.mal.boton;
  return TONO.neutro.boton;
}

export const TONO_ESTADO_VISITA: Record<EstadoVisita, { etiqueta: string; punto: string }> = {
  registrada: { etiqueta: 'bg-sky-50 text-sky-800 ring-sky-200', punto: 'bg-sky-400' },
};

/** Estado de una cuenta de usuario. */
export const TONO_CUENTA: Record<EstadoCuenta, string> = {
  pendiente: TONO.atencion.etiqueta,
  activa: TONO.bien.etiqueta,
  inactiva: TONO.neutro.etiqueta,
  rechazada: TONO.mal.etiqueta,
};
