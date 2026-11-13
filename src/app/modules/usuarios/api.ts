/** Llamadas HTTP del módulo Usuarios (ruta base /api/v1/usuarios). */
import type { EstadoCuenta, Rol } from '@shared/constantes';
import { get, patch, post } from '@/common/http/api';

const BASE = '/api/v1/usuarios';

export interface Usuario {
  id: number;
  usuario: string;
  correo: string | null;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  /** Permisos efectivos (los del perfil o, si es personalizado, los suyos). */
  permisos: string[];
  permisos_personalizados: boolean;
  cargo_id: number | null;
  /** Nombre del cargo (catálogo). */
  cargo: string | null;
  estado: EstadoCuenta;
  debe_cambiar_password: boolean;
  creado_en: string;
  ultimo_ingreso_en: string | null;
}

export interface EventoCuenta {
  id: number;
  accion: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  creado_en: string;
  por: string | null;
}

export interface DetalleUsuario extends Usuario {
  sesiones_activas: number;
  visitas_registradas: number;
  historial: EventoCuenta[];
}

export interface DatosUsuario {
  correo: string;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  permisos: string[];
  cargo_id: number | null;
}

export const listarUsuarios = () => get<Usuario[]>(BASE);
/** Cargos activos del catálogo para elegir en la cuenta. */
export const listarCargos = () => get<{ id: number; nombre: string }[]>(`${BASE}/cargos`);
export const verUsuario = (id: number) => get<DetalleUsuario>(`${BASE}/${id}`);
export const crearUsuario = (datos: DatosUsuario) => post<{ id: number; usuario: string; password_temporal: string }>(BASE, datos);
/** Las cuentas antiguas pueden no tener correo: entonces no se envía. */
export const editarUsuario = (id: number, datos: Omit<DatosUsuario, 'correo'> & { correo?: string }) => patch(`${BASE}/${id}`, datos);
export const aprobarCuenta = (id: number, datos: { rol: Rol; permisos: string[] }) => post(`${BASE}/${id}/aprobar`, datos);
export const rechazarCuenta = (id: number, motivo?: string) => post(`${BASE}/${id}/rechazar`, { motivo });
export const desactivarCuenta = (id: number, motivo?: string) => post(`${BASE}/${id}/desactivar`, { motivo });
export const activarCuenta = (id: number) => post(`${BASE}/${id}/activar`);
export const restablecerPassword = (id: number) => post<{ password_temporal: string }>(`${BASE}/${id}/restablecer-password`);
export const cerrarSesionesDe = (id: number) => post<{ cerradas: number }>(`${BASE}/${id}/cerrar-sesiones`);
