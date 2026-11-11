/**
 * Notificador global (lineamientos: «un notificador global montado junto al layout»): muestra las
 * notificaciones dirigidas a este usuario, esté en la sección que esté, con un botón para abrir lo que cambió.
 */
import type { Notificacion } from '@shared/tiempo-real';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAvisos } from '@/common/components/Toast';
import { escucharNotificaciones } from '@/common/tiempo-real/canal';
import { urlVisita } from '@/app/modules/visitas/urls';
import { urlUsuarios } from '@/app/modules/usuarios/urls';

/** A qué pantalla lleva cada notificación. */
const destino = (n: Notificacion) => (n.modulo === 'visitas' && n.id ? urlVisita(n.id) : n.modulo === 'usuarios' ? urlUsuarios : null);

export function Notificaciones() {
  const avisar = useAvisos();
  const navegar = useNavigate();
  useEffect(
    () =>
      escucharNotificaciones((n) => {
        const url = destino(n);
        avisar(n.mensaje, { tipo: 'info', accion: url ? { texto: 'Ver', fn: () => navegar(url) } : undefined });
        // Una vibración corta en el teléfono (quien está en campo puede no estar mirando la pantalla).
        navigator.vibrate?.(120);
      }),
    [avisar, navegar],
  );
  return null;
}
