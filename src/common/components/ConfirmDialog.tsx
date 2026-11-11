import { AlertTriangle } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface Opciones {
  titulo: string;
  mensaje?: string;
  /** Texto del botón que confirma (verbo de la acción: «Descartar», «Rechazar»…). */
  confirmar: string;
  /** Texto del botón que no confirma (por defecto «Cancelar»). */
  cancelar?: string;
  /** Acción destructiva: el botón se pinta en tono de alerta. */
  peligro?: boolean;
}

const Ctx = createContext<(o: Opciones) => Promise<boolean>>(async () => false);

/**
 * Diálogo de confirmación común (lineamiento UX): antes de toda acción irreversible.
 * Cerrarlo con clic afuera o Esc cuenta como cancelar. Uso: `if (await confirmar({...})) …`.
 */
export const useConfirmar = () => useContext(Ctx);

export function ProveedorConfirmacion({ children }: { children: ReactNode }) {
  const [pendiente, setPendiente] = useState<(Opciones & { responder: (si: boolean) => void }) | null>(null);
  const confirmar = useCallback((o: Opciones) => new Promise<boolean>((responder) => setPendiente({ ...o, responder })), []);
  const responder = (si: boolean) => {
    pendiente?.responder(si);
    setPendiente(null);
  };
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pendiente) return;
    boton.current?.focus();
    // En captura y sin propagar: Esc solo cancela este diálogo, no la ventana que haya detrás.
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      responder(false);
    };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  });

  return (
    <Ctx.Provider value={confirmar}>
      {children}
      {pendiente && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={pendiente.titulo}>
          <div className="anim-fondo absolute inset-0 bg-slate-900/40" onClick={() => responder(false)} aria-hidden />
          <div className="anim-dialogo relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex gap-3">
              {pendiente.peligro && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-hidden />}
              <div>
                <p className="font-semibold text-slate-900">{pendiente.titulo}</p>
                {pendiente.mensaje && <p className="mt-1 text-sm text-slate-600">{pendiente.mensaje}</p>}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secundario" onClick={() => responder(false)}>
                {pendiente.cancelar ?? 'Cancelar'}
              </button>
              <button ref={boton} className={pendiente.peligro ? 'btn-peligro' : 'btn-primario'} onClick={() => responder(true)}>
                {pendiente.confirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
