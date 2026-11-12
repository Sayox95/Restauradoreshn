/**
 * «Inspecciones y registros»: las inspecciones que la persona puede ver (todas con Consultar; si no,
 * las suyas), lo guardado en el teléfono que falta enviar (excepción E1), filtros y CSV con Exportar.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { VisitaResumen } from '@shared/tipos';
import { ChevronRight, CloudOff, Download, FilePlus2, PencilLine, FileText, Image as Imagen, Loader2, Search, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeVisita, CajaError, Cargando, Encabezado, Paginacion, Seccion, Vacio } from '@/common/components/ui';
import { useAvisos } from '@/common/components/Toast';
import { TONO } from '@/common/tonos';
import { useAccess } from '@/common/seguridad/acceso';
import { useTiempoReal } from '@/common/tiempo-real/useTiempoReal';
import { fecha, fechaHora } from '@/common/utils/fechas';
import { listarVisitas, misVisitas, urlExportar } from '../../api';
import { type Borrador, alCambiarCola, leerBorrador } from '../../components/almacen';
import { useCola } from '../../components/envio';
import { PermisosVisitas } from '../../permisos';
import { urlNuevaVisita, urlVisita } from '../../urls';

function FilaVisita({ v }: { v: VisitaResumen }) {
  return (
    <li>
      <Link to={urlVisita(v.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{v.codigo_energis ?? '—'}</span>
            <BadgeVisita estado={v.estado} />
          </div>
          <p className="truncate text-sm text-slate-600">{[v.circuito, v.ubicacion].filter(Boolean).join(' · ') || 'Sin ubicación'}</p>
          <p className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
            <span>{v.fecha_visita ? fecha(`${v.fecha_visita}T12:00:00`) : '—'}</span>
            <span>{v.tipo_visita}</span>
            <span className="inline-flex items-center gap-1">
              <Imagen className="h-3.5 w-3.5" aria-hidden /> {v.num_fotos}
            </span>
            {v.tiene_pdf && <FileText className="h-3.5 w-3.5" aria-label="Con PDF" />}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
      </Link>
    </li>
  );
}

/** «Nueva visita», o «Continuar» si hay una visita en curso guardada en el teléfono. */
function EmpezarVisita() {
  const [enCurso, setEnCurso] = useState<Borrador | null>(null);
  useEffect(() => {
    leerBorrador()
      .then((g) => setEnCurso(g ?? null))
      .catch(() => {});
  }, []);
  if (!enCurso)
    return (
      <Link to={urlNuevaVisita} className="btn-primario mb-5 min-h-[56px] w-full text-base">
        <FilePlus2 className="h-5 w-5" aria-hidden /> Nueva visita
      </Link>
    );
  const d = enCurso.datos as Record<string, string | undefined>;
  return (
    <Link to={urlNuevaVisita} className={`mb-5 flex items-center gap-3 rounded-2xl border p-4 ${TONO.atencion.caja}`}>
      <PencilLine className="h-6 w-6 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Visita en curso</p>
        <p className="truncate text-sm">
          {d.codigo_energis ? `${d.codigo_energis} · ` : ''}
          Guardada {fechaHora(enCurso.guardado_en)}
        </p>
      </div>
      <span className="shrink-0 font-bold">Continuar</span>
      <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
    </Link>
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
    else if (r.rechazadas) avisar(`${r.rechazadas} visita(s) no se pudieron enviar`, { tipo: 'error' });
    else avisar(r.enviadas.length === 1 ? 'Visita enviada' : `${r.enviadas.length} visitas enviadas`);
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
    <div className="mx-auto max-w-3xl">
      <Encabezado
        titulo="Inspecciones y registros"
        subtitulo={datos ? `${datos.total} ${datos.total === 1 ? 'inspección' : 'inspecciones'}${todas ? '' : ' registradas por usted'}` : undefined}
        accion={
          hasAccess([PermisosVisitas.Exportar]) ? (
            <a href={urlExportar(filtros)} className="btn-secundario min-h-[40px] px-3 text-sm" download>
              <Download className="h-4 w-4" /> CSV
            </a>
          ) : undefined
        }
      />
      {registra && <EmpezarVisita />}
      {registra && <Pendientes />}
      <div className="mb-4 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
          <input
            className="campo pl-9"
            inputMode="search"
            placeholder="Buscar por Energis, circuito, ubicación o número"
            value={q}
            onChange={(e) => filtrar(() => setQ(e.target.value))}
            aria-label="Buscar"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
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
        // Sin señal la consulta queda en pausa (no es «no hay visitas»): se hace sola al volver la señal.
        <Vacio texto="Sin conexión: la lista se mostrará al volver la señal." />
      ) : consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <CajaError error={consulta.error} reintentar={() => void consulta.refetch()} />
      ) : !datos?.filas.length ? (
        <Vacio texto={q || desde || hasta ? 'No hay inspecciones con esos filtros.' : 'Todavía no hay inspecciones registradas.'} />
      ) : (
        <>
          <ul className="tarjeta divide-y divide-slate-100">
            {datos.filas.map((v) => (
              <FilaVisita key={v.id} v={v} />
            ))}
          </ul>
          <Paginacion pagina={pagina} paginas={paginas} onCambiar={setPagina} />
        </>
      )}
    </div>
  );
}
