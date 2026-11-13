/**
 * Detalle de una inspección (solo lectura). Las secciones salen de la misma estructura que el PDF
 * (components/ficha.ts): mismo orden y mismos bloques; en PC aprovechan el ancho con varias columnas.
 * La firma solo va en el PDF.
 */
import { useQuery } from '@tanstack/react-query';
import { FileDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeVisita, CajaError, Cargando, Encabezado, Vacio } from '@/common/components/ui';
import { type Columna, Tabla } from '@/common/components/Tabla';
import { VisorFotos } from '@/common/components/VisorFotos';
import { useAccess } from '@/common/seguridad/acceso';
import { TONO } from '@/common/tonos';
import { fecha, fechaHora } from '@/common/utils/fechas';
import type { Visita } from '@shared/visitas';
import { urlFoto, urlPdf, verVisita } from '../../api';
import { BotonEliminar } from '../../components/eliminar';
import { type BloqueFicha, type CampoFicha, estructuraFicha, tonoEstado } from '../../components/ficha';
import { PermisosVisitas } from '../../permisos';

// Clases fijas por cantidad de columnas (Tailwind necesita verlas escritas completas).
const COLUMNAS_PC: Record<number, string> = {
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
  6: 'sm:grid-cols-3 lg:grid-cols-6',
  7: 'sm:grid-cols-4 lg:grid-cols-7',
};
const SPAN_PC: Record<number, string> = { 2: 'lg:col-span-2', 3: 'sm:col-span-3 lg:col-span-3' };

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="tarjeta mb-4 overflow-hidden">
      <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-marca-900">{titulo}</h2>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function Celda({ campo, estado }: { campo: CampoFicha; estado: boolean }) {
  const t = estado ? tonoEstado(campo.v) : null;
  const span = SPAN_PC[campo.s ?? 1] ?? '';
  if (estado)
    return (
      <div className={`flex items-baseline gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm ${span}`}>
        <span className="text-slate-600">{campo.l}</span>
        <span className={`inline-flex items-center gap-1.5 font-bold ${t ? TONO[t].texto : 'text-slate-900'}`}>
          {t && <span className={`h-2 w-2 rounded-full ${t === 'bien' ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden />}
          {campo.v}
        </span>
      </div>
    );
  return (
    <div className={`min-w-0 rounded-lg bg-slate-50 px-3 py-2 ${span}`}>
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{campo.l}</p>
      <p className="break-words text-sm font-semibold text-slate-900">{campo.v || '—'}</p>
    </div>
  );
}

function Bloque({ b }: { b: BloqueFicha }) {
  return (
    <div>
      {b.subtitulo && <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-marca-700">{b.subtitulo}</h3>}
      {b.tipo === 'textos' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {b.textos
            .filter(([, t]) => t)
            .map(([e, t]) => (
              <div key={e} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{e}</p>
                <p className="whitespace-pre-wrap text-sm text-slate-900">{t}</p>
              </div>
            ))}
        </div>
      ) : (
        // Los estados («Gabinete ● OK») van en una columna en el teléfono para no partir la etiqueta.
        <div className={`grid gap-2 ${b.tipo === 'estados' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'} ${COLUMNAS_PC[b.cols] ?? 'sm:grid-cols-3'}`}>
          {b.campos.map((c) => (
            <Celda key={c.l} campo={c} estado={b.tipo === 'estados'} />
          ))}
        </div>
      )}
    </div>
  );
}

type Material = Visita['materiales'][number];
const COLUMNAS_MATERIALES: Columna<Material>[] = [
  { titulo: 'Código', celda: (m) => m.codigo ?? '—', clase: 'whitespace-nowrap' },
  { titulo: 'Descripción', celda: (m) => <span className="font-semibold">{m.desc}</span> },
  { titulo: 'Unidad', celda: (m) => m.unidad ?? '—' },
  { titulo: 'Cantidad', celda: (m) => m.cant ?? '—', clase: 'text-right' },
  { titulo: 'Motivo', celda: (m) => m.motivo ?? '—' },
];

export function VerVisita() {
  const id = Number(useParams().id);
  const consulta = useQuery({ queryKey: ['visita', id], queryFn: () => verVisita(id), enabled: Number.isInteger(id) });
  const [foto, setFoto] = useState<number | null>(null);
  const { hasAccess } = useAccess();
  if (consulta.isPending && consulta.fetchStatus === 'paused') return <Vacio texto="Sin conexión: la inspección se mostrará al volver la señal." />;
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError || !consulta.data)
    return <CajaError error={consulta.error ?? new Error('Inspección no encontrada')} reintentar={() => void consulta.refetch()} />;
  const d = consulta.data;
  const v = d.datos;
  const fotos = d.fotos.map((f) => ({ src: urlFoto(d.id, f.orden, f.v), alt: f.observacion ?? `Foto ${f.orden}`, obs: f.observacion }));

  // Franja de datos de la inspección (como el encabezado del PDF).
  const rapidos: [string, string][] = [
    ['Fecha', v.fecha_visita ? fecha(`${v.fecha_visita}T12:00:00`) : '—'],
    ['Tipo de visita', v.tipo_visita ?? '—'],
    ['Llegada', v.hora_llegada ?? '—'],
    ['Salida', v.hora_salida ?? '—'],
    ['Energis', v.codigo_energis ?? '—'],
    ['Circuito', v.circuito ?? '—'],
  ];

  return (
    <div>
      <Encabezado
        volver
        titulo={`${v.codigo_energis ?? 'Inspección'}${v.circuito ? ` · ${v.circuito}` : ''}`}
        subtitulo={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <BadgeVisita estado={d.estado} />
            <span className="font-mono text-xs">{d.visita_num}</span>
            {d.registrado_en && (
              <span>
                · registrada {fechaHora(d.registrado_en)}
                {d.registrado_por ? ` por ${d.registrado_por}` : ''}
              </span>
            )}
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

      <dl className="tarjeta mb-4 grid grid-cols-3 divide-slate-100 sm:grid-cols-6">
        {rapidos.map(([t, valor]) => (
          <div key={t} className="px-3 py-2.5 text-center">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t}</dt>
            <dd className="truncate text-sm font-bold text-marca-900">{valor}</dd>
          </div>
        ))}
      </dl>

      {estructuraFicha(v).map((s) => (
        <Tarjeta key={s.titulo} titulo={s.titulo}>
          {s.bloques.map((b, i) => (
            <Bloque key={i} b={b} />
          ))}
        </Tarjeta>
      ))}

      {v.materiales.length > 0 && (
        <Tarjeta titulo="Materiales utilizados">
          <Tabla
            etiqueta="Materiales"
            filas={v.materiales}
            clave={(m) => `${m.codigo}-${m.desc}`}
            columnas={COLUMNAS_MATERIALES}
            tarjeta={(m) => (
              <>
                <p className="font-semibold text-slate-900">{m.desc}</p>
                <p className="text-xs text-slate-500">{[m.codigo, `${m.cant ?? ''} ${m.unidad ?? ''}`.trim(), m.motivo].filter(Boolean).join(' · ')}</p>
              </>
            )}
          />
          {v.obs_materiales && <Bloque b={{ tipo: 'textos', textos: [['Observación de materiales', v.obs_materiales]] }} />}
        </Tarjeta>
      )}

      <Tarjeta titulo={`Registro fotográfico (${fotos.length})`}>
        {fotos.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {fotos.map((f, i) => (
              <button key={f.src} type="button" className="overflow-hidden rounded-xl border border-slate-200 text-left" onClick={() => setFoto(i)}>
                <img src={f.src} alt={f.alt} loading="lazy" className="aspect-[4/3] w-full bg-slate-100 object-cover" />
                <p className="px-3 py-2 text-xs text-slate-600">
                  <span className="font-bold text-marca-900">Foto {i + 1}</span>
                  {f.obs ? ` · ${f.obs}` : ''}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Sin fotografías.</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Observaciones y personal">
        {v.obs_generales && <Bloque b={{ tipo: 'textos', textos: [['Observaciones generales', v.obs_generales]] }} />}
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Cargo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {v.personal.map((p, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-semibold text-slate-900">{p.nombre}</td>
                  <td className="px-3 py-2 text-slate-600">{p.cargo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {hasAccess([PermisosVisitas.Eliminar]) && <BotonEliminar id={d.id} folio={d.visita_num} />}

      {foto !== null && <VisorFotos fotos={fotos} inicial={foto} onCerrar={() => setFoto(null)} />}
    </div>
  );
}
