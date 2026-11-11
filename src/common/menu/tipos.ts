import type { Permiso } from '@shared/permisos';
import type { LucideIcon } from 'lucide-react';

/** Opción del menú (de un solo nivel): se muestra si el usuario tiene alguno de `access` (vacío = todos). */
export interface OpcionMenu {
  a: string;
  texto: string;
  /** Texto para la barra inferior del móvil, si `texto` no cabe. */
  corto?: string;
  icono: LucideIcon;
  access: Permiso[];
}
