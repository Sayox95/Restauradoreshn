/**
 * «Modo captura»: mientras se llena un formulario largo (p. ej. una inspección) se oculta la barra del
 * menú para dar espacio y evitar toques por error. La pantalla que captura lo activa y lo apaga al
 * terminar (la pantalla final ya no es captura).
 */
import { useEffect, useState } from 'react';

let activo = false;
const oyentes = new Set<(v: boolean) => void>();

export function fijarModoCaptura(v: boolean) {
  if (activo === v) return;
  activo = v;
  oyentes.forEach((f) => f(v));
}

export function useModoCaptura() {
  const [v, setV] = useState(activo);
  useEffect(() => {
    oyentes.add(setV);
    return () => void oyentes.delete(setV);
  }, []);
  return v;
}
