/**
 * Selector de varios circuitos agrupados por subestación (el prefijo del circuito: «BER-L205» → BER).
 * Cada grupo se expande y tiene casilla para marcarlo entero; cada circuito tiene la suya. Incluye un
 * buscador porque la lista es larga. Se cierra con clic afuera o Esc.
 */
import { Check, ChevronDown, ChevronRight, Minus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

/** Subestación de un circuito: lo que va antes del primer guion (sin guion, «Otros»). */
export const subestacionDe = (circuito: string) => (circuito.includes('-') ? circuito.split('-')[0]!.trim().toUpperCase() : 'Otros');

function Casilla({ estado }: { estado: 'si' | 'no' | 'parcial' }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
        estado === 'no' ? 'border-slate-300 bg-white' : 'border-marca-600 bg-marca-600 text-white'
      }`}
      aria-hidden
    >
      {estado === 'si' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {estado === 'parcial' && <Minus className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}

export function SelectorCircuitos({ circuitos, elegidos, onCambiar }: { circuitos: string[]; elegidos: string[]; onCambiar: (c: string[]) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const caja = useRef<HTMLDivElement>(null);

  // Clic afuera o Esc: cerrar.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  const texto = buscar.trim().toLowerCase();
  const grupos = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of circuitos) if (!texto || c.toLowerCase().includes(texto)) m.set(subestacionDe(c), [...(m.get(subestacionDe(c)) ?? []), c]);
    return [...m.entries()].sort(([a], [b]) => (a === 'Otros' ? 1 : b === 'Otros' ? -1 : a.localeCompare(b, 'es')));
  }, [circuitos, texto]);

  const elegido = new Set(elegidos);
  const estadoGrupo = (lista: string[]) => {
    const n = lista.filter((c) => elegido.has(c)).length;
    return n === 0 ? 'no' : n === lista.length ? 'si' : 'parcial';
  };
  const alternar = (c: string) => onCambiar(elegido.has(c) ? elegidos.filter((x) => x !== c) : [...elegidos, c]);
  const alternarGrupo = (lista: string[]) =>
    onCambiar(estadoGrupo(lista) === 'si' ? elegidos.filter((c) => !lista.includes(c)) : [...new Set([...elegidos, ...lista])]);
  const expandir = (g: string) =>
    setExpandidos((e) => {
      const n = new Set(e);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  const resumen = !elegidos.length ? 'Todos' : elegidos.length === 1 ? elegidos[0] : `${elegidos.length} circuitos`;
  return (
    <div ref={caja} className="relative mt-1">
      <button
        type="button"
        className="campo flex items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        <span className="truncate">{resumen}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      </button>
      {abierto && (
        <div className="absolute left-0 right-0 z-30 mt-1 min-w-[16rem] rounded-xl border border-slate-200 bg-white shadow-lg lg:right-auto lg:w-72">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <input
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm font-normal text-slate-800 focus:border-marca-400 focus:outline-none"
                inputMode="search"
                placeholder="Buscar circuito"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                aria-label="Buscar circuito"
              />
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1 text-sm font-normal" role="listbox" aria-multiselectable="true" aria-label="Circuitos">
            {grupos.map(([g, lista]) => {
              // Al buscar, los grupos con coincidencias se muestran abiertos.
              const abiertoGrupo = !!texto || expandidos.has(g);
              return (
                <li key={g}>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className="flex h-10 w-9 shrink-0 items-center justify-center text-slate-500 hover:text-slate-800"
                      onClick={() => expandir(g)}
                      aria-label={`${abiertoGrupo ? 'Contraer' : 'Expandir'} ${g}`}
                      aria-expanded={abiertoGrupo}
                    >
                      {abiertoGrupo ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={estadoGrupo(lista) === 'si'}
                      className="flex min-h-[40px] flex-1 items-center gap-2.5 pr-3 text-left hover:bg-slate-50"
                      onClick={() => alternarGrupo(lista)}
                    >
                      <Casilla estado={estadoGrupo(lista)} />
                      <span className="flex-1 font-semibold text-slate-900">{g}</span>
                      <span className="text-xs text-slate-500">{lista.length}</span>
                    </button>
                  </div>
                  {abiertoGrupo && (
                    <ul>
                      {lista.map((c) => (
                        <li key={c}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={elegido.has(c)}
                            className="flex min-h-[40px] w-full items-center gap-2.5 pl-9 pr-3 text-left hover:bg-slate-50"
                            onClick={() => alternar(c)}
                          >
                            <Casilla estado={elegido.has(c) ? 'si' : 'no'} />
                            <span className="text-slate-800">{c}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
            {!grupos.length && <li className="px-3 py-3 text-slate-500">Sin circuitos con ese texto.</li>}
          </ul>
          {elegidos.length > 0 && (
            <div className="flex justify-end border-t border-slate-100 p-2">
              <button type="button" className="text-sm font-semibold text-marca-600 hover:underline" onClick={() => onCambiar([])}>
                Quitar selección
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
