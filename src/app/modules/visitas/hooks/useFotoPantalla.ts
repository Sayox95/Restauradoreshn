import type { FotoVisita } from '@shared/tipos';
import { useEffect, useState } from 'react';
import { vistaReducida } from '@common/utils/imagen';
import { descargarFotoOriginal, urlFotoCopia } from '../api';

/**
 * Imagen que se muestra en pantalla para una foto de la inspección (E2: en pantalla, copia reducida; el
 * original solo a pedido). Si el servidor tiene la copia, su URL. Si no (inspecciones anteriores), se
 * descarga el original y se achica fuera del hilo principal, para que el scroll no se trabe.
 */
export function useFotoPantalla(idVisita: number, foto: FotoVisita) {
  const [src, setSrc] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const { orden, v, copia } = foto;
  useEffect(() => {
    setFallo(false);
    if (copia) {
      setSrc(urlFotoCopia(idVisita, orden, v));
      return;
    }
    setSrc(null);
    let vivo = true;
    let local: string | null = null;
    descargarFotoOriginal(idVisita, orden, v)
      .then((blob) => vistaReducida(blob))
      .then((u) => {
        if (!vivo) return u && URL.revokeObjectURL(u);
        local = u;
        if (u) setSrc(u);
        else setFallo(true);
      })
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
      if (local) URL.revokeObjectURL(local);
    };
  }, [idVisita, orden, v, copia]);
  return { src, fallo, marcarFallo: () => setFallo(true) };
}
