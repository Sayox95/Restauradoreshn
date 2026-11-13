/**
 * Permisos del sistema con la convención del SSO de TI: utcd_<sistema>_<modulo>_<accion>.
 * Es la única fuente de los códigos: el servidor (cada endpoint) y la app (menú, rutas, botones)
 * importan de aquí, así coinciden letra por letra. Al migrar al stack de TI se copian tal cual a
 * Permisos.cs, al seeder del SSO y a permisos.ts de cada módulo.
 *
 * Los roles solo agrupan permisos: el código nunca pregunta por un rol.
 */
import { ROL_ETIQUETA, type Rol } from './constantes';

export const SISTEMA = 'utcd_restauradores';

/**
 * Visitas de inspección. Registrar: llenar y guardar hojas de visita. Las visitas propias se ven sin
 * permiso adicional (rutas /mios); Consultar permite ver las de todos.
 */
export const PermisosVisitas = {
  Registrar: 'utcd_restauradores_visitas_registrar',
  Consultar: 'utcd_restauradores_visitas_consultar',
  Exportar: 'utcd_restauradores_visitas_exportar',
  /** Ocultar una inspección registrada (queda en la base con quién, cuándo y por qué). */
  Eliminar: 'utcd_restauradores_visitas_eliminar',
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
      { codigo: PermisosVisitas.Eliminar, nombre: 'Eliminar inspecciones' },
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
 * Roles del sistema: uno por perfil. El rol es la plantilla de permisos de la cuenta; al asignar el
 * acceso se pueden marcar o desmarcar permisos uno por uno (la cuenta queda «personalizada»). `nivel`
 * ordena los perfiles: al armar el personal de una inspección se ofrecen las cuentas del mismo nivel o
 * menor (un dato del perfil, no una pregunta por el rol en el código).
 */
export interface RolSistema {
  codigo: string;
  nombre: string;
  perfil: Rol;
  nivel: number;
  permisos: Permiso[];
}
export const ROLES_SISTEMA: RolSistema[] = [
  { codigo: 'utcd_restauradores_tecnico', nombre: 'Técnico', perfil: 'tecnico', nivel: 1, permisos: [PermisosVisitas.Registrar] },
  {
    codigo: 'utcd_restauradores_supervisor',
    nombre: 'Supervisor',
    perfil: 'supervisor',
    nivel: 2,
    permisos: [PermisosVisitas.Registrar, PermisosVisitas.Consultar, PermisosVisitas.Exportar],
  },
  { codigo: 'utcd_restauradores_administrador', nombre: 'Administrador', perfil: 'admin', nivel: 3, permisos: TODOS_LOS_PERMISOS },
];

const rolSistema = (perfil: Rol) => ROLES_SISTEMA.find((r) => r.perfil === perfil)!;

/** Rol del sistema que corresponde a un perfil. */
export const rolDePerfil = (perfil: Rol) => rolSistema(perfil).codigo;

/** Nivel del perfil (técnico 1, supervisor 2, administrador 3). */
export const nivelDePerfil = (perfil: Rol) => rolSistema(perfil).nivel;

/** Permisos que trae un perfil (la plantilla al asignar acceso a una cuenta). */
export const permisosDePerfil = (perfil: Rol): Permiso[] => [...rolSistema(perfil).permisos];

/** ¿Los permisos elegidos son exactamente los del perfil? (si no, la cuenta tiene permisos a la medida). */
export const igualAlPerfil = (perfil: Rol, permisos: readonly string[]) => {
  const p = new Set<string>(permisosDePerfil(perfil));
  const elegidos = new Set(permisos);
  return p.size === elegidos.size && [...p].every((x) => elegidos.has(x));
};

/** Perfil en palabras para listas: «Supervisor» o «Supervisor (personalizado)». */
export const resumenAcceso = (rol: Rol, personalizado: boolean) => `${ROL_ETIQUETA[rol] ?? rol}${personalizado ? ' (personalizado)' : ''}`;

/** ¿Tiene al menos uno de los permisos? (lista vacía = basta con iniciar sesión). */
export const tieneAcceso = (permisos: readonly string[], requeridos: readonly Permiso[]) =>
  requeridos.length === 0 || requeridos.some((p) => permisos.includes(p));
