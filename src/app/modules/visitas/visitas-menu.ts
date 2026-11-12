import { ClipboardList, Zap } from 'lucide-react';
import type { OpcionMenu, OpcionNueva } from '@/common/menu/tipos';
import { fechaHora } from '@/common/utils/fechas';
import { leerBorrador } from './components/almacen';
import { PermisosVisitas } from './permisos';
import { urlInspecciones, urlNuevaVisita } from './urls';

// Una sola sección de inspecciones: con «Consultar» muestra las de todos; sin él, las que registró la
// persona (lo propio, sin permiso adicional).
export const menuVisitas: OpcionMenu[] = [
  {
    a: urlInspecciones,
    texto: 'Inspecciones y registros',
    corto: 'Inspecciones',
    icono: ClipboardList,
    access: [PermisosVisitas.Registrar, PermisosVisitas.Consultar],
  },
];

/** Lo que este módulo permite empezar desde «+ Nueva». */
export const nuevasVisitas: OpcionNueva[] = [
  {
    a: urlNuevaVisita,
    texto: 'Inspección de restaurador',
    descripcion: 'Hoja de inspección del restaurador, su control, módems y estado físico.',
    icono: Zap,
    access: [PermisosVisitas.Registrar],
    enCurso: async () => {
      const g = await leerBorrador().catch(() => undefined);
      if (!g) return null;
      const energis = (g.datos as Record<string, unknown>).codigo_energis;
      return `${energis ? `${String(energis)} · ` : ''}guardada ${fechaHora(g.guardado_en)}`;
    },
  },
];
