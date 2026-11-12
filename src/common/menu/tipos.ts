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

/**
 * Tipo de registro que se puede empezar desde «+ Nueva» (p. ej. «Inspección de restaurador»). Cada módulo
 * declara los suyos; la pantalla «Nueva» los reúne según los permisos de cada quien.
 */
export interface OpcionNueva {
  a: string;
  texto: string;
  descripcion: string;
  icono: LucideIcon;
  access: Permiso[];
  /** Si hay uno a medio llenar en el teléfono, su descripción corta (para mostrar «Continuar»). */
  enCurso?: () => Promise<string | null>;
}
