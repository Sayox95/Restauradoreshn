import type { UseQueryResult } from '@tanstack/react-query';
import { type UseFormReturn, useFieldArray } from 'react-hook-form';
import type { ZodTypeAny } from 'zod';
import {
  cargoCatalogoEsquema,
  configuracionEsquema,
  tableroFormEsquema,
  marcaCatalogoEsquema,
  materialCatalogoEsquema,
  restauradorEsquema,
  tipoCatalogoEsquema,
} from '@shared/esquemas';
import {
  CampoForm,
  ErrorCampo,
  ErrorServidor,
  useFormulario,
} from '@components/formulario';
import { ELEMENTOS_MARCA } from '@shared/constantes';
import { ArrowDown, ArrowUp, Loader2, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Hoja } from '@components/hoja';
import { type Columna, Tabla } from '@components/tabla';
import { useAvisos } from '@components/toast';
import {
  CajaError,
  Cargando,
  Encabezado,
  Seccion,
  Vacio,
} from '@components/ui';
import { mensajeError } from '@common/http/api';
import { useClaveIntento } from '@common/http/clave-intento';
import { useTiempoReal } from '@common/tiempo-real/useTiempoReal';
import { fijarZona, zonaActual } from '@common/utils/fechas';
import {
  type TipoCatalogo,
  crearItemCatalogo,
  editarItemCatalogo,
  guardarConfiguracion,
  guardarTablero,
} from '@modules/catalogos/api';
import {
  useCatalogo,
  useRecargarCatalogos,
  useTableros,
} from '../../hooks/useCatalogos';
import { SECCION, esSeccionCatalogo } from '../../secciones';
import { urlCatalogos } from '../../urls';

interface DefCampo {
  clave: string;
  etiqueta: string;
  tipo?: 'numero' | 'lista';
  opciones?: readonly string[];
  obligatorio?: boolean;
}

/** Campos de cada catálogo, el texto principal y el detalle de cada fila. */
const DEFINICIONES: Record<
  TipoCatalogo,
  {
    campos: DefCampo[];
    principal: (r: Fila) => string;
    detalle: (r: Fila) => string;
  }
> = {
  restauradores: {
    campos: [
      { clave: 'energis', etiqueta: 'Código Energis', obligatorio: true },
      { clave: 'circuito', etiqueta: 'Circuito' },
      { clave: 'ubicacion', etiqueta: 'Ubicación' },
      { clave: 'subestacion', etiqueta: 'Subestación' },
      { clave: 'zona', etiqueta: 'Zona' },
      { clave: 'sector', etiqueta: 'Sector' },
      {
        clave: 'latitud',
        etiqueta: 'Latitud (Honduras: 12 a 17)',
        tipo: 'numero',
      },
      {
        clave: 'longitud',
        etiqueta: 'Longitud (Honduras: −90 a −83)',
        tipo: 'numero',
      },
    ],
    principal: r => `${r.energis} · ${r.circuito ?? '—'}`,
    detalle: r =>
      [r.ubicacion, r.subestacion, r.zona].filter(Boolean).join(' · '),
  },
  materiales: {
    campos: [
      { clave: 'codigo', etiqueta: 'Código', obligatorio: true },
      { clave: 'nombre', etiqueta: 'Nombre', obligatorio: true },
      { clave: 'unidad', etiqueta: 'Unidad' },
      { clave: 'stock', etiqueta: 'Stock', tipo: 'numero' },
    ],
    principal: r => String(r.nombre ?? ''),
    detalle: r =>
      [
        r.codigo,
        r.unidad,
        r.stock !== null && r.stock !== undefined ? `Stock ${r.stock}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
  },
  tipos: {
    campos: [
      { clave: 'tipo', etiqueta: 'Tipo (p. ej. 1F, 3F)', obligatorio: true },
      { clave: 'elemento', etiqueta: 'Elemento' },
    ],
    principal: r => String(r.tipo ?? ''),
    detalle: r => String(r.elemento ?? ''),
  },
  marcas: {
    campos: [
      {
        clave: 'elemento',
        etiqueta: 'Elemento',
        tipo: 'lista',
        opciones: ELEMENTOS_MARCA,
        obligatorio: true,
      },
      { clave: 'marca', etiqueta: 'Marca', obligatorio: true },
      { clave: 'modelo', etiqueta: 'Modelo' },
      { clave: 'tipo_control', etiqueta: 'Tipo de control (restauradores)' },
    ],
    principal: r => `${r.marca} ${r.modelo ?? ''}`.trim(),
    detalle: r => [r.elemento, r.tipo_control].filter(Boolean).join(' · '),
  },
  cargos: {
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre del cargo', obligatorio: true },
    ],
    principal: r => String(r.nombre ?? ''),
    detalle: () => '',
  },
};

type Fila = Record<string, unknown> & { id: number; activo: boolean };

/** Esquema de cada catálogo: el mismo que valida el servidor. */
const ESQUEMAS: Record<TipoCatalogo, ZodTypeAny> = {
  restauradores: restauradorEsquema,
  materiales: materialCatalogoEsquema,
  tipos: tipoCatalogoEsquema,
  marcas: marcaCatalogoEsquema,
  cargos: cargoCatalogoEsquema,
};

function FormItem({
  tipo,
  item,
  onCerrar,
}: {
  tipo: TipoCatalogo;
  item: Fila | null;
  onCerrar: () => void;
}) {
  const def = DEFINICIONES[tipo];
  // El mismo esquema que valida el servidor (shared/esquemas.ts); cada catálogo tiene sus campos.
  const form = useFormulario(ESQUEMAS[tipo], {
    ...Object.fromEntries(
      def.campos.map(c => [
        c.clave,
        item?.[c.clave] === null || item?.[c.clave] === undefined
          ? ''
          : String(item[c.clave]),
      ]),
    ),
    activo: item?.activo ?? true,
  }) as unknown as UseFormReturn<Record<string, unknown>>;
  const [error, setError] = useState<string | null>(null);
  const recargar = useRecargarCatalogos();
  const avisar = useAvisos();
  const intento = useClaveIntento();
  const valorActual = (clave: string) => String(form.watch(clave) ?? '');
  const guardar = form.handleSubmit(async datos => {
    setError(null);
    try {
      if (item) await editarItemCatalogo(tipo, item.id, datos);
      else {
        await crearItemCatalogo(tipo, datos, intento.clave());
        intento.renovar();
      }
      await recargar(tipo);
      avisar(item ? 'Registro actualizado' : 'Registro agregado');
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
    }
  });
  return (
    <Hoja
      abierta
      titulo={
        item
          ? `Editar · ${SECCION[tipo].titulo}`
          : `Nuevo · ${SECCION[tipo].titulo}`
      }
      onCerrar={onCerrar}
      pie={
        <div className="space-y-2">
          <ErrorServidor mensaje={error} />
          <button
            className="btn-primario w-full"
            onClick={guardar}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}{' '}
            Guardar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {def.campos.map(c => (
          <div key={c.clave}>
            <label className="etiqueta" htmlFor={`cat-${c.clave}`}>
              {c.etiqueta}
              {c.obligatorio && <span className="text-rose-600"> *</span>}
            </label>
            {c.tipo === 'lista' ? (
              <select
                id={`cat-${c.clave}`}
                className="campo"
                {...form.register(c.clave)}
              >
                <option value="">— Elegir —</option>
                {[
                  ...new Set([
                    ...(c.opciones ?? []),
                    ...(valorActual(c.clave) ? [valorActual(c.clave)] : []),
                  ]),
                ].map(o => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                id={`cat-${c.clave}`}
                className="campo"
                inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
                {...form.register(c.clave)}
              />
            )}
            <ErrorCampo form={form} nombre={c.clave} />
          </div>
        ))}
        <label className="flex min-h-[44px] items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5"
            {...form.register('activo')}
          />
          <span className="text-sm font-medium text-slate-700">
            Activo (aparece en la hoja de inspección)
          </span>
        </label>
      </div>
    </Hoja>
  );
}

function Catalogo({ tipo }: { tipo: TipoCatalogo }) {
  const def = DEFINICIONES[tipo];
  // Las pantallas de catálogo comparten la fila genérica (cada catálogo declara sus campos arriba).
  const q = useCatalogo(tipo) as unknown as UseQueryResult<Fila[]>;
  useTiempoReal(['catalogos'], () => void q.refetch());
  const [buscar, setBuscar] = useState('');
  const [editando, setEditando] = useState<Fila | null | 'nuevo'>(null);
  const filas = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return (q.data ?? []).filter(
      r =>
        !t ||
        Object.values(r).some(v =>
          String(v ?? '')
            .toLowerCase()
            .includes(t),
        ),
    );
  }, [q.data, buscar]);
  // Columnas de la tabla (PC): los mismos campos del formulario del catálogo, más el estado.
  const columnas: Columna<Fila>[] = [
    ...def.campos.map(c => ({
      // Sin la ayuda entre paréntesis del formulario (p. ej. «Latitud (Honduras: 12 a 17)»).
      titulo: c.etiqueta.replace(/\s*\(.*\)$/, ''),
      celda: (r: Fila) =>
        r[c.clave] === null || r[c.clave] === undefined || r[c.clave] === ''
          ? '—'
          : String(r[c.clave]),
      clase: c.tipo === 'numero' ? 'whitespace-nowrap text-right' : undefined,
    })),
    {
      titulo: 'Estado',
      celda: r =>
        r.activo ? (
          'Activo'
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            Inactivo
          </span>
        ),
    },
  ];
  return (
    <>
      <BarraCatalogo
        resumen={
          q.data
            ? `${q.data.filter(r => r.activo).length} activos de ${q.data.length}`
            : ''
        }
        buscar={buscar}
        onBuscar={setBuscar}
        onNuevo={() => setEditando('nuevo')}
      />
      {q.isLoading && <Cargando filas={2} />}
      {q.error && <CajaError error={q.error} reintentar={() => q.refetch()} />}
      {q.data && !filas.length && (
        <div className="tarjeta">
          <Vacio texto="Sin registros" />
        </div>
      )}
      {filas.length > 0 && (
        <Tabla
          etiqueta={SECCION[tipo].titulo}
          filas={filas}
          clave={r => r.id}
          columnas={columnas}
          alElegir={setEditando}
          apagada={r => !r.activo}
          tarjeta={r => (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate font-medium ${r.activo ? 'text-slate-900' : 'text-slate-400 line-through'}`}
                >
                  {def.principal(r)}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {def.detalle(r) || ' '}
                </p>
              </div>
              {!r.activo && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  Inactivo
                </span>
              )}
            </div>
          )}
        />
      )}
      {editando && (
        <FormItem
          tipo={tipo}
          item={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </>
  );
}

/** Fila de acciones de un catálogo: resumen, buscador y «+ Nuevo» (en el teléfono, en dos renglones). */
function BarraCatalogo({
  resumen,
  buscar,
  onBuscar,
  onNuevo,
}: {
  resumen: string;
  buscar?: string;
  onBuscar?: (v: string) => void;
  onNuevo: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <p className="mr-auto text-sm font-semibold text-slate-500">{resumen}</p>
      <div className="order-last flex w-full gap-2 sm:order-none sm:w-auto">
        {onBuscar && (
          <div className="relative flex-1 sm:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              className="campo h-11 py-0 pl-9"
              inputMode="search"
              placeholder="Buscar"
              value={buscar}
              onChange={e => onBuscar(e.target.value)}
              aria-label="Buscar"
            />
          </div>
        )}
      </div>
      <button
        className="btn-primario min-h-[44px] px-4 text-sm"
        onClick={onNuevo}
      >
        <Plus className="h-4 w-4" /> Nuevo
      </button>
    </div>
  );
}

function FormTablero({
  marca,
  campos,
  onCerrar,
}: {
  marca: string;
  campos: string[];
  onCerrar: () => void;
}) {
  const form = useFormulario(tableroFormEsquema, {
    marca,
    campos: (campos.length ? campos : ['']).map(nombre => ({ nombre })),
  });
  const lista = useFieldArray({ control: form.control, name: 'campos' });
  const [error, setError] = useState<string | null>(null);
  const recargar = useRecargarCatalogos();
  const avisar = useAvisos();
  const marcaEscrita = String(form.watch('marca') ?? '').trim();
  const guardar = form.handleSubmit(async d => {
    setError(null);
    try {
      await guardarTablero(d.marca, d.campos);
      await recargar('tableros');
      avisar('Tablero guardado');
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
    }
  });
  return (
    <Hoja
      abierta
      titulo={marca ? `Tablero · ${marca}` : 'Nuevo tablero'}
      onCerrar={onCerrar}
      pie={
        <div className="space-y-2">
          <ErrorServidor mensaje={error} />
          <button
            className="btn-primario w-full"
            onClick={guardar}
            disabled={form.formState.isSubmitting || !marcaEscrita}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}{' '}
            Guardar tablero
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Solo lectura (no `disabled`): react-hook-form no envía los campos deshabilitados. */}
        <CampoForm
          form={form}
          nombre="marca"
          id="tab-marca"
          etiqueta="Marca del restaurador"
          readOnly={!!marca}
          className={marca ? 'bg-slate-100 text-slate-500' : undefined}
        />
        <p className="etiqueta">Campos en el orden en que aparecen</p>
        {lista.fields.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1">
            <input
              className="campo"
              aria-label={`Campo ${i + 1}`}
              {...form.register(`campos.${i}.nombre`)}
            />
            <button
              type="button"
              className="btn-secundario px-2"
              disabled={i === 0}
              onClick={() => lista.move(i, i - 1)}
              aria-label="Subir"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn-secundario px-2"
              disabled={i === lista.fields.length - 1}
              onClick={() => lista.move(i, i + 1)}
              aria-label="Bajar"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn-secundario px-2"
              onClick={() => lista.remove(i)}
              aria-label="Quitar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secundario w-full"
          onClick={() => lista.append({ nombre: '' })}
        >
          <Plus className="h-4 w-4" /> Agregar campo
        </button>
      </div>
    </Hoja>
  );
}

function Tableros() {
  const q = useTableros();
  const [editando, setEditando] = useState<{
    marca: string;
    campos: string[];
  } | null>(null);
  const porMarca = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of q.data ?? [])
      if (c.activo) m.set(c.marca, [...(m.get(c.marca) ?? []), c.campo]);
    return [...m.entries()];
  }, [q.data]);
  return (
    <>
      <BarraCatalogo
        resumen={q.data ? `${porMarca.length} marcas con tablero` : ''}
        onNuevo={() => setEditando({ marca: '', campos: [] })}
      />
      {q.isLoading && <Cargando filas={2} />}
      {q.error && <CajaError error={q.error} reintentar={() => q.refetch()} />}
      {q.data && !porMarca.length && (
        <div className="tarjeta">
          <Vacio texto="Sin tableros configurados" />
        </div>
      )}
      {porMarca.length > 0 && (
        <Tabla
          etiqueta="Tableros de control"
          filas={porMarca}
          clave={([marca]) => marca}
          columnas={[
            {
              titulo: 'Marca',
              celda: ([marca]) => (
                <span className="font-semibold">{marca}</span>
              ),
              clase: 'whitespace-nowrap',
            },
            {
              titulo: 'Campos del tablero',
              celda: ([, campos]) => campos.join(' · '),
            },
          ]}
          alElegir={([marca, campos]) => setEditando({ marca, campos })}
          tarjeta={([marca, campos]) => (
            <>
              <p className="font-medium text-slate-900">{marca}</p>
              <p className="text-xs text-slate-500">{campos.join(' · ')}</p>
            </>
          )}
        />
      )}
      {editando && (
        <FormTablero {...editando} onCerrar={() => setEditando(null)} />
      )}
    </>
  );
}

const ZONAS = [
  'America/Tegucigalpa',
  'America/Guatemala',
  'America/El_Salvador',
  'America/Managua',
  'America/Costa_Rica',
  'America/Panama',
  'UTC',
];

function ZonaHoraria() {
  const form = useFormulario(configuracionEsquema, {
    zona_horaria: zonaActual(),
  });
  const zona = form.watch('zona_horaria');
  const avisar = useAvisos();
  const recargar = useRecargarCatalogos();
  const guardar = form.handleSubmit(async d => {
    try {
      await guardarConfiguracion(d);
      fijarZona(d.zona_horaria);
      void recargar();
      avisar('Zona horaria actualizada');
    } catch (e) {
      avisar(mensajeError(e), { tipo: 'error' });
    }
  });
  return (
    <Seccion titulo="Zona horaria de la app">
      <form onSubmit={guardar} className="tarjeta flex gap-2 p-4">
        <select
          className="campo"
          aria-label="Zona horaria"
          {...form.register('zona_horaria')}
        >
          {[...new Set([zona, ...ZONAS])].map(z => (
            <option key={z}>{z}</option>
          ))}
        </select>
        <button
          className="btn-primario shrink-0"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}{' '}
          Guardar
        </button>
      </form>
    </Seccion>
  );
}

/** Un catálogo (según la dirección /admin/catalogos/<clave>): su lista, con crear y editar. */
export function GestionarCatalogo() {
  const { catalogo } = useParams();
  if (!esSeccionCatalogo(catalogo))
    return <Navigate to={urlCatalogos} replace />;
  return (
    <div className={catalogo === 'zona' ? 'mx-auto max-w-2xl' : ''}>
      <Encabezado
        volver
        titulo={SECCION[catalogo].titulo}
        subtitulo={SECCION[catalogo].descripcion}
      />
      {catalogo === 'tableros' ? (
        <Tableros />
      ) : catalogo === 'zona' ? (
        <ZonaHoraria />
      ) : (
        <Catalogo key={catalogo} tipo={catalogo} />
      )}
    </div>
  );
}
