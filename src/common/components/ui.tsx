import { ESTADO_VISITA_ETIQUETA, type EstadoVisita } from '@shared/constantes';
import { AlertTriangle, ChevronLeft, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { mensajeError } from '@/common/http/api';
import { TONO_ESTADO_VISITA } from '@/common/tonos';

export function BadgeVisita({ estado }: { estado: EstadoVisita }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONO_ESTADO_VISITA[estado].etiqueta}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TONO_ESTADO_VISITA[estado].punto}`} aria-hidden />
      {ESTADO_VISITA_ETIQUETA[estado]}
    </span>
  );
}

/** Esqueleto de carga (lineamiento UX): bloques con la forma del contenido hasta tener todos los datos. */
export function Cargando({ texto = 'Cargando…', filas = 3 }: { texto?: string; filas?: number }) {
  return (
    <div className="animate-pulse space-y-3 py-4" role="status" aria-label={texto}>
      <div className="h-6 w-1/3 rounded-lg bg-slate-200" />
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-slate-200/70" />
      ))}
      <span className="sr-only">{texto}</span>
    </div>
  );
}

export function CajaError({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">
        <p>{mensajeError(error)}</p>
        {reintentar && (
          <button className="mt-1 font-semibold underline" onClick={reintentar}>
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}

export function Vacio({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-slate-500">
      <Inbox className="h-8 w-8 text-slate-300" aria-hidden />
      <p>{texto}</p>
      {children}
    </div>
  );
}

export function Encabezado({ titulo, volver, accion, subtitulo }: { titulo: string; volver?: boolean; accion?: ReactNode; subtitulo?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="mb-4 flex items-start gap-2">
      {volver && (
        <button
          onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200"
          aria-label="Volver"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <div className="min-w-0 flex-1 pt-1.5">
        <h1 className="truncate text-xl font-bold text-slate-900">{titulo}</h1>
        {subtitulo && <div className="mt-0.5 text-sm text-slate-500">{subtitulo}</div>}
      </div>
      {accion}
    </div>
  );
}

export function Seccion({ titulo, accion, children, className = '' }: { titulo: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-5 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function Segmentado<T extends string | number>({
  opciones,
  valor,
  onChange,
  etiqueta,
}: {
  opciones: { valor: T; texto: string }[];
  valor: T;
  onChange: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex shrink-0 rounded-xl bg-slate-200/70 p-1">
      {opciones.map((o) => (
        <button
          key={String(o.valor)}
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={`min-h-[36px] whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition ${valor === o.valor ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/** Paginación común: «Anterior · Página n de m · Siguiente» (no se muestra con una sola página). */
export function Paginacion({
  pagina,
  paginas,
  onCambiar,
  className = 'mt-4',
}: {
  pagina: number;
  paginas: number;
  onCambiar: (p: number) => void;
  className?: string;
}) {
  if (paginas <= 1) return null;
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <button className="btn-secundario" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
        Anterior
      </button>
      <span className="text-sm text-slate-600">
        Página {pagina} de {paginas}
      </span>
      <button className="btn-secundario" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>
        Siguiente
      </button>
    </div>
  );
}
