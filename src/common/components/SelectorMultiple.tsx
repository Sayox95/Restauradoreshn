import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Lista desplegable con casillas para elegir varias opciones. Sin ninguna marcada = todas (`textoTodas`).
 * Se cierra al hacer clic afuera o con Esc.
 */
export function SelectorMultiple<T extends string>({
  etiqueta,
  opciones,
  valor,
  onChange,
  textoTodas = 'Todos',
  className = '',
}: {
  etiqueta: string;
  opciones: { valor: T; texto: string }[];
  valor: T[];
  onChange: (v: T[]) => void;
  textoTodas?: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const elegidas = opciones.filter((o) => valor.includes(o.valor));
  const resumen = !elegidas.length ? textoTodas : elegidas.length <= 2 ? elegidas.map((o) => o.texto).join(', ') : `${elegidas.length} seleccionados`;
  const alternar = (v: T) => onChange(valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v]);

  return (
    <div ref={caja} className={`relative ${className}`}>
      <span className="etiqueta" id={`${id}-etiqueta`}>
        {etiqueta}
      </span>
      <button
        type="button"
        className="campo flex h-11 items-center justify-between gap-2 py-0 text-left"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-labelledby={`${id}-etiqueta ${id}-valor`}
        onClick={() => setAbierto(!abierto)}
      >
        <span id={`${id}-valor`} className={`truncate ${elegidas.length ? 'text-slate-900' : 'text-slate-600'}`}>
          {resumen}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${abierto ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {abierto && (
        <div
          role="group"
          aria-labelledby={`${id}-etiqueta`}
          className="anim-menu absolute left-0 right-0 z-40 mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {opciones.map((o) => {
            const marcada = valor.includes(o.valor);
            return (
              <label key={o.valor} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-slate-800 hover:bg-slate-50">
                <input type="checkbox" className="sr-only" checked={marcada} onChange={() => alternar(o.valor)} />
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${marcada ? 'border-marca-600 bg-marca-600 text-white' : 'border-slate-300 bg-white'}`}
                  aria-hidden
                >
                  {marcada && <Check className="h-3.5 w-3.5" />}
                </span>
                {o.texto}
              </label>
            );
          })}
          {valor.length > 0 && (
            <button
              type="button"
              className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-marca-600 hover:bg-slate-50"
              onClick={() => onChange([])}
            >
              Quitar selección
            </button>
          )}
        </div>
      )}
    </div>
  );
}
