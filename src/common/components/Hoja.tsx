import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Hoja inferior en móvil / diálogo centrado en pantallas grandes. */
export function Hoja({
  abierta,
  onCerrar,
  titulo,
  children,
  pie,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // La función de cierre puede cambiar en cada render (p. ej. la pantalla se redibuja cada minuto):
  // se usa la última sin reinstalar el efecto, que devolvería el foco y cortaría lo que se escribe.
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    if (!abierta) return;
    const previo = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current();
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
      previo?.focus?.();
    };
  }, [abierta]);
  if (!abierta) return null;
  // Se dibuja en <body>: así queda encima de todo aunque se abra dentro de un panel fijo (sticky).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="anim-fondo absolute inset-0 bg-slate-900/50" onClick={onCerrar} aria-hidden />
      <div ref={ref} className="anim-hoja relative flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <h2 className="flex-1 text-lg font-bold">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto px-5 pt-4 ${pie ? 'pb-4' : 'pb-pie'}`}>{children}</div>
        {pie && <div className="pb-pie border-t border-slate-100 px-5 pt-3">{pie}</div>}
      </div>
    </div>,
    document.body,
  );
}
