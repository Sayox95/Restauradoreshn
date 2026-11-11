/**
 * Piezas del formulario de visita. Lineamiento UX: una sola columna al capturar; excepción E4: solo
 * los grupos de mediciones numéricas cortas van en una fila (FilaMediciones). Lo que viene del
 * catálogo se muestra bloqueado, en gris.
 */
import type { ReactNode } from 'react';
import { tonoRespuesta } from '@/common/tonos';

export function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 border-l-4 border-marca-500 bg-marca-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-marca-900">{titulo}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface CampoProps {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  /** Marca el campo como faltante (después de intentar avanzar). */
  falta?: boolean;
  ayuda?: ReactNode;
  children: ReactNode;
}

export function Campo({ id, etiqueta, requerido, falta, ayuda, children }: CampoProps) {
  return (
    <div data-campo={id} className={falta ? 'rounded-xl bg-rose-50 p-2 ring-1 ring-rose-300' : ''}>
      <label className="etiqueta" htmlFor={`v-${id}`}>
        {etiqueta}
        {requerido && <span className="text-rose-600"> *</span>}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
      {falta && <p className="mt-1 text-xs font-semibold text-rose-700">Campo obligatorio</p>}
    </div>
  );
}

type Valor = string | number | null | undefined;
const texto = (v: Valor) => (v === null || v === undefined ? '' : String(v));

export function Texto({
  id,
  valor,
  onCambio,
  bloqueado,
  placeholder,
  numerico,
  multilinea,
}: {
  id: string;
  valor: Valor;
  onCambio: (v: string) => void;
  bloqueado?: boolean;
  placeholder?: string;
  numerico?: boolean;
  multilinea?: boolean;
}) {
  const clase = `campo ${bloqueado ? 'cursor-not-allowed bg-slate-100 text-slate-600' : ''}`;
  if (multilinea)
    return (
      <textarea id={`v-${id}`} className={`${clase} min-h-[96px]`} value={texto(valor)} placeholder={placeholder} onChange={(e) => onCambio(e.target.value)} />
    );
  return (
    <input
      id={`v-${id}`}
      className={clase}
      value={texto(valor)}
      readOnly={bloqueado}
      placeholder={placeholder}
      inputMode={numerico ? 'decimal' : undefined}
      autoComplete="off"
      onChange={(e) => onCambio(e.target.value)}
    />
  );
}

export function Lista({
  id,
  valor,
  opciones,
  onCambio,
  vacia = '— Elegir —',
  deshabilitada,
}: {
  id: string;
  valor: Valor;
  opciones: readonly string[];
  onCambio: (v: string) => void;
  vacia?: string;
  deshabilitada?: boolean;
}) {
  const v = texto(valor);
  // Un valor guardado que ya no está en el catálogo se conserva visible.
  const todas = v && !opciones.includes(v) ? [v, ...opciones] : opciones;
  return (
    <select id={`v-${id}`} className="campo" value={v} disabled={deshabilitada} onChange={(e) => onCambio(e.target.value)}>
      <option value="">{vacia}</option>
      {todas.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Botones de opción única (SI/NO, OK/NOK, ON/OFF…). Tocar la opción elegida la deja sin responder. */
export function Opciones({ id, valor, opciones, onCambio }: { id: string; valor: Valor; opciones: readonly string[]; onCambio: (v: string) => void }) {
  return (
    <div id={`v-${id}`} role="radiogroup" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
      {opciones.map((o) => {
        const elegida = valor === o;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={elegida}
            onClick={() => onCambio(elegida ? '' : o)}
            className={`min-h-[48px] rounded-xl border-2 text-[15px] font-bold transition active:scale-[0.98] ${
              elegida ? tonoRespuesta(o) : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Excepción E4: mediciones numéricas cortas de la misma magnitud en una fila (máximo 4). */
export function FilaMediciones({
  campos,
  valores,
  unidad,
  faltan,
  onCambio,
}: {
  campos: { id: string; etiqueta: string; requerido?: boolean }[];
  valores: Record<string, Valor>;
  unidad: string;
  faltan: Set<string>;
  onCambio: (id: string, v: string) => void;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${campos.length}, minmax(0, 1fr))` }}>
      {campos.map((c) => (
        <div key={c.id} data-campo={c.id} className={faltan.has(c.id) ? 'rounded-xl bg-rose-50 p-1 ring-1 ring-rose-300' : ''}>
          <label className="etiqueta text-center" htmlFor={`v-${c.id}`}>
            {c.etiqueta}
            {c.requerido && <span className="text-rose-600"> *</span>}
          </label>
          <input
            id={`v-${c.id}`}
            className="campo px-2 text-center"
            inputMode="decimal"
            placeholder={unidad}
            autoComplete="off"
            value={texto(valores[c.id])}
            onChange={(e) => onCambio(c.id, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
