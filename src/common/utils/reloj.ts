import { useEffect, useState } from 'react';
import { ahoraServidor } from '@/common/http/api';

/** Hora del servidor que se refresca cada minuto para los contadores "hace X". */
export function useAhora(intervaloMs = 60_000) {
  const [ahora, setAhora] = useState(ahoraServidor);
  useEffect(() => {
    const id = setInterval(() => setAhora(ahoraServidor()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}
