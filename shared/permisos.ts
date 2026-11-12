/**
 * Permisos del sistema con la convención del SSO de TI: utcd_<sistema>_<modulo>_<accion>.
 * Es la única fuente de los códigos: el servidor (cada endpoint) y la app (menú, rutas, botones)
 * importan de aquí, así coinciden letra por letra. Al migrar al stack de TI se copian tal cual a
 * Permisos.cs, al seeder del SSO y a permisos.ts de cada módulo.
 *
 * Los roles solo agrupan permisos: el código nunca pregunta por un rol.
 */
import type { Rol } from './constantes';

export const SISTEMA = 'utcd_restauradores';

/**
 * Visitas de inspección. Registrar: llenar y guardar hojas de visita. Las visitas propias se ven sin
 * permiso adicional (rutas /mios); Consultar permite ver las de todos.
 */
export const PermisosVisitas = {
  Registrar: 'utcd_restauradores_visitas_registrar',
  Consultar: 'utcd_restauradores_visitas_consultar',
  Exportar: 'utcd_restauradores_visitas_exportar',
} as const;

/** Usuarios y solicitudes de cuenta (al migrar lo reemplaza el SSO). */
export const PermisosUsuarios = {
  Gestionar: 'utcd_restauradores_usuarios_gestionar',
} as const;

/**
 * Catálogos de la hoja de inspección (restauradores, materiales, personal, tipos, marcas, tableros) y zona
 * horaria. Al migrar los reemplaza el servicio de Parámetros.
 */
export const PermisosCatalogos = {
  Gestionar: 'utcd_restauradores_catalogos_gestionar',
} as const;

export type Permiso =
  | (typeof PermisosVisitas)[keyof typeof PermisosVisitas]
  | (typeof PermisosUsuarios)[keyof typeof PermisosUsuarios]
  | (typeof PermisosCatalogos)[keyof typeof PermisosCatalogos];

/** Módulos con sus permisos y nombres (lo que registraría el seeder del SSO). */
export const MODULOS: { codigo: string; nombre: string; permisos: { codigo: Permiso; nombre: string }[] }[] = [
  {
    codigo: 'utcd_restauradores_visitas',
    nombre: 'Inspecciones',
    permisos: [
      { codigo: PermisosVisitas.Registrar, nombre: 'Registrar inspecciones' },
      { codigo: PermisosVisitas.Consultar, nombre: 'Consultar las inspecciones de todos' },
      { codigo: PermisosVisitas.Exportar, nombre: 'Exportar inspecciones a CSV' },
    ],
  },
  {
    codigo: 'utcd_restauradores_usuarios',
    nombre: 'Usuarios',
    permisos: [{ codigo: PermisosUsuarios.Gestionar, nombre: 'Gestionar usuarios y solicitudes de cuenta' }],
  },
  {
    codigo: 'utcd_restauradores_catalogos',
    nombre: 'Catálogos',
    permisos: [{ codigo: PermisosCatalogos.Gestionar, nombre: 'Gestionar catálogos de la hoja de inspección y zona horaria' }],
  },
];

export const TODOS_LOS_PERMISOS: Permiso[] = MODULOS.flatMap((m) => m.permisos.map((p) => p.codigo));

/** Roles del sistema (utcd_<sistema>_<perfil>): solo agrupan permisos. */
export const ROLES_SISTEMA: { codigo: string; nombre: string; perfil: Rol; permisos: Permiso[] }[] = [
  { codigo: 'utcd_restauradores_administrador', nombre: 'Administrador', perfil: 'admin', permisos: TODOS_LOS_PERMISOS },
  {
    codigo: 'utcd_restauradores_supervisor',
    nombre: 'Supervisor',
    perfil: 'supervisor',
    permisos: [PermisosVisitas.Registrar, PermisosVisitas.Consultar, PermisosVisitas.Exportar],
  },
  { codigo: 'utcd_restauradores_tecnico', nombre: 'Técnico', perfil: 'tecnico', permisos: [PermisosVisitas.Registrar] },
];

/** Rol del sistema que corresponde a cada perfil de usuario. */
export const rolDePerfil = (perfil: Rol) => ROLES_SISTEMA.find((r) => r.perfil === perfil)!.codigo;

/** ¿Tiene al menos uno de los permisos? (lista vacía = basta con iniciar sesión). */
export const tieneAcceso = (permisos: readonly string[], requeridos: readonly Permiso[]) =>
  requeridos.length === 0 || requeridos.some((p) => permisos.includes(p));
