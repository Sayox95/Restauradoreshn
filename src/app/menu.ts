/** Menú principal (un solo nivel), armado con las opciones de cada módulo. */
import { PermisosCatalogos, PermisosUsuarios } from '@shared/permisos';
import { Settings } from 'lucide-react';
import type { OpcionMenu } from '@/common/menu/tipos';
import { urlAdministracion } from '@/app/administracion/urls';
import { menuVisitas } from '@/app/modules/visitas';

/** Administración se muestra a quien tenga alguna de sus secciones. */
export const accesoAdministracion = [PermisosUsuarios.Gestionar, PermisosCatalogos.Gestionar];

export const menuPrincipal: OpcionMenu[] = [
  ...menuVisitas,
  { a: urlAdministracion, texto: 'Administración', corto: 'Admin', icono: Settings, access: accesoAdministracion },
];
