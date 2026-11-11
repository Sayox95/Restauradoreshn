import type { ModuloAviso } from '@shared/tiempo-real';
import { useEffect, useRef } from 'react';
import { escuchar, type Evento } from './canal';

/**
 * Hook por pantalla (lineamientos): decide si un aviso le interesa (por módulo) y recarga con 400 ms de
 * espera, para juntar varios avisos seguidos en una sola consulta. Tras reconectarse, recarga siempre.
 */
export function useTiempoReal(modulos: readonly ModuloAviso[], recargar: (e: Evento) => void) {
  const ultimo = useRef(recargar);
  useEffect(() => {
    ultimo.current = recargar;
  });
  const clave = modulos.join(',');
  useEffect(() => {
    const interesan = clave.split(',');
    let espera: ReturnType<typeof setTimeout> | undefined;
    const quitar = escuchar((e) => {
      if (e !== 'reconectado' && !interesan.includes(e.modulo)) return;
      clearTimeout(espera);
      espera = setTimeout(() => ultimo.current(e), 400);
    });
    return () => {
      quitar();
      clearTimeout(espera);
    };
  }, [clave]);
}
