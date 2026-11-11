/** Sesión (ruta base /api/v1/sesion). Al migrar, la reemplaza el SSO de TI. */
import type { UsuarioSesion } from '@shared/tipos';
import { get, post } from '@/common/http/api';

const BASE = '/api/v1/sesion';

export const quienSoy = () => get<{ usuario: UsuarioSesion; zona_horaria: string } | null>(`${BASE}/yo`);
export const iniciarSesion = (usuario: string, password: string) => post(`${BASE}/login`, { usuario, password });
export const solicitarCuenta = (datos: { nombre: string; correo: string; telefono: string; password: string }) =>
  post<{ ok: true; usuario: string }>(`${BASE}/solicitar-cuenta`, datos);
export const cambiarPassword = (actual: string, nueva: string) => post(`${BASE}/cambiar-password`, { actual, nueva });
/** Con `todas`, cierra también los demás dispositivos. */
export const cerrarSesion = (todas = false) => post(`${BASE}/logout${todas ? '?todas=1' : ''}`);
export const URL_LOGIN = `${BASE}/login`;
