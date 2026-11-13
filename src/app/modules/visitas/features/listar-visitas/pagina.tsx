/**
 * «Inspecciones y registros»: las inspecciones que la persona puede ver (todas con Consultar; si no,
 * las suyas), lo guardado en el teléfono que falta enviar (excepción E1), filtros y CSV con Exportar.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { EQUIPO_ETIQUETA, EQUIPOS } from '@shared/constantes';
import type { Restaurador } from '@shared/tipos';
import type { VisitaResumen } from '@shared/tipos';
import { CloudOff, Download, FileText, Image as Imagen, Loader2, Search, Send, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BadgeVisita, CajaError, Cargando, Encabezado, Paginacion, Seccion, Vacio } from '@/common/components/ui';
import { type Columna, Tabla } from '@/common/components/Tabla';
import { useAvisos } from '@/common/components/Toast';
import { useAccess } from '@/common/seguridad/acceso';
import { useTiempoReal } from '@/common/tiempo-real/useTiempoReal';
import { fecha, fechaHora } from '@/common/utils/fechas';
import { listarVisitas, misVisitas, urlExportar } from '../../api';
import { useCatalogosVisita } from '../../components/catalogos';
import { SelectorCircuitos } from '../../components/selector-circuitos';
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

/** Filtros de la lista (además de la búsqueda); vacío = sin filtrar. Circuitos: varios a la vez. */
interface ValoresFiltro {
  equipo: string;
  zona: string;
  circuitos: string[];
  desde: string;
  hasta: string;
}
const SIN_FILTROS: ValoresFiltro = { equipo: '', zona: '', circuitos: [], desde: '', hasta: '' };
/** Cuántos filtros hay puestos (para el contador del botón). */
const contarActivos = (v: ValoresFiltro) => Object.values(v).filter((x) => (Array.isArray(x) ? x.length > 0 : !!x)).length;

/** Valores distintos y ordenados de una columna del catálogo de restauradores. */
const distintos = (lista: Restaurador[], f: (r: Restaurador) => string | null) =>
  [...new Set(lista.map((r) => f(r)?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

/** Panel de filtros: se muestra y oculta con el botón «Filtros». */
function PanelFiltros({ valores, onCambiar, restauradores }: { valores: ValoresFiltro; onCambiar: (v: ValoresFiltro) => void; restauradores: Restaurador[] }) {
  const campo = (clave: 'equipo' | 'desde' | 'hasta', valor: string) => onCambiar({ ...valores, [clave]: valor });
  const zonas = useMemo(() => distintos(restauradores, (r) => r.zona), [restauradores]);
  // Los circuitos se acotan a la zona elegida.
  const circuitos = useMemo(
    () =>
      distintos(
        restauradores.filter((r) => !valores.zona || r.zona?.trim().toLowerCase() === valores.zona.toLowerCase()),
        (r) => r.circuito,
      ),
    [restauradores, valores.zona],
  );
  // Al cambiar de zona, se quitan los circuitos elegidos que no pertenecen a la nueva.
  const elegirZona = (zona: string) => {
    const deLaZona = new Set(restauradores.filter((x) => !zona || x.zona?.trim().toLowerCase() === zona.toLowerCase()).map((x) => x.circuito?.trim()));
    onCambiar({ ...valores, zona, circuitos: valores.circuitos.filter((c) => deLaZona.has(c)) });
  };
  const activos = contarActivos(valores) > 0;
  return (
    <div id="panel-filtros" className="tarjeta p-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <label className="text-xs font-semibold text-slate-600">
          Equipo
          <select className="campo mt-1" value={valores.equipo} onChange={(e) => campo('equipo', e.target.value)}>
            <option value="">Todos</option>
            {EQUIPOS.map((x) => (
              <option key={x} value={x}>
                {EQUIPO_ETIQUETA[x]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Zona
          <select className="campo mt-1" value={valores.zona} onChange={(e) => elegirZona(e.target.value)}>
            <option value="">Todas</option>
            {zonas.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {/* No es <label>: el selector tiene sus propios botones y casillas. */}
        <div className="col-span-2 text-xs font-semibold text-slate-600 lg:col-span-1">
          Circuito
          <SelectorCircuitos circuitos={circuitos} elegidos={valores.circuitos} onCambiar={(c) => onCambiar({ ...valores, circuitos: c })} />
        </div>
        <label className="text-xs font-semibold text-slate-600">
          Desde
          <input type="date" className="campo mt-1" value={valores.desde} onChange={(e) => campo('desde', e.target.value)} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Hasta
          <input type="date" className="campo mt-1" value={valores.hasta} onChange={(e) => campo('hasta', e.target.value)} />
        </label>
      </div>
      {activos && (
        <div className="mt-3 flex justify-end">
          <button type="button" className="text-sm font-semibold text-marca-600 hover:underline" onClick={() => onCambiar(SIN_FILTROS)}>
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}

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
  const [q, setQ] = useState('');
  const [valores, setValores] = useState<ValoresFiltro>(SIN_FILTROS);
  const [verFiltros, setVerFiltros] = useState(false);
  const [pagina, setPagina] = useState(1);
  const activos = contarActivos(valores);
  const filtros = {
    q: q.trim() || undefined,
    equipo: valores.equipo || undefined,
    zona: valores.zona || undefined,
    // Varios circuitos van separados por coma (los nombres de circuito no llevan comas).
    circuitos: valores.circuitos.length ? [...valores.circuitos].sort().join(',') : undefined,
    desde: valores.desde || undefined,
    hasta: valores.hasta || undefined,
    pagina,
  };
  // Zonas y circuitos para los filtros: los de los restauradores del catálogo.
  const restauradores = useCatalogosVisita().data?.restauradores;
  const consulta = useQuery({
    queryKey: ['visitas', todas ? 'todas' : 'mias', filtros],
    queryFn: () => (todas ? listarVisitas(filtros) : misVisitas(filtros)),
    placeholderData: keepPreviousData,
  });
  useTiempoReal(['visitas'], () => void consulta.refetch());
  // Al terminar de enviarse lo guardado en el teléfono, la lista lo muestra sin esperar al canal: una
  // recarga por tanda (no en cada paso del envío: registrar, cada foto, el PDF).
  const { refetch } = consulta;
  useEffect(() => alEnviarInspecciones(() => void refetch()), [refetch]);
  const filtrar = (fn: () => void) => {
    fn();
    setPagina(1);
  };
  const datos = consulta.data;
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;

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
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              className="campo pl-9"
              inputMode="search"
              placeholder="Buscar por Energis, circuito, ubicación o folio"
              value={q}
              onChange={(e) => filtrar(() => setQ(e.target.value))}
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
        {verFiltros && <PanelFiltros valores={valores} restauradores={restauradores ?? []} onCambiar={(v) => filtrar(() => setValores(v))} />}
      </div>
      {consulta.isPending && consulta.fetchStatus === 'paused' ? (
        // Sin señal la consulta queda en pausa (no es «no hay inspecciones»): se hace sola al volver la señal.
        <Vacio texto="Sin conexión: la lista se mostrará al volver la señal." />
      ) : consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <CajaError error={consulta.error} reintentar={() => void consulta.refetch()} />
      ) : !datos?.filas.length ? (
        <Vacio texto={q || activos ? 'No hay inspecciones con esos filtros.' : 'Todavía no hay inspecciones registradas.'} />
      ) : (
        <>
          <Tabla
            etiqueta="Inspecciones"
            filas={datos.filas}
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
