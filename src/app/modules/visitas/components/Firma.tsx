import { Eraser } from 'lucide-react';
import { useEffect, useRef } from 'react';

/**
 * Firma dibujada con el dedo (PNG en data URL). El lienzo toma su tamaño al hacerse visible
 * (ResizeObserver) y conserva el trazo al cambiar de tamaño: si se mide oculto queda de 0 px y la
 * firma se pierde (trampa conocida).
 */
export function Firma({ valor, onCambio, falta }: { valor: string | null; onCambio: (v: string | null) => void; falta?: boolean }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const actual = useRef(valor);
  actual.current = valor;
  // La función puede cambiar en cada render: se usa la última sin reinstalar los eventos del lienzo.
  const avisar = useRef(onCambio);
  avisar.current = onCambio;

  useEffect(() => {
    const cv = lienzo.current!;
    const ctx = cv.getContext('2d')!;
    const ajustar = () => {
      const w = caja.current!.clientWidth;
      if (!w || (w === cv.width && cv.height === 160)) return;
      cv.width = w;
      cv.height = 160;
      if (actual.current) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = actual.current;
      }
    };
    ajustar();
    const obs = new ResizeObserver(ajustar);
    obs.observe(caja.current!);

    let dibujando = false;
    let trazo = false;
    let ultimo: [number, number] = [0, 0];
    const punto = (e: PointerEvent): [number, number] => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const bajar = (e: PointerEvent) => {
      dibujando = true;
      ultimo = punto(e);
      cv.setPointerCapture(e.pointerId);
    };
    const mover = (e: PointerEvent) => {
      if (!dibujando) return;
      const p = punto(e);
      ctx.strokeStyle = '#0f2b46';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(...ultimo);
      ctx.lineTo(...p);
      ctx.stroke();
      ultimo = p;
      trazo = true;
    };
    const subir = () => {
      if (dibujando && trazo) avisar.current(cv.toDataURL('image/png'));
      dibujando = false;
      trazo = false;
    };
    cv.addEventListener('pointerdown', bajar);
    cv.addEventListener('pointermove', mover);
    cv.addEventListener('pointerup', subir);
    cv.addEventListener('pointercancel', subir);
    return () => {
      obs.disconnect();
      cv.removeEventListener('pointerdown', bajar);
      cv.removeEventListener('pointermove', mover);
      cv.removeEventListener('pointerup', subir);
      cv.removeEventListener('pointercancel', subir);
    };
  }, []);

  const limpiar = () => {
    const cv = lienzo.current!;
    cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height);
    onCambio(null);
  };

  return (
    <div
      ref={caja}
      data-campo="firma_img"
      className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-white ${falta ? 'border-rose-400 bg-rose-50' : 'border-slate-300'}`}
    >
      <canvas ref={lienzo} className="block touch-none" aria-label="Firma del responsable" />
      {!valor && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">Firme aquí con el dedo</p>}
      <button type="button" onClick={limpiar} className="btn-secundario absolute right-2 top-2 min-h-[36px] px-3 text-sm">
        <Eraser className="h-4 w-4" /> Limpiar
      </button>
    </div>
  );
}
