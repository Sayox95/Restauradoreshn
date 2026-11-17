import { Check, ChevronDown, ChevronRight, Minus, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Lista desplegable con casillas para elegir varias opciones (lineamientos UTCD: «Filtros: listas
 * desplegables con casillas, nunca filas de botones»). Sin ninguna marcada = todas (`textoTodas`). Se
 * cierra al hacer clic afuera o con Esc. Es el mismo componente del proyecto de referencia, con dos
 * agregados opcionales para listas largas:
 * - `grupo`: agrupa las opciones (p. ej. circuitos por subestación); cada grupo se expande y su casilla
 *   marca o desmarca el grupo entero;
 * - `buscar`: caja para filtrar las opciones por texto.
 */
export function SelectorMultiple<T extends string>({
  etiqueta,
  opciones,
  valor,
  onChange,
  textoTodas = 'Todos',
  className = '',
  grupo,
  buscar = false,
}: {
  etiqueta: string;
  opciones: { valor: T; texto: string }[];
  valor: T[];
  onChange: (v: T[]) => void;
  textoTodas?: string;
  className?: string;
  grupo?: (o: { valor: T; texto: string }) => string;
  buscar?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) =>
      !caja.current?.contains(e.target as Node) && setAbierto(false);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const elegidas = opciones.filter(o => valor.includes(o.valor));
  const resumen = !elegidas.length
    ? textoTodas
    : elegidas.length <= 2
      ? elegidas.map(o => o.texto).join(', ')
      : `${elegidas.length} seleccionados`;
  const alternar = (v: T) =>
    onChange(valor.includes(v) ? valor.filter(x => x !== v) : [...valor, v]);

  const filtro = texto.trim().toLowerCase();
  const visibles = filtro
    ? opciones.filter(o => o.texto.toLowerCase().includes(filtro))
    : opciones;
  const grupos = useMemo(() => {
    if (!grupo) return null;
    const m = new Map<string, { valor: T; texto: string }[]>();
    for (const o of visibles) m.set(grupo(o), [...(m.get(grupo(o)) ?? []), o]);
    return [...m.entries()];
  }, [grupo, visibles]);
  const estadoGrupo = (lista: { valor: T }[]) => {
    const n = lista.filter(o => valor.includes(o.valor)).length;
    return n === 0 ? 'no' : n === lista.length ? 'si' : 'parcial';
  };
  const alternarGrupo = (lista: { valor: T }[]) => {
    const vs = lista.map(o => o.valor);
    onChange(
      estadoGrupo(lista) === 'si'
        ? valor.filter(v => !vs.includes(v))
        : [...new Set([...valor, ...vs])],
    );
  };
  const expandir = (g: string) =>
    setExpandidos(e => {
      const n = new Set(e);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  const opcion = (o: { valor: T; texto: string }, sangria = false) => {
    const marcada = valor.includes(o.valor);
    return (
      <label
        key={o.valor}
        className={`flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-slate-800 hover:bg-slate-50 ${sangria ? 'pl-9' : ''}`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={marcada}
          onChange={() => alternar(o.valor)}
        />
        <Casilla estado={marcada ? 'si' : 'no'} />
        {o.texto}
      </label>
    );
  };

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
        <span
          id={`${id}-valor`}
          className={`truncate ${elegidas.length ? 'text-slate-900' : 'text-slate-600'}`}
        >
          {resumen}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${abierto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {abierto && (
        <div
          role="group"
          aria-labelledby={`${id}-etiqueta`}
          className="anim-menu absolute left-0 right-0 z-40 mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {buscar && (
            <div className="relative mb-1 p-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm text-slate-800 focus:border-marca-400 focus:outline-none"
                inputMode="search"
                placeholder="Buscar"
                value={texto}
                onChange={e => setTexto(e.target.value)}
                aria-label={`Buscar en ${etiqueta}`}
              />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto">
            {grupos
              ? grupos.map(([g, lista]) => {
                  // Al buscar, los grupos con coincidencias se muestran abiertos.
                  const abiertoGrupo = !!filtro || expandidos.has(g);
                  return (
                    <div key={g}>
                      <div className="flex items-center">
                        <button
                          type="button"
                          className="flex h-10 w-7 shrink-0 items-center justify-center text-slate-500 hover:text-slate-800"
                          onClick={() => expandir(g)}
                          aria-label={`${abiertoGrupo ? 'Contraer' : 'Expandir'} ${g}`}
                          aria-expanded={abiertoGrupo}
                        >
                          {abiertoGrupo ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <label className="flex min-h-[40px] flex-1 cursor-pointer items-center gap-2.5 rounded-lg pr-2.5 text-sm hover:bg-slate-50">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={estadoGrupo(lista) === 'si'}
                            onChange={() => alternarGrupo(lista)}
                            aria-label={`Todo ${g}`}
                          />
                          <Casilla estado={estadoGrupo(lista)} />
                          <span className="flex-1 font-semibold text-slate-900">
                            {g}
                          </span>
                          <span className="text-xs text-slate-500">
                            {lista.length}
                          </span>
                        </label>
                      </div>
                      {abiertoGrupo && lista.map(o => opcion(o, true))}
                    </div>
                  );
                })
              : visibles.map(o => opcion(o))}
            {!visibles.length && (
              <p className="px-2.5 py-2 text-sm text-slate-500">
                Sin coincidencias.
              </p>
            )}
          </div>
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

function Casilla({ estado }: { estado: 'si' | 'no' | 'parcial' }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${estado === 'no' ? 'border-slate-300 bg-white' : 'border-marca-600 bg-marca-600 text-white'}`}
      aria-hidden
    >
      {estado === 'si' && <Check className="h-3.5 w-3.5" />}
      {estado === 'parcial' && <Minus className="h-3.5 w-3.5" />}
    </span>
  );
}
