import { ClipboardList, FilePlus2 } from 'lucide-react';
import type { OpcionMenu } from '@/common/menu/tipos';
import { PermisosVisitas } from './permisos';
import { urlInspecciones, urlNuevaVisita } from './urls';

// El primero es el inicio de la app. Una sola sección de inspecciones: con «Consultar» muestra las de
// todos; sin él, las que registró la persona (lo propio, sin permiso adicional).
export const menuVisitas: OpcionMenu[] = [
  {
    a: urlInspecciones,
    texto: 'Inspecciones y registros',
    corto: 'Inspecciones',
    icono: ClipboardList,
    access: [PermisosVisitas.Registrar, PermisosVisitas.Consultar],
  },
  { a: urlNuevaVisita, texto: 'Nueva visita', corto: 'Nueva', icono: FilePlus2, access: [PermisosVisitas.Registrar] },
];
