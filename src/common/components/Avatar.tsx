/** Iniciales para el avatar (Juan Pérez → JP). */
export const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export function Avatar({
  nombre,
  tamano = 'normal',
  className = 'bg-marca-100 text-marca-700',
}: {
  nombre: string;
  tamano?: 'chico' | 'normal' | 'grande';
  className?: string;
}) {
  const medida = { chico: 'h-8 w-8 text-xs', normal: 'h-10 w-10 text-sm', grande: 'h-16 w-16 text-xl' }[tamano];
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-bold ${medida} ${className}`} aria-hidden>
      {iniciales(nombre) || '?'}
    </span>
  );
}
