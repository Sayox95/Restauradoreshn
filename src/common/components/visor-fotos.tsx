import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Muestra fotos a pantalla completa en la misma ventana. Con varias fotos se pasa con las flechas,
 * el teclado (← →) o deslizando el dedo. Se cierra con la X, Escape o tocando fuera de la foto.
 *
 * Carga progresiva (como las galerías de los teléfonos): al pasar de foto se ve al instante su copia
 * reducida (`previa`, ya descargada en la pantalla de atrás) y encima se carga el original, que la
 * reemplaza con un fundido al terminar. Mientras se mira una foto se adelanta el original de la
 * siguiente. Así el cambio de foto nunca se queda «pegado» esperando un archivo de varios MB.
 */
export function VisorFotos({
  fotos,
  inicial,
  onCerrar,
}: {
  /** `src`: la foto completa; `previa`: su copia reducida para mostrar mientras carga (opcional). */
  fotos: { src: string; previa?: string | null; alt: string }[];
  inicial: number;
  onCerrar: () => void;
}) {
  const [i, setI] = useState(inicial);
  const toque = useRef<number | null>(null);
  const n = fotos.length;
  const mover = (d: number) => setI(x => (x + d + n) % n);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  // Originales ya descargados (para no volver a mostrar la previa al regresar a una foto).
  const [listas, setListas] = useState<Set<string>>(() => new Set());
  const marcarLista = (src: string) =>
    setListas(l => (l.has(src) ? l : new Set(l).add(src)));

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current();
      if (e.key === 'ArrowLeft') setI(x => (x - 1 + n) % n);
      if (e.key === 'ArrowRight') setI(x => (x + 1) % n);
    };
    document.addEventListener('keydown', teclas);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', teclas);
      document.body.style.overflow = '';
    };
  }, [n]);

  const foto = fotos[i];
  const lista = !!foto && listas.has(foto.src);
  // Con la foto actual lista, se adelanta la descarga del original de la siguiente.
  const siguiente = n > 1 ? fotos[(i + 1) % n]?.src : undefined;
  useEffect(() => {
    if (!lista || !siguiente || listas.has(siguiente)) return;
    const img = new Image();
    img.onload = () => marcarLista(siguiente);
    img.src = siguiente;
  }, [lista, siguiente, listas]);

  if (!foto) return null;
  const flecha =
    'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70';
  return (
    <div
      className="anim-fondo fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Fotografía"
      onClick={onCerrar}
      onTouchStart={e => (toque.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={e => {
        const x = e.changedTouches[0]?.clientX;
        if (
          toque.current !== null &&
          x !== undefined &&
          n > 1 &&
          Math.abs(x - toque.current) > 50
        )
          mover(x < toque.current ? 1 : -1);
        toque.current = null;
      }}
    >
      {/* La clave por foto evita que quede a la vista la anterior mientras carga la nueva. */}
      <div
        key={foto.src}
        className="relative"
        onClick={e => e.stopPropagation()}
      >
        {/* La copia queda siempre debajo: el original aparece encima con un fundido, sin parpadeo. */}
        {foto.previa && (
          <img
            src={foto.previa}
            alt=""
            aria-hidden
            className="max-h-[88dvh] max-w-[94vw] rounded-lg object-contain"
          />
        )}
        <img
          src={foto.src}
          alt={foto.alt}
          decoding="async"
          onLoad={() => marcarLista(foto.src)}
          className={`max-h-[88dvh] max-w-[94vw] rounded-lg object-contain transition-opacity duration-200 motion-reduce:transition-none ${
            foto.previa ? 'absolute inset-0 h-full w-full' : ''
          } ${lista ? 'opacity-100' : 'opacity-0'}`}
        />
        {!lista && (
          <p className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {foto.previa ? 'Cargando la foto completa' : 'Cargando la foto'}
          </p>
        )}
      </div>
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
            onClick={e => {
              e.stopPropagation();
              mover(-1);
            }}
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            className={`${flecha} right-3`}
            onClick={e => {
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
