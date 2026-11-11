/**
 * Señal de «hay trabajo en curso» (p. ej. una visita a medio llenar). Mientras esté activa, la versión
 * nueva de la app no se aplica: se muestra el aviso y se aplica al terminar.
 */
const fuentes = new Set<string>();
const oyentes = new Set<() => void>();

export function marcarTrabajo(fuente: string, activo: boolean) {
  const antes = fuentes.size;
  if (activo) fuentes.add(fuente);
  else fuentes.delete(fuente);
  if (fuentes.size !== antes) oyentes.forEach((f) => f());
}

export const hayTrabajoEnCurso = () => fuentes.size > 0;

export function alCambiarTrabajo(fn: () => void) {
  oyentes.add(fn);
  return () => void oyentes.delete(fn);
}
