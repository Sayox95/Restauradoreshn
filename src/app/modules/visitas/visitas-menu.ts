import { ClipboardList, FilePlus2, FolderSearch } from 'lucide-react';
import type { OpcionMenu } from '@/common/menu/tipos';
import { PermisosVisitas } from './permisos';
import { urlMisVisitas, urlNuevaVisita, urlVisitas } from './urls';

export const menuVisitas: OpcionMenu[] = [
  { a: urlNuevaVisita, texto: 'Nueva visita', corto: 'Nueva', icono: FilePlus2, access: [PermisosVisitas.Registrar] },
  // Lo propio: sin permiso adicional, cada quien ve las visitas que registró (y las que tiene sin enviar).
  { a: urlMisVisitas, texto: 'Mis visitas', corto: 'Mías', icono: ClipboardList, access: [PermisosVisitas.Registrar] },
  { a: urlVisitas, texto: 'Todas las visitas', corto: 'Todas', icono: FolderSearch, access: [PermisosVisitas.Consultar] },
];
