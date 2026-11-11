import { Bell, CheckCircle2, X } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';

interface Aviso {
  id: number;
  texto: string;
  /** info: notificación de algo que hizo otra persona. */
  tipo: 'exito' | 'error' | 'info';
  accion?: { texto: string; fn: () => void };
}

const Ctx = createContext<(texto: string, opciones?: Partial<Omit<Aviso, 'id' | 'texto'>>) => void>(() => {});

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const sig = useRef(1);
  const quitar = (id: number) => setAvisos((a) => a.filter((x) => x.id !== id));
  const avisar = useCallback((texto: string, opciones: Partial<Omit<Aviso, 'id' | 'texto'>> = {}) => {
    const id = sig.current++;
    setAvisos((a) => [...a.slice(-2), { id, texto, tipo: opciones.tipo ?? 'exito', accion: opciones.accion }]);
    setTimeout(() => quitar(id), opciones.accion ? 8000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`anim-aviso pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${a.tipo === 'error' ? 'bg-rose-400' : a.tipo === 'info' ? 'bg-marca-900' : 'bg-slate-900'}`}
            role={a.tipo === 'info' ? 'status' : undefined}
          >
            {a.tipo === 'exito' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />}
            {a.tipo === 'info' && <Bell className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />}
            <span className="flex-1">{a.texto}</span>
            {a.accion && (
              <button
                className="rounded-lg bg-white/15 px-3 py-1.5 font-semibold"
                onClick={() => {
                  a.accion!.fn();
                  quitar(a.id);
                }}
              >
                {a.accion.texto}
              </button>
            )}
            <button onClick={() => quitar(a.id)} aria-label="Cerrar aviso" className="text-white/70">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useAvisos = () => useContext(Ctx);
