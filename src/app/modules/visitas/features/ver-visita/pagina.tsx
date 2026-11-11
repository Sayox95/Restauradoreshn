/** Detalle de una visita (solo lectura): datos por sección, fotos originales y la ficha PDF archivada. */
import { useQuery } from '@tanstack/react-query';
import { SECCIONES, type Visita } from '@shared/visitas';
import { FileDown } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeVisita, CajaError, Cargando, Encabezado, Seccion, Vacio } from '@/common/components/ui';
import { VisorFotos } from '@/common/components/VisorFotos';
import { fecha, fechaHora } from '@/common/utils/fechas';
import { urlFoto, urlPdf, verVisita } from '../../api';

type Fila = [string, keyof Visita];
const DATOS: Fila[][] = [
  [
    ['Fecha', 'fecha_visita'],
    ['Tipo de visita', 'tipo_visita'],
    ['Llegada', 'hora_llegada'],
    ['Salida', 'hora_salida'],
    ['Código Energis', 'codigo_energis'],
    ['Circuito', 'circuito'],
    ['Ubicación', 'ubicacion'],
    ['Subestación', 'subestacion'],
    ['Zona', 'zona'],
    ['Sector', 'sector'],
    ['Latitud', 'latitud'],
    ['Longitud', 'longitud'],
    ['Generación distribuida', 'gen_distribuida'],
  ],
  [
    ['Tipo', 'tipo_recon'],
    ['Marca', 'marca_reconectador'],
    ['Modelo', 'modelo_recon'],
    ['Serie', 'serie_recon'],
    ['Tipo de control', 'tipo_control'],
    ['Serie del control', 'serie_control'],
    ['Medio de extinción', 'medio_extincion'],
    ['Firmware / Proview', 'proview_control'],
    ['Terminal p/sensores V', 'term_sens_v'],
    ['Manguera sensores V', 'mangu_sens_v'],
    ['Terminal manguera aux', 'term_mangu_aux'],
    ['Manguera auxiliar', 'mangu_aux'],
  ],
  [1, 2].flatMap((n) =>
    (
      [
        [`Módem ${n}`, 'has_modem'],
        ['Tipo', 'tipo_modem'],
        ['Marca', 'marca_modem'],
        ['Modelo', 'modelo_modem'],
        ['Serie', 'serie_modem'],
        ['Antena', 'antena_modem'],
        ['Tipo de antena', 'tipo_antena'],
        ['Tecnología', 'tec_modem'],
      ] as const
    ).map(([t, k]) => [t, `${k}${n}` as keyof Visita] as Fila),
  ),
  [
    ['Grupo activo', 'ajuste_activo'],
    ['Alarma presente', 'alarma_presente'],
    ['Descripción de la alarma', 'desc_alarma'],
    ['Voltaje AC (V)', 'medicion_ac'],
    ['Voltaje baterías (V)', 'medicion_bat'],
    ['Voltaje cargador (V)', 'medicion_cargador'],
    ['Battery test', 'battery_test'],
    ['Cambio de baterías', 'cambio_baterias'],
    ['Tipo de batería', 'tipo_bateria'],
  ],
  [
    ['IA (A)', 'corr_ia'],
    ['IB (A)', 'corr_ib'],
    ['IC (A)', 'corr_ic'],
    ['IN (A)', 'corr_in'],
  ],
  [
    ['Gabinete', 'gabinete'],
    ['Borneras', 'borneras'],
    ['Observación', 'obs_estado_fisico'],
    ['Aterrizaje restaurador', 'ater_rest_state'],
    ['Aterrizaje control', 'ater_ctrl_state'],
    ['Cable de tierra', 'cable_tierra'],
    ['# Varillas', 'num_varillas'],
    ['Resistencia control (Ω)', 'ater_control'],
    ['Resistencia restaurador (Ω)', 'ater_restaurador'],
    ['Resistencia otros (Ω)', 'ater_otros'],
    ['Tipo de cuchilla', 'tipo_cuchilla'],
    ['Estado de cuchillas', 'estado_cuchillas'],
    ['# Cuchillas', 'num_cuchillas'],
    ['Pararrayos', 'pararrayos'],
    ['# Pararrayos', 'num_pararrayos'],
    ['¿Tiene potencial?', 'tiene_potencial'],
    ['Cantidad', 'pot_cantidad'],
    ['Fase de conexión', 'fase_conexion'],
    ['Pararrayos del potencial', 'pot_pararrayos'],
    ['Cuchilla del potencial', 'pot_cuchilla'],
    ['Aterrizaje del potencial', 'ater_pot_state'],
    ['Alimentado por acometida', 'alimentado_acometida'],
    ['Observaciones del potencial', 'obs_potencial'],
  ],
];

function Datos({ v, filas, extra }: { v: Visita; filas: Fila[]; extra?: [string, string][] }) {
  const visibles: [string, string][] = [
    ...filas.filter(([, k]) => v[k] !== null && v[k] !== undefined && v[k] !== '').map(([t, k]) => [t, String(v[k])] as [string, string]),
    ...(extra ?? []),
  ];
  if (!visibles.length) return <p className="px-4 py-3 text-sm text-slate-500">Sin datos.</p>;
  return (
    <dl className="divide-y divide-slate-100">
      {visibles.map(([t, valor], i) => (
        <div key={`${t}-${i}`} className="flex gap-3 px-4 py-2.5 text-sm">
          <dt className="w-2/5 shrink-0 text-slate-500">{t}</dt>
          <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words font-medium text-slate-900">
            {/^\d{4}-\d{2}-\d{2}$/.test(valor) ? fecha(`${valor}T12:00:00`) : valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function VerVisita() {
  const id = Number(useParams().id);
  const consulta = useQuery({ queryKey: ['visita', id], queryFn: () => verVisita(id), enabled: Number.isInteger(id) });
  const [foto, setFoto] = useState<number | null>(null);
  if (consulta.isPending && consulta.fetchStatus === 'paused') return <Vacio texto="Sin conexión: la visita se mostrará al volver la señal." />;
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError || !consulta.data)
    return <CajaError error={consulta.error ?? new Error('Visita no encontrada')} reintentar={() => void consulta.refetch()} />;
  const d = consulta.data;
  const v = d.datos;
  const fotos = d.fotos.map((f) => ({ src: urlFoto(d.id, f.orden, f.v), alt: f.observacion ?? `Foto ${f.orden}`, obs: f.observacion }));
  const tablero = Object.entries(v.tablero_campos ?? {}) as [string, string][];

  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado
        volver
        titulo={`${v.codigo_energis ?? 'Visita'} · ${v.tipo_visita ?? ''}`}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            <BadgeVisita estado={d.estado} /> {d.visita_num}
          </span>
        }
        accion={
          d.tiene_pdf ? (
            <a href={urlPdf(d.id)} target="_blank" rel="noreferrer" className="btn-secundario min-h-[40px] px-3 text-sm">
              <FileDown className="h-4 w-4" /> PDF
            </a>
          ) : undefined
        }
      />
      <p className="mb-4 px-1 text-xs text-slate-500">
        {v.fecha_visita ? `Visita del ${fecha(`${v.fecha_visita}T12:00:00`)}` : ''}
        {d.registrado_en ? ` · registrada ${fechaHora(d.registrado_en)}` : ''}
        {d.registrado_por ? ` por ${d.registrado_por}` : ''}
      </p>

      {DATOS.map((filas, i) => (
        <Seccion key={i} titulo={SECCIONES[i]!}>
          <div className="tarjeta">
            <Datos v={v} filas={filas} extra={i === 3 ? tablero : undefined} />
          </div>
        </Seccion>
      ))}

      <Seccion titulo="Materiales">
        <div className="tarjeta">
          <Datos
            v={v}
            filas={[['Observación', 'obs_materiales']]}
            extra={v.materiales.map((m, i) => [
              `#${i + 1}${m.codigo ? ` · ${m.codigo}` : ''}`,
              `${m.desc} — ${m.cant ?? ''} ${m.unidad ?? ''}${m.motivo ? ` (${m.motivo})` : ''}`,
            ])}
          />
        </div>
      </Seccion>

      <Seccion titulo={`Fotografías (${fotos.length})`}>
        {fotos.length ? (
          <div className="grid grid-cols-2 gap-3">
            {fotos.map((f, i) => (
              <button key={f.src} type="button" className="tarjeta overflow-hidden text-left" onClick={() => setFoto(i)}>
                <img src={f.src} alt={f.alt} loading="lazy" className="aspect-[4/3] w-full bg-slate-100 object-cover" />
                {f.obs && <p className="px-3 py-2 text-xs text-slate-600">{f.obs}</p>}
              </button>
            ))}
          </div>
        ) : (
          <p className="px-1 text-sm text-slate-500">Sin fotografías.</p>
        )}
      </Seccion>

      <Seccion titulo="Observaciones">
        <div className="tarjeta">
          <Datos v={v} filas={[['Generales', 'obs_generales']]} />
        </div>
      </Seccion>

      <Seccion titulo="Personal y firma">
        <div className="tarjeta">
          <Datos
            v={v}
            filas={[['Responsable', 'firma_responsable']]}
            extra={v.personal.map((p, i) => [`Técnico #${i + 1}`, [p.nombre, p.cargo, p.id].filter(Boolean).join(' · ')])}
          />
          {v.firma_img && <img src={v.firma_img} alt="Firma del responsable" className="mx-4 mb-4 max-h-32 rounded-lg border border-slate-200 bg-white" />}
        </div>
      </Seccion>

      {foto !== null && <VisorFotos fotos={fotos} inicial={foto} onCerrar={() => setFoto(null)} />}
    </div>
  );
}
