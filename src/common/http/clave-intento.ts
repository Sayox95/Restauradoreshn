import { useRef } from 'react';

/**
 * Clave Idempotency-Key de un formulario que crea algo (lineamientos v2 §7, «doble clic»): la misma
 * mientras se reintenta (doble toque, señal que se corta) y una nueva después de crear con éxito.
 */
export function useClaveIntento() {
  const clave = useRef(crypto.randomUUID());
  return {
    clave: () => clave.current,
    renovar: () => {
      clave.current = crypto.randomUUID();
    },
  };
}

/** Cabecera que acompaña a la clave. */
export const cabeceraIntento = (clave: string) => ({
  'Idempotency-Key': clave,
});
