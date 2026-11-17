import { type Permiso } from '../../shared/permisos';
import { type Ctx } from './contexto';
import { json } from './http';

export type Manejador = (ctx: Ctx) => Promise<unknown>;
/**
 * Quién puede usar la ruta, como `.Access(Permisos.X)` del marco de TI: alguno de los permisos.
 * `SOLO_SESION` equivale a `RequireAuthorization()`: solo para lo propio del usuario (el servicio filtra
 * por quién es) o datos de apoyo; cada uso lleva un comentario que lo justifica.
 */
export type Acceso = readonly Permiso[] | typeof SOLO_SESION;
export const SOLO_SESION = 'sesion' as const;
export interface Ruta {
  metodo: string;
  camino: string;
  patron: RegExp;
  claves: string[];
  acceso: Acceso;
  manejar: Manejador;
}

export const rutas: Ruta[] = [];
export function ruta(metodo: string, camino: string, acceso: Acceso, manejar: Manejador) {
  const claves: string[] = [];
  const patron = new RegExp('^' + camino.replace(/:(\w+)/g, (_, k: string) => (claves.push(k), '([^/]+)')) + '/?$');
  rutas.push({ metodo, camino, patron, claves, acceso, manejar });
}

/**
 * Respuesta con el contrato de TI: el DTO directo, sin envoltorio. La hora del servidor va en la cabecera
 * `X-Servidor-Ahora` de toda respuesta (la agrega manejarApi).
 */
export const r = (_ctx: Ctx, datos: unknown, status = 200) => json(datos, status);
