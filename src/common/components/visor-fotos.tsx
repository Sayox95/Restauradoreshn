import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Muestra fotos a pantalla completa en la misma ventana. Con varias fotos se pasa con las flechas,
 * el teclado (← →) o deslizando el dedo. Se cierra con la X, Escape o tocando fuera de la foto.
 */
export function VisorFotos({ fotos, inicial, onCerrar }: { fotos: { src: string; alt: string }[]; inicial: number; onCerrar: () => void }) {
  const [i, setI] = useState(inicial);
  const toque = useRef<number | null>(null);
  const n = fotos.length;
  const mover = (d: number) => setI((x) => (x + d + n) % n);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current();
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + n) % n);
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % n);
    };
    document.addEventListener('keydown', teclas);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', teclas);
      document.body.style.overflow = '';
    };
  }, [n]);

  const foto = fotos[i];
  if (!foto) return null;
  const flecha = 'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70';
  return (
    <div
      className="anim-fondo fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Fotografía"
      onClick={onCerrar}
      onTouchStart={(e) => (toque.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const x = e.changedTouches[0]?.clientX;
        if (toque.current !== null && x !== undefined && n > 1 && Math.abs(x - toque.current) > 50) mover(x < toque.current ? 1 : -1);
        toque.current = null;
      }}
    >
      <img src={foto.src} alt={foto.alt} className="max-h-[88dvh] max-w-[94vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      <button
        onClick={onCerrar}
        className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
        aria-label="Cerrar"
      >
        <X className="h-6 w-6" />
      </button>
      {n > 1 && (
        <>
          <button
            className={`${flecha} left-3`}
            onClick={(e) => {
              e.stopPropagation();
              mover(-1);
            }}
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            className={`${flecha} right-3`}
            onClick={(e) => {
              e.stopPropagation();
              mover(1);
            }}
            aria-label="Foto siguiente"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
          <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] rounded-full bg-black/50 px-3 py-1 text-sm font-semibold text-white">
            {i + 1} / {n}
          </p>
        </>
      )}
    </div>
  );
}
