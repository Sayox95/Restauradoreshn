import { RefreshCcw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { iniciarActualizaciones, revisarActualizacion } from '@/common/pwa/pwa';
import { alCambiarTrabajo, hayTrabajoEnCurso } from '@/common/pwa/trabajo';

/**
 * Hay algo que no debe interrumpirse al recargar: una visita en curso (la marca el formulario), una
 * ventana abierta o un texto escrito en un campo. Las fechas, casillas y buscadores no cuentan.
 */
function hayTrabajoSinGuardar() {
  if (hayTrabajoEnCurso()) return true;
  if (document.querySelector('[aria-modal="true"]')) return true;
  return [
    ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'textarea, input[type=text], input[type=number], input[type=tel], input[type=email], input[type=password], input:not([type])',
    ),
  ].some((c) => c.value.trim() !== '' && c.inputMode !== 'search');
}

/**
 * Cuando la versión nueva toma el control, muestra «Actualizando…» un instante y recarga («momento
 * tranquilo»). Si hay una visita en curso, muestra el aviso y la versión nueva se aplica al terminarla
 * (guardarla o descartarla); nunca se recarga encima de lo escrito.
 */
export function ActualizacionAutomatica() {
  const [hayNueva, setHayNueva] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [enCurso, setEnCurso] = useState(hayTrabajoEnCurso());
  useEffect(() => iniciarActualizaciones(() => setHayNueva(true)), []);
  useEffect(() => alCambiarTrabajo(() => setEnCurso(hayTrabajoEnCurso())), []);

  const ruta = useLocation().pathname;
  // Cambiar de sección es uno de los eventos en que se revisa si hay versión nueva.
  useEffect(() => revisarActualizacion(), [ruta]);
  useEffect(() => {
    if (!hayNueva) return;
    let hecho = false;
    const recargarSiSeguro = () => {
      if (hecho || hayTrabajoSinGuardar()) return;
      hecho = true;
      setActualizando(true);
      setTimeout(() => window.location.reload(), 1200); // deja ver el aviso un instante
    };
    recargarSiSeguro();
    // Mientras espera: al cerrarse una ventana (cambia el DOM) o al pasar a otra app.
    let pendiente = 0;
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(recargarSiSeguro);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const alOcultar = () => document.visibilityState === 'hidden' && recargarSiSeguro();
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      hecho = true;
      obs.disconnect();
      cancelAnimationFrame(pendiente);
      document.removeEventListener('visibilitychange', alOcultar);
    };
  }, [hayNueva, ruta, enCurso]);

  if (hayNueva && enCurso && !actualizando)
    return (
      <div className="fixed inset-x-0 top-14 z-[55] flex justify-center px-4 pt-2" role="status">
        <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-marca-900 px-4 py-2.5 text-sm text-white shadow-lg">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">Hay una versión nueva. Se aplicará al terminar la inspección.</span>
        </div>
      </div>
    );
  if (!actualizando) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(9.25rem+env(safe-area-inset-bottom))] z-[55] flex justify-center px-4 lg:bottom-4" role="status">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-marca-900 px-4 py-3 text-sm text-white shadow-lg">
        <RefreshCcw className="h-4 w-4 animate-spin" aria-hidden />
        <span className="flex-1">Actualizando a la versión nueva…</span>
      </div>
    </div>
  );
}
