import { CARGOS_PERSONAL, ELEMENTOS_MARCA } from '@shared/constantes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Loader2, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Hoja } from '@/common/components/Hoja';
import { useAvisos } from '@/common/components/Toast';
import { CajaError, Cargando, Encabezado, Seccion, Vacio } from '@/common/components/ui';
import { mensajeError } from '@/common/http/api';
import { useTiempoReal } from '@/common/tiempo-real/useTiempoReal';
import { fijarZona, zonaActual } from '@/common/utils/fechas';
import {
  type TipoCatalogo,
  crearItemCatalogo,
  editarItemCatalogo,
  guardarConfiguracion,
  guardarTablero,
  listarCatalogo,
  listarTableros,
} from '@/app/modules/catalogos/api';

interface DefCampo {
  clave: string;
  etiqueta: string;
  tipo?: 'numero' | 'lista';
  opciones?: readonly string[];
  obligatorio?: boolean;
}

/** Campos de cada catálogo, el texto principal y el detalle de cada fila. */
const DEFINICIONES: Record<TipoCatalogo, { titulo: string; campos: DefCampo[]; principal: (r: Fila) => string; detalle: (r: Fila) => string }> = {
  restauradores: {
    titulo: 'Restauradores',
    campos: [
      { clave: 'energis', etiqueta: 'Código Energis', obligatorio: true },
      { clave: 'circuito', etiqueta: 'Circuito' },
      { clave: 'ubicacion', etiqueta: 'Ubicación' },
      { clave: 'subestacion', etiqueta: 'Subestación' },
      { clave: 'zona', etiqueta: 'Zona' },
      { clave: 'sector', etiqueta: 'Sector' },
      { clave: 'latitud', etiqueta: 'Latitud (Honduras: 12 a 17)', tipo: 'numero' },
      { clave: 'longitud', etiqueta: 'Longitud (Honduras: −90 a −83)', tipo: 'numero' },
    ],
    principal: (r) => `${r.energis} · ${r.circuito ?? '—'}`,
    detalle: (r) => [r.ubicacion, r.subestacion, r.zona].filter(Boolean).join(' · '),
  },
  materiales: {
    titulo: 'Materiales',
    campos: [
      { clave: 'codigo', etiqueta: 'Código', obligatorio: true },
      { clave: 'nombre', etiqueta: 'Nombre', obligatorio: true },
      { clave: 'unidad', etiqueta: 'Unidad' },
      { clave: 'stock', etiqueta: 'Stock', tipo: 'numero' },
    ],
    principal: (r) => String(r.nombre ?? ''),
    detalle: (r) => [r.codigo, r.unidad, r.stock !== null && r.stock !== undefined ? `Stock ${r.stock}` : ''].filter(Boolean).join(' · '),
  },
  personal: {
    titulo: 'Personal',
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre completo', obligatorio: true },
      { clave: 'cargo', etiqueta: 'Cargo', tipo: 'lista', opciones: CARGOS_PERSONAL },
      { clave: 'empleado_id', etiqueta: 'N° de empleado' },
    ],
    principal: (r) => String(r.nombre ?? ''),
    detalle: (r) => [r.cargo, r.empleado_id].filter(Boolean).join(' · '),
  },
  tipos: {
    titulo: 'Tipos de restaurador',
    campos: [
      { clave: 'tipo', etiqueta: 'Tipo (p. ej. 1F, 3F)', obligatorio: true },
      { clave: 'elemento', etiqueta: 'Elemento' },
    ],
    principal: (r) => String(r.tipo ?? ''),
    detalle: (r) => String(r.elemento ?? ''),
  },
  marcas: {
    titulo: 'Marcas y modelos',
    campos: [
      { clave: 'elemento', etiqueta: 'Elemento', tipo: 'lista', opciones: ELEMENTOS_MARCA, obligatorio: true },
      { clave: 'marca', etiqueta: 'Marca', obligatorio: true },
      { clave: 'modelo', etiqueta: 'Modelo' },
      { clave: 'tipo_control', etiqueta: 'Tipo de control (restauradores)' },
    ],
    principal: (r) => `${r.marca} ${r.modelo ?? ''}`.trim(),
    detalle: (r) => [r.elemento, r.tipo_control].filter(Boolean).join(' · '),
  },
};

type Fila = Record<string, unknown> & { id: number; activo: boolean };
const PESTANAS = [...(Object.keys(DEFINICIONES) as TipoCatalogo[]), 'tableros', 'zona'] as const;
type Pestana = (typeof PESTANAS)[number];
const TITULO_PESTANA: Record<Pestana, string> = {
  ...Object.fromEntries(Object.entries(DEFINICIONES).map(([k, v]) => [k, v.titulo])),
  tableros: 'Tableros de control',
  zona: 'Zona horaria',
} as Record<Pestana, string>;

function FormItem({ tipo, item, onCerrar }: { tipo: TipoCatalogo; item: Fila | null; onCerrar: () => void }) {
  const def = DEFINICIONES[tipo];
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(def.campos.map((c) => [c.clave, item?.[c.clave] === null || item?.[c.clave] === undefined ? '' : String(item[c.clave])])),
  );
  const [activo, setActivo] = useState(item?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const qc = useQueryClient();
  const avisar = useAvisos();
  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const datos = { ...Object.fromEntries(def.campos.map((c) => [c.clave, f[c.clave]?.trim() || null])), activo };
      if (item) await editarItemCatalogo(tipo, item.id, datos);
      else await crearItemCatalogo(tipo, datos);
      await qc.invalidateQueries({ queryKey: ['catalogo', tipo] });
      avisar(item ? 'Registro actualizado' : 'Registro agregado');
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Hoja
      abierta
      titulo={item ? `Editar · ${def.titulo}` : `Nuevo · ${def.titulo}`}
      onCerrar={onCerrar}
      pie={
        <div>
          {error && (
            <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primario w-full" onClick={guardar} disabled={enviando}>
            {enviando && <Loader2 className="h-5 w-5 animate-spin" />} Guardar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {def.campos.map((c) => (
          <div key={c.clave}>
            <label className="etiqueta" htmlFor={`cat-${c.clave}`}>
              {c.etiqueta}
              {c.obligatorio && <span className="text-rose-600"> *</span>}
            </label>
            {c.tipo === 'lista' ? (
              <select id={`cat-${c.clave}`} className="campo" value={f[c.clave]} onChange={(e) => setF({ ...f, [c.clave]: e.target.value })}>
                <option value="">— Elegir —</option>
                {[...new Set([...(c.opciones ?? []), ...(f[c.clave] ? [f[c.clave]!] : [])])].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                id={`cat-${c.clave}`}
                className="campo"
                inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
                value={f[c.clave]}
                onChange={(e) => setF({ ...f, [c.clave]: e.target.value })}
              />
            )}
          </div>
        ))}
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span className="text-sm font-medium text-slate-700">Activo (aparece en la hoja de visita)</span>
        </label>
      </div>
    </Hoja>
  );
}

function Catalogo({ tipo }: { tipo: TipoCatalogo }) {
  const def = DEFINICIONES[tipo];
  const q = useQuery({ queryKey: ['catalogo', tipo], queryFn: () => listarCatalogo(tipo) as unknown as Promise<Fila[]> });
  useTiempoReal(['catalogos'], () => void q.refetch());
  const [buscar, setBuscar] = useState('');
  const [editando, setEditando] = useState<Fila | null | 'nuevo'>(null);
  const filas = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return (q.data ?? []).filter(
      (r) =>
        !t ||
        Object.values(r).some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(t),
        ),
    );
  }, [q.data, buscar]);
  return (
    <Seccion
      titulo={`${def.titulo}${q.data ? ` · ${q.data.filter((r) => r.activo).length} activos` : ''}`}
      accion={
        <button className="btn-primario min-h-[40px] px-3 text-sm" onClick={() => setEditando('nuevo')}>
          <Plus className="h-4 w-4" /> Nuevo
        </button>
      }
    >
      <div className="tarjeta p-3">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            className="campo pl-9"
            inputMode="search"
            placeholder="Buscar"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            aria-label="Buscar"
          />
        </div>
        {q.isLoading && <Cargando filas={2} />}
        {q.error && <CajaError error={q.error} reintentar={() => q.refetch()} />}
        {q.data && !filas.length && <Vacio texto="Sin registros" />}
        <ul className="divide-y divide-slate-100">
          {filas.map((r) => (
            <li key={r.id}>
              <button className="flex min-h-[52px] w-full items-center gap-3 py-2 text-left" onClick={() => setEditando(r)}>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${r.activo ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{def.principal(r)}</p>
                  <p className="truncate text-xs text-slate-500">{def.detalle(r) || ' '}</p>
                </div>
                {!r.activo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Inactivo</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {editando && <FormItem tipo={tipo} item={editando === 'nuevo' ? null : editando} onCerrar={() => setEditando(null)} />}
    </Seccion>
  );
}

/** Tablero de una marca: lista ordenada de campos (los que se quitan se desactivan, no se borran). */
function FormTablero({ marca, campos, onCerrar }: { marca: string; campos: string[]; onCerrar: () => void }) {
  const [m, setM] = useState(marca);
  const [lista, setLista] = useState<string[]>(campos.length ? campos : ['']);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const qc = useQueryClient();
  const avisar = useAvisos();
  const mover = (i: number, d: number) => {
    const n = [...lista];
    [n[i], n[i + d]] = [n[i + d]!, n[i]!];
    setLista(n);
  };
  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await guardarTablero(m.trim(), lista.map((c) => c.trim()).filter(Boolean));
      await qc.invalidateQueries({ queryKey: ['tableros'] });
      avisar('Tablero guardado');
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Hoja
      abierta
      titulo={marca ? `Tablero · ${marca}` : 'Nuevo tablero'}
      onCerrar={onCerrar}
      pie={
        <div>
          {error && (
            <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primario w-full" onClick={guardar} disabled={enviando || !m.trim()}>
            {enviando && <Loader2 className="h-5 w-5 animate-spin" />} Guardar tablero
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="etiqueta" htmlFor="tab-marca">
            Marca del restaurador
          </label>
          <input id="tab-marca" className="campo" value={m} disabled={!!marca} onChange={(e) => setM(e.target.value)} />
        </div>
        <p className="etiqueta">Campos en el orden en que aparecen</p>
        {lista.map((c, i) => (
          <div key={i} className="flex items-center gap-1">
            <input className="campo" value={c} aria-label={`Campo ${i + 1}`} onChange={(e) => setLista(lista.map((x, j) => (j === i ? e.target.value : x)))} />
            <button className="btn-secundario px-2" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">
              <ArrowUp className="h-4 w-4" />
            </button>
            <button className="btn-secundario px-2" disabled={i === lista.length - 1} onClick={() => mover(i, 1)} aria-label="Bajar">
              <ArrowDown className="h-4 w-4" />
            </button>
            <button className="btn-secundario px-2" onClick={() => setLista(lista.filter((_, j) => j !== i))} aria-label="Quitar">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button className="btn-secundario w-full" onClick={() => setLista([...lista, ''])}>
          <Plus className="h-4 w-4" /> Agregar campo
        </button>
      </div>
    </Hoja>
  );
}

function Tableros() {
  const q = useQuery({ queryKey: ['tableros'], queryFn: listarTableros });
  const [editando, setEditando] = useState<{ marca: string; campos: string[] } | null>(null);
  const porMarca = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of q.data ?? []) if (c.activo) m.set(c.marca, [...(m.get(c.marca) ?? []), c.campo]);
    return [...m.entries()];
  }, [q.data]);
  return (
    <Seccion
      titulo="Tableros de control"
      accion={
        <button className="btn-primario min-h-[40px] px-3 text-sm" onClick={() => setEditando({ marca: '', campos: [] })}>
          <Plus className="h-4 w-4" /> Nuevo
        </button>
      }
    >
      <div className="tarjeta p-3">
        {q.isLoading && <Cargando filas={2} />}
        {q.error && <CajaError error={q.error} reintentar={() => q.refetch()} />}
        {q.data && !porMarca.length && <Vacio texto="Sin tableros configurados" />}
        <ul className="divide-y divide-slate-100">
          {porMarca.map(([marca, campos]) => (
            <li key={marca}>
              <button className="w-full py-3 text-left" onClick={() => setEditando({ marca, campos })}>
                <p className="font-medium text-slate-900">{marca}</p>
                <p className="text-xs text-slate-500">{campos.join(' · ')}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {editando && <FormTablero {...editando} onCerrar={() => setEditando(null)} />}
    </Seccion>
  );
}

const ZONAS = ['America/Tegucigalpa', 'America/Guatemala', 'America/El_Salvador', 'America/Managua', 'America/Costa_Rica', 'America/Panama', 'UTC'];

function ZonaHoraria() {
  const [zona, setZona] = useState(zonaActual());
  const [guardando, setGuardando] = useState(false);
  const avisar = useAvisos();
  const qc = useQueryClient();
  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarConfiguracion({ zona_horaria: zona });
      fijarZona(zona);
      qc.invalidateQueries();
      avisar('Zona horaria actualizada');
    } catch (e) {
      avisar(mensajeError(e), { tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Seccion titulo="Zona horaria">
      <div className="tarjeta flex gap-2 p-4">
        <select className="campo" value={zona} onChange={(e) => setZona(e.target.value)} aria-label="Zona horaria">
          {[...new Set([zona, ...ZONAS])].map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
        <button className="btn-primario shrink-0" onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 className="h-5 w-5 animate-spin" />} Guardar
        </button>
      </div>
    </Seccion>
  );
}

export function Catalogos() {
  const [pestana, setPestana] = useState<Pestana>('restauradores');
  return (
    <div>
      <Encabezado volver titulo="Catálogos" subtitulo="Lo que se elige en la hoja de visita. Los registros se desactivan, no se borran." />
      <div className="mb-4">
        <label className="etiqueta" htmlFor="cat-pestana">
          Catálogo
        </label>
        <select id="cat-pestana" className="campo" value={pestana} onChange={(e) => setPestana(e.target.value as Pestana)}>
          {PESTANAS.map((p) => (
            <option key={p} value={p}>
              {TITULO_PESTANA[p]}
            </option>
          ))}
        </select>
      </div>
      {pestana === 'tableros' ? <Tableros /> : pestana === 'zona' ? <ZonaHoraria /> : <Catalogo key={pestana} tipo={pestana} />}
    </div>
  );
}
