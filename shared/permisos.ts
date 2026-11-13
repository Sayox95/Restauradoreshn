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
 * Catálogos de la hoja de inspección (restauradores, materiales, tipos, marcas, tableros) y zona
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

/**
 * Roles del sistema, uno o más por usuario y a lo sumo uno por módulo (como en el SSO: a cada persona se le
 * habilita individualmente cada módulo). Los roles solo agrupan permisos. `nivel` ordena los roles de
 * Inspecciones: al armar el personal se ofrecen las cuentas del mismo nivel o menor (un dato del rol, no
 * una pregunta por el rol en el código).
 */
export interface RolSistema {
  codigo: string;
  nombre: string;
  /** Texto corto para listas («Supervisor», «Usuarios»…). */
  corto: string;
  /** Código del módulo (MODULOS) al que da acceso. */
  modulo: string;
  nivel?: number;
  permisos: Permiso[];
}
export const ROLES_SISTEMA: RolSistema[] = [
  {
    codigo: 'utcd_restauradores_tecnico',
    nombre: 'Técnico',
    corto: 'Técnico',
    modulo: 'utcd_restauradores_visitas',
    nivel: 1,
    permisos: [PermisosVisitas.Registrar],
  },
  {
    codigo: 'utcd_restauradores_supervisor',
    nombre: 'Supervisor',
    corto: 'Supervisor',
    modulo: 'utcd_restauradores_visitas',
    nivel: 2,
    permisos: [PermisosVisitas.Registrar, PermisosVisitas.Consultar, PermisosVisitas.Exportar],
  },
  {
    codigo: 'utcd_restauradores_admin_usuarios',
    nombre: 'Administrador de usuarios',
    corto: 'Usuarios',
    modulo: 'utcd_restauradores_usuarios',
    permisos: [PermisosUsuarios.Gestionar],
  },
  {
    codigo: 'utcd_restauradores_admin_catalogos',
    nombre: 'Administrador de catálogos',
    corto: 'Catálogos',
    modulo: 'utcd_restauradores_catalogos',
    permisos: [PermisosCatalogos.Gestionar],
  },
];
export const CODIGOS_ROL = ROLES_SISTEMA.map((r) => r.codigo) as [string, ...string[]];
const rolPorCodigo = (codigo: string) => ROLES_SISTEMA.find((r) => r.codigo === codigo);

/** Roles que correspondían a cada perfil antes de los roles por módulo (cuentas anteriores). */
export const ROLES_DE_PERFIL: Record<Rol, string[]> = {
  admin: ['utcd_restauradores_supervisor', 'utcd_restauradores_admin_usuarios', 'utcd_restauradores_admin_catalogos'],
  supervisor: ['utcd_restauradores_supervisor'],
  tecnico: ['utcd_restauradores_tecnico'],
};

/** Perfil de resumen que se guarda en usuarios.rol (solo para mostrar y compatibilidad; no da acceso). */
export function perfilDeRoles(roles: readonly string[]): Rol {
  if (roles.some((r) => (rolPorCodigo(r)?.permisos ?? []).some((p) => p === PermisosUsuarios.Gestionar || p === PermisosCatalogos.Gestionar))) return 'admin';
  return roles.some((r) => (rolPorCodigo(r)?.nivel ?? 0) >= 2) ? 'supervisor' : 'tecnico';
}

/** Nivel en Inspecciones (0 = sin acceso a Inspecciones). */
export const nivelDeRoles = (roles: readonly string[]) => Math.max(0, ...roles.map((r) => rolPorCodigo(r)?.nivel ?? 0));

/** ¿A lo sumo un rol por módulo? */
export const unRolPorModulo = (roles: readonly string[]) => {
  const modulos = roles.map((r) => rolPorCodigo(r)?.modulo);
  return new Set(modulos).size === modulos.length;
};

/** Accesos en palabras cortas («Supervisor · Usuarios · Catálogos»). */
export const resumenAccesos = (roles: readonly string[]) =>
  ROLES_SISTEMA.filter((r) => roles.includes(r.codigo))
    .map((r) => r.corto)
    .join(' · ') || 'Sin accesos';

/** ¿Tiene al menos uno de los permisos? (lista vacía = basta con iniciar sesión). */
export const tieneAcceso = (permisos: readonly string[], requeridos: readonly Permiso[]) =>
  requeridos.length === 0 || requeridos.some((p) => permisos.includes(p));
