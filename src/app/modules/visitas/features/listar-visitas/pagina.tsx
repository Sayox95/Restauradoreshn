/**
 * «Inspecciones y registros»: las inspecciones que la persona puede ver (todas con Consultar; si no,
 * las suyas), lo guardado en el teléfono que falta enviar (excepción E1), filtros y CSV con Exportar.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { VisitaResumen } from '@shared/tipos';
import { CalendarDays, CloudOff, Download, FileText, Image as Imagen, Loader2, Search, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BadgeVisita, CajaError, Cargando, Encabezado, Paginacion, Seccion, Vacio } from '@/common/components/ui';
import { type Columna, Tabla } from '@/common/components/Tabla';
import { useAvisos } from '@/common/components/Toast';
import { useAccess } from '@/common/seguridad/acceso';
import { useTiempoReal } from '@/common/tiempo-real/useTiempoReal';
import { fecha, fechaHora } from '@/common/utils/fechas';
import { listarVisitas, misVisitas, urlExportar } from '../../api';
import { alCambiarCola } from '../../components/almacen';
import { useCola } from '../../components/envio';
import { PermisosVisitas } from '../../permisos';
import { urlVisita } from '../../urls';

const fechaDe = (v: VisitaResumen) => (v.fecha_visita ? fecha(`${v.fecha_visita}T12:00:00`) : '—');

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
    { titulo: 'Energis', celda: (v) => <span className="font-semibold">{v.codigo_energis ?? '—'}</span> },
    { titulo: 'Circuito', celda: (v) => v.circuito ?? '—', clase: 'whitespace-nowrap' },
    { titulo: 'Ubicación', celda: (v) => v.ubicacion ?? '—' },
    { titulo: 'Tipo', celda: (v) => v.tipo_visita ?? '—', clase: 'whitespace-nowrap' },
    ...(todas ? [{ titulo: 'Registró', celda: (v: VisitaResumen) => v.registrado_por ?? '—' }] : []),
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

/**
 * «Inspecciones y registros»: una sola sección. Con permiso de consultar muestra las inspecciones de
 * todos; sin él, las que registró la persona. Quien registra ve además lo pendiente de envío.
 */
export function ListarVisitas() {
  const { hasAccess } = useAccess();
  const todas = hasAccess([PermisosVisitas.Consultar]);
  const registra = hasAccess([PermisosVisitas.Registrar]);
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [verFechas, setVerFechas] = useState(false);
  const [pagina, setPagina] = useState(1);
  const filtros = { q: q.trim() || undefined, desde: desde || undefined, hasta: hasta || undefined, pagina };
  const consulta = useQuery({
    queryKey: ['visitas', todas ? 'todas' : 'mias', filtros],
    queryFn: () => (todas ? listarVisitas(filtros) : misVisitas(filtros)),
    placeholderData: keepPreviousData,
  });
  useTiempoReal(['visitas'], () => void consulta.refetch());
  // Al enviarse algo guardado en el teléfono, la lista lo muestra sin esperar al canal.
  const { refetch } = consulta;
  useEffect(() => alCambiarCola(() => void refetch()), [refetch]);
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
          {/* Las fechas van plegadas: en el teléfono ocupan pantalla y se usan poco. */}
          <button
            type="button"
            onClick={() => setVerFechas(!verFechas)}
            aria-expanded={verFechas}
            aria-controls="filtro-fechas"
            className={`relative flex w-12 shrink-0 items-center justify-center rounded-xl border ${verFechas ? 'border-marca-300 bg-marca-50 text-marca-700' : 'border-slate-300 bg-white text-slate-600'}`}
            aria-label="Filtrar por fechas"
            title="Filtrar por fechas"
          >
            <CalendarDays className="h-5 w-5" aria-hidden />
            {(desde || hasta) && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-marca-600" aria-hidden />}
          </button>
        </div>
        <div id="filtro-fechas" className={verFechas ? 'grid grid-cols-2 gap-2' : 'hidden'}>
          <label className="text-xs font-semibold text-slate-600">
            Desde
            <input type="date" className="campo mt-1" value={desde} onChange={(e) => filtrar(() => setDesde(e.target.value))} />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Hasta
            <input type="date" className="campo mt-1" value={hasta} onChange={(e) => filtrar(() => setHasta(e.target.value))} />
          </label>
        </div>
      </div>
      {consulta.isPending && consulta.fetchStatus === 'paused' ? (
        // Sin señal la consulta queda en pausa (no es «no hay inspecciones»): se hace sola al volver la señal.
        <Vacio texto="Sin conexión: la lista se mostrará al volver la señal." />
      ) : consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <CajaError error={consulta.error} reintentar={() => void consulta.refetch()} />
      ) : !datos?.filas.length ? (
        <Vacio texto={q || desde || hasta ? 'No hay inspecciones con esos filtros.' : 'Todavía no hay inspecciones registradas.'} />
      ) : (
        <>
          <Tabla
            etiqueta="Inspecciones"
            filas={datos.filas}
            clave={(v) => v.id}
            columnas={columnas(todas)}
            tarjeta={(v) => <TarjetaVisita v={v} todas={todas} />}
            enlace={(v) => urlVisita(v.id)}
          />
          <Paginacion pagina={pagina} paginas={paginas} onCambiar={setPagina} />
        </>
      )}
    </div>
  );
}
