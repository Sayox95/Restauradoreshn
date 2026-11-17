/**
 * «Inspecciones y registros»: las inspecciones que la persona puede ver (todas con Consultar; si no,
 * las suyas), lo guardado en el teléfono que falta enviar (excepción E1), filtros y CSV con Exportar.
 */
import { EQUIPO_ETIQUETA, EQUIPOS } from '@shared/constantes';
import type { Restaurador } from '@shared/tipos';
import type { VisitaResumen } from '@shared/tipos';
import { CloudOff, Download, FileText, Image as Imagen, Loader2, Search, Send, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { SelectorMultiple } from '@/common/components/SelectorMultiple';
import { BadgeVisita, CajaError, Cargando, Encabezado, Paginacion, Seccion, Vacio } from '@/common/components/ui';
import { type Columna, Tabla } from '@/common/components/Tabla';
import { useAvisos } from '@/common/components/Toast';
import { useAccess } from '@/common/seguridad/acceso';
import { useTiempoReal } from '@/common/tiempo-real/useTiempoReal';
import { fecha, fechaHora } from '@/common/utils/fechas';
import { urlExportar } from '../../api';
import { useInspecciones } from '../../hooks/useInspecciones';
import { useCatalogosVisita } from '../../hooks/useCatalogosVisita';
import { alEnviarInspecciones, useCola } from '../../components/envio';
import { PermisosVisitas } from '../../permisos';
import { urlVisita } from '../../urls';

const fechaDe = (v: VisitaResumen) => (v.fecha_visita ? fecha(`${v.fecha_visita}T12:00:00`) : '—');
const equipoDe = (v: VisitaResumen) => EQUIPO_ETIQUETA[v.equipo] ?? v.equipo;

const Archivos = ({ v }: { v: VisitaResumen }) => (
  <span className="inline-flex items-center gap-3 text-slate-500">
    <span className="inline-flex items-center gap-1" title="Fotos">
      <Imagen className="h-4 w-4" aria-hidden /> {v.num_fotos}
    </span>
    {v.tiene_pdf ? <FileText className="h-4 w-4" aria-label="Con PDF" /> : <span className="w-4" aria-hidden />}
  </span>
);

/** Columnas de la tabla (PC). «Registró» solo para quien ve las de todos. */
function columnas(todas: boolean): Columna<VisitaResumen>[] {
  return [
    { titulo: 'Folio', celda: (v) => <span className="font-mono text-xs">{v.visita_num}</span>, clase: 'whitespace-nowrap' },
    { titulo: 'Fecha', celda: fechaDe, clase: 'whitespace-nowrap' },
    { titulo: 'Equipo', celda: equipoDe, clase: 'whitespace-nowrap' },
    { titulo: 'Energis', celda: (v) => <span className="font-semibold">{v.codigo_energis ?? '—'}</span> },
    // La ubicación va debajo del circuito: como columna aparte la tabla no cabe en una pantalla común.
    {
      titulo: 'Circuito · ubicación',
      celda: (v) => (
        <span className="block max-w-[14rem]">
          <span className="block">{v.circuito ?? '—'}</span>
          {v.ubicacion && (
            <span className="block truncate text-xs text-slate-500" title={v.ubicacion}>
              {v.ubicacion}
            </span>
          )}
        </span>
      ),
    },
    { titulo: 'Tipo', celda: (v) => v.tipo_visita ?? '—', clase: 'whitespace-nowrap' },
    ...(todas ? [{ titulo: 'Registró', celda: (v: VisitaResumen) => v.registrado_por ?? '—', clase: 'whitespace-nowrap' }] : []),
    { titulo: 'Estado', celda: (v) => <BadgeVisita estado={v.estado} /> },
    { titulo: 'Archivos', celda: (v) => <Archivos v={v} /> },
  ];
}

function TarjetaVisita({ v, todas }: { v: VisitaResumen; todas: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-900">{v.codigo_energis ?? '—'}</span>
        <BadgeVisita estado={v.estado} />
      </div>
      <p className="truncate text-sm text-slate-600">{[v.circuito, v.ubicacion].filter(Boolean).join(' · ') || 'Sin ubicación'}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
        <span>{fechaDe(v)}</span>
        <span>{equipoDe(v)}</span>
        <span>{v.tipo_visita}</span>
        <span className="font-mono">{v.visita_num}</span>
        {todas && v.registrado_por && <span>{v.registrado_por}</span>}
        <Archivos v={v} />
      </p>
    </>
  );
}

function Pendientes() {
  const { pendientes, enviando, enviar } = useCola();
  const avisar = useAvisos();
  if (!pendientes.length) return null;
  const enviarAhora = async () => {
    const r = await enviar();
    if (r.detenido === 'sin_conexion') avisar('Sin conexión: se enviarán al volver la señal', { tipo: 'error' });
    else if (r.detenido === 'sin_sesion') avisar('Inicie sesión de nuevo para enviar', { tipo: 'error' });
    else if (r.rechazadas) avisar(`${r.rechazadas} inspección(es) no se pudieron enviar`, { tipo: 'error' });
    else avisar(r.enviadas.length === 1 ? 'Inspección enviada' : `${r.enviadas.length} inspecciones enviadas`);
  };
  return (
    <Seccion
      titulo={`Sin enviar (${pendientes.length})`}
      accion={
        <button type="button" className="btn-secundario min-h-[36px] px-3 text-sm" disabled={enviando} onClick={enviarAhora}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
        </button>
      }
    >
      <ul className="tarjeta divide-y divide-slate-100">
        {pendientes.map((p) => (
          <li key={p.visita_num} className="flex items-start gap-3 px-4 py-3">
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {p.visita.codigo_energis ?? '—'} <span className="text-xs font-normal text-slate-500">{p.visita_num}</span>
              </p>
              <p className="text-xs text-slate-500">
                Guardada {fechaHora(p.guardado_en)} · {p.fotos.length} foto(s)
                {p.id ? ' · registrada, faltan archivos' : ''}
              </p>
              {p.error && <p className="mt-1 text-xs font-semibold text-rose-700">{p.error}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}

/** Filtros que van en la URL (se conservan al abrir una inspección y volver). Listas: separadas por coma. */
const CLAVES_FILTRO = ['equipo', 'zona', 'circuito', 'desde', 'hasta'] as const;
const lista = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const fechaValida = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

/** Valores distintos y ordenados de una columna del catálogo de restauradores. */
const distintos = (rs: Restaurador[], f: (r: Restaurador) => string | null) =>
  [...new Set(rs.map((r) => f(r)?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

/** Subestación de un circuito: lo que va antes del primer guion («BER-L205» → BER); sin guion, «Otros». */
const subestacionDe = (circuito: string) => (circuito.includes('-') ? circuito.split('-')[0]!.trim().toUpperCase() : 'Otros');

const OPCIONES_EQUIPO = EQUIPOS.map((e) => ({ valor: e as string, texto: EQUIPO_ETIQUETA[e] }));

/**
 * «Inspecciones y registros»: una sola sección. Con permiso de consultar muestra las inspecciones de
 * todos; sin él, las que registró la persona. Quien registra ve además lo pendiente de envío.
 */
export function ListarVisitas() {
  const { hasAccess } = useAccess();
  // La inspección que se acaba de guardar se resalta al llegar desde la pantalla final.
  const resaltar = (useLocation().state as { resaltar?: string } | null)?.resaltar;
  const todas = hasAccess([PermisosVisitas.Consultar]);
  const registra = hasAccess([PermisosVisitas.Registrar]);
  const [params, setParams] = useSearchParams();
  const equipos = lista(params.get('equipo'));
  const zonas = lista(params.get('zona'));
  const circuitos = lista(params.get('circuito'));
  const desde = fechaValida(params.get('desde'));
  const hasta = fechaValida(params.get('hasta'));
  const activos = [equipos.length, zonas.length, circuitos.length, desde, hasta].filter(Boolean).length;
  const [verFiltros, setVerFiltros] = useState(activos > 0);
  const [pagina, setPagina] = useState(1);
  const fijar = (cambios: Partial<Record<(typeof CLAVES_FILTRO)[number], string>>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
    setPagina(1);
  };
  const limpiar = () => fijar(Object.fromEntries(CLAVES_FILTRO.map((k) => [k, ''])));
  // La búsqueda espera a que se deje de escribir (un pedido, no uno por letra).
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(texto.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [texto]);
  const filtros = {
    q: q || undefined,
    equipo: equipos.join(',') || undefined,
    zona: zonas.join(',') || undefined,
    // Los nombres de circuito no llevan comas.
    circuitos: [...circuitos].sort().join(',') || undefined,
    desde: desde || undefined,
    hasta: hasta || undefined,
    page: pagina,
  };
  // Zonas y circuitos para los filtros: los del catálogo de restauradores; los circuitos, de las zonas elegidas.
  const restauradores = useCatalogosVisita().data?.restauradores;
  const opcionesZona = useMemo(() => distintos(restauradores ?? [], (r) => r.zona).map((z) => ({ valor: z, texto: z })), [restauradores]);
  const deZonas = (zs: string[]) => (restauradores ?? []).filter((r) => !zs.length || zs.some((z) => z.toLowerCase() === r.zona?.trim().toLowerCase()));
  const zonasClave = zonas.join(',');
  const opcionesCircuito = useMemo(
    () => distintos(deZonas(lista(zonasClave)), (r) => r.circuito).map((c) => ({ valor: c, texto: c })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restauradores, zonasClave],
  );
  // Al cambiar las zonas se quitan los circuitos elegidos que no les pertenecen.
  const elegirZonas = (zs: string[]) => {
    const validos = new Set(distintos(deZonas(zs), (r) => r.circuito));
    fijar({ zona: zs.join(','), circuito: circuitos.filter((c) => validos.has(c)).join(',') });
  };
  const consulta = useInspecciones(filtros, todas);
  useTiempoReal(['visitas'], () => void consulta.refetch());
  // Al terminar de enviarse lo guardado en el teléfono, la lista lo muestra sin esperar al canal: una
  // recarga por tanda (no en cada paso del envío: registrar, cada foto, el PDF).
  const { refetch } = consulta;
  useEffect(() => alEnviarInspecciones(() => void refetch()), [refetch]);
  const datos = consulta.data;
  const paginas = datos?.lastPage ?? 1;

  return (
    <div>
      <Encabezado
        titulo="Inspecciones y registros"
        accion={
          hasAccess([PermisosVisitas.Exportar]) ? (
            <a href={urlExportar(filtros)} className="btn-secundario min-h-[40px] px-3 text-sm" download>
              <Download className="h-4 w-4" /> CSV
            </a>
          ) : undefined
        }
      />
      {registra && <Pendientes />}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              className="campo pl-9"
              inputMode="search"
              placeholder="Buscar por Energis, circuito, ubicación o folio"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-label="Buscar"
            />
          </div>
          <button
            type="button"
            onClick={() => setVerFiltros(!verFiltros)}
            aria-expanded={verFiltros}
            aria-controls="panel-filtros"
            className={`relative flex shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${verFiltros ? 'border-marca-300 bg-marca-50 text-marca-700' : 'border-slate-300 bg-white text-slate-600'}`}
            aria-label={activos ? `Filtros (${activos} activos)` : 'Filtros'}
          >
            <SlidersHorizontal className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">Filtros</span>
            {activos > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-marca-600 px-1 text-[11px] font-bold text-white">
                {activos}
              </span>
            )}
          </button>
        </div>
        {verFiltros && (
          <div
            id="panel-filtros"
            className="tarjeta grid grid-cols-2 gap-3 p-3 lg:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,1.4fr)_repeat(2,minmax(0,1fr))_auto] lg:items-start"
          >
            <SelectorMultiple etiqueta="Equipo" opciones={OPCIONES_EQUIPO} valor={equipos} onChange={(v) => fijar({ equipo: v.join(',') })} />
            <SelectorMultiple etiqueta="Zona" textoTodas="Todas" opciones={opcionesZona} valor={zonas} onChange={elegirZonas} />
            <SelectorMultiple
              etiqueta="Circuito"
              className="col-span-2 lg:col-span-1"
              opciones={opcionesCircuito}
              valor={circuitos}
              onChange={(v) => fijar({ circuito: v.join(',') })}
              grupo={(o) => subestacionDe(o.valor)}
              buscar
            />
            <div>
              <label className="etiqueta" htmlFor="f-desde">
                Desde
              </label>
              <input
                id="f-desde"
                type="date"
                className="campo h-11 py-0"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => fijar({ desde: e.target.value })}
              />
            </div>
            <div>
              <label className="etiqueta" htmlFor="f-hasta">
                Hasta
              </label>
              <input
                id="f-hasta"
                type="date"
                className="campo h-11 py-0"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => fijar({ hasta: e.target.value })}
              />
            </div>
            {activos > 0 && (
              <button type="button" className="btn-secundario col-span-2 lg:col-span-1 lg:mt-6 lg:self-start" onClick={limpiar}>
                <X className="h-4 w-4" aria-hidden /> Limpiar
              </button>
            )}
          </div>
        )}
      </div>
      {consulta.isPending && consulta.fetchStatus === 'paused' ? (
        // Sin señal la consulta queda en pausa (no es «no hay inspecciones»): se hace sola al volver la señal.
        <Vacio texto="Sin conexión: la lista se mostrará al volver la señal." />
      ) : consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <CajaError error={consulta.error} reintentar={() => void consulta.refetch()} />
      ) : !datos?.data.length ? (
        <Vacio texto={q || activos ? 'No hay inspecciones con esos filtros.' : 'Todavía no hay inspecciones registradas.'} />
      ) : (
        <>
          <Tabla
            etiqueta="Inspecciones"
            filas={datos.data}
            clave={(v) => v.id}
            columnas={columnas(todas)}
            tarjeta={(v) => <TarjetaVisita v={v} todas={todas} />}
            enlace={(v) => urlVisita(v.id)}
            resaltada={(v) => v.visita_num === resaltar}
          />
          <Paginacion pagina={pagina} paginas={paginas} onCambiar={setPagina} />
        </>
      )}
    </div>
  );
}
