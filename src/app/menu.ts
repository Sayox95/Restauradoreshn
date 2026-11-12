/** Menú principal (un solo nivel) y opciones de «+ Nueva», armados con lo que declara cada módulo. */
import { PermisosCatalogos, PermisosUsuarios } from '@shared/permisos';
import { FilePlus2, Settings } from 'lucide-react';
import type { OpcionMenu, OpcionNueva } from '@/common/menu/tipos';
import { urlAdministracion } from '@/app/administracion/urls';
import { urlNueva } from '@/app/nueva/urls';
import { menuVisitas, nuevasVisitas } from '@/app/modules/visitas';

/** Administración se muestra a quien tenga alguna de sus secciones. */
export const accesoAdministracion = [PermisosUsuarios.Gestionar, PermisosCatalogos.Gestionar];

/** Tipos de registro que se pueden empezar (hoy la inspección de restaurador; después, otros). */
export const opcionesNueva: OpcionNueva[] = [...nuevasVisitas];
/** «+ Nueva» se muestra a quien pueda empezar alguno. */
export const accesoNueva = [...new Set(opcionesNueva.flatMap((o) => o.access))];

export const menuPrincipal: OpcionMenu[] = [
  ...menuVisitas,
  { a: urlNueva, texto: 'Nueva', icono: FilePlus2, access: accesoNueva },
  { a: urlAdministracion, texto: 'Administración', corto: 'Admin', icono: Settings, access: accesoAdministracion },
];
