/**
 * Tiempo real (lineamientos UTCD, sección «Tiempo real»): el servidor solo avisa «algo cambió» y cada
 * pantalla vuelve a consultar por los endpoints normales, que ya aplican permisos y sectores.
 * Al migrar al marco de TI, el canal se reemplaza por un hub de SignalR con los mismos avisos.
 */
import type { Permiso } from './permisos';

/** Módulos que generan avisos (la parte de la ruta /api/v1/<modulo>). */
export const MODULOS_AVISO = ['visitas', 'usuarios', 'catalogos'] as const;
export type ModuloAviso = (typeof MODULOS_AVISO)[number];

/** Aviso que reciben las pantallas: solo módulo e id, nunca nombres de personas ni datos. */
export interface Aviso {
  modulo: ModuloAviso;
  /** Id del registro afectado: el primer número de la ruta (/api/v1/fallas/12/estado → 12). */
  id: number | null;
}

/** Aviso tal como lo envía el servidor al canal. */
export interface AvisoCanal extends Aviso {
  tipo?: 'aviso';
  /** Conexión de quien hizo el cambio: no recibe su propio aviso. */
  origen: string | null;
  /** Solo lo reciben las conexiones con este permiso (p. ej. solicitudes de cuenta)… */
  permiso: Permiso | null;
  /** …y además este usuario (notificación dirigida: «tu cuenta cambió»). */
  destinatario?: number | null;
}

/**
 * Notificación dirigida (lineamientos: «los participantes reciben la notificación estén en la sección que
 * estén»): un mensaje corto con códigos (folio, placa), nunca nombres de personas, y a qué abre.
 */
export interface Notificacion {
  mensaje: string;
  modulo: ModuloAviso;
  id: number | null;
}

/** A quién va una notificación: usuarios concretos y/o quienes tengan un permiso. */
export interface DestinoNotificacion {
  usuarios?: number[];
  permiso?: Permiso;
  /** Nunca a este usuario (quien hizo el cambio, en cualquiera de sus dispositivos). */
  excluir?: number;
}

export interface NotificacionCanal extends Notificacion {
  tipo: 'notificacion';
  destino: DestinoNotificacion;
  origen: string | null;
}

/** Datos de cada conexión abierta, guardados por el canal. */
export interface DatosConexion {
  conexion: string;
  usuario: number;
  permisos: string[];
}

/** Cabecera con la que el cliente indica su conexión al guardar (como X-Conexion-Tiempo-Real del marco). */
export const CABECERA_CONEXION = 'X-Conexion-Tiempo-Real';

/** ¿Esta conexión recibe el aviso? */
export const debeRecibir = (c: DatosConexion, a: AvisoCanal) =>
  c.conexion !== a.origen && (!a.permiso || c.permisos.includes(a.permiso) || (!!a.destinatario && c.usuario === a.destinatario));

/** ¿Esta conexión recibe la notificación? */
export function debeNotificar(c: DatosConexion, n: NotificacionCanal) {
  if (c.conexion === n.origen || c.usuario === n.destino.excluir) return false;
  if (n.destino.usuarios?.includes(c.usuario)) return true;
  const { permiso } = n.destino;
  return !!permiso && c.permisos.includes(permiso);
}
