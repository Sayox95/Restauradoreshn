import { CABECERA_CONEXION } from '@shared/tiempo-real';
import type { Respuesta } from '@shared/tipos';
import { conexionActual } from '@/common/tiempo-real/canal';

export class ErrorApi extends Error {
  constructor(
    public status: number,
    mensaje: string,
    public datos?: Record<string, unknown>,
  ) {
    super(mensaje);
  }
}

/** Diferencia entre el reloj del servidor y el del teléfono; el servidor es la fuente oficial. */
let desfaseMs = 0;
export const ahoraServidor = () => Date.now() + desfaseMs;

let alExpirarSesion: () => void = () => {};
export const configurarExpiracion = (fn: () => void) => {
  alExpirarSesion = fn;
};

const SIN_CONEXION = 'Sin conexión. Revise su señal e intente nuevamente; no se guardó ningún cambio.';
const SIN_RESPUESTA = 'El servidor no respondió a tiempo. Intente nuevamente.';
const SIN_CONFIRMACION = 'El servidor no confirmó a tiempo; el cambio pudo haberse guardado. Revise antes de repetirlo.';
/** Ninguna solicitud espera para siempre; las escrituras y subidas de fotos tienen más margen. */
const LIMITE_CONSULTA_MS = 20_000;
const LIMITE_ESCRITURA_MS = 60_000;

export async function pedir<T>(camino: string, opciones: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(opciones.headers);
  let body = opciones.body;
  if (opciones.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opciones.json);
  }
  const esConsulta = (opciones.method ?? 'GET').toUpperCase() === 'GET';
  // Quien hace el cambio no recibe su propio aviso de tiempo real (ya ve el resultado).
  const conexion = conexionActual();
  if (!esConsulta && conexion) headers.set(CABECERA_CONEXION, conexion);
  // El límite de tiempo aplica siempre; una señal de quien llama (p. ej. cancelar un envío) se suma a él.
  const limite = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(esConsulta ? LIMITE_CONSULTA_MS : LIMITE_ESCRITURA_MS) : undefined;
  const signal = opciones.signal && limite && typeof AbortSignal.any === 'function' ? AbortSignal.any([opciones.signal, limite]) : (opciones.signal ?? limite);
  let res: Response;
  try {
    res = await fetch(camino, { ...opciones, headers, body, signal, credentials: 'same-origin' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') throw new ErrorApi(0, esConsulta ? SIN_RESPUESTA : SIN_CONFIRMACION, { sin_respuesta: true });
    throw new ErrorApi(0, SIN_CONEXION);
  }
  const tipo = res.headers.get('Content-Type') ?? '';
  const datos = tipo.includes('json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 && !camino.endsWith('/sesion/login')) alExpirarSesion();
    throw new ErrorApi(res.status, datos?.error ?? (res.status >= 500 ? 'El servidor no respondió correctamente.' : 'Solicitud rechazada.'), datos);
  }
  if (datos && typeof datos === 'object' && 'servidor_ahora' in datos) {
    const r = datos as Respuesta<T>;
    desfaseMs = Date.parse(r.servidor_ahora) - Date.now();
    return r.datos;
  }
  return datos as T;
}

export const get = <T>(camino: string) => pedir<T>(camino);
export const post = <T>(camino: string, json?: unknown, headers?: HeadersInit) => pedir<T>(camino, { method: 'POST', json: json ?? {}, headers });
export const patch = <T>(camino: string, json: unknown) => pedir<T>(camino, { method: 'PATCH', json });
export const put = <T>(camino: string, json: unknown) => pedir<T>(camino, { method: 'PUT', json });
export const subir = <T>(camino: string, form: FormData) => pedir<T>(camino, { method: 'POST', body: form });

/**
 * Sube un archivo grande (fotos originales, PDF). A diferencia de `pedir`, no tiene un límite de tiempo
 * total: se cancela solo si la subida deja de avanzar durante `inactividadMs` (señal débil pero viva
 * puede tardar varios minutos con una foto de 25 MB) o si quien llama lo cancela con `signal`.
 */
export function subirArchivo<T>(
  camino: string,
  archivo: Blob,
  opciones: { metodo?: string; tipo?: string; signal?: AbortSignal; inactividadMs?: number } = {},
): Promise<T> {
  const { metodo = 'PUT', tipo = archivo.type || 'application/octet-stream', signal, inactividadMs = 60_000 } = opciones;
  return new Promise<T>((ok, mal) => {
    const xhr = new XMLHttpRequest();
    let vigilancia: ReturnType<typeof setTimeout> | undefined;
    const sinAvance = () => {
      clearTimeout(vigilancia);
      vigilancia = setTimeout(() => xhr.abort(), inactividadMs);
    };
    const terminar = () => {
      clearTimeout(vigilancia);
      signal?.removeEventListener('abort', cancelar);
    };
    const cancelar = () => xhr.abort();
    if (signal?.aborted) return mal(new ErrorApi(0, SIN_CONEXION));
    signal?.addEventListener('abort', cancelar);
    xhr.open(metodo, camino);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', tipo);
    const conexion = conexionActual();
    if (conexion) xhr.setRequestHeader(CABECERA_CONEXION, conexion);
    xhr.upload.onprogress = sinAvance;
    xhr.onprogress = sinAvance;
    xhr.onabort = xhr.onerror = () => {
      terminar();
      mal(new ErrorApi(0, SIN_CONEXION));
    };
    xhr.onload = () => {
      terminar();
      let datos: (Respuesta<T> & { error?: string }) | null = null;
      try {
        datos = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        datos = null;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        if (xhr.status === 401) alExpirarSesion();
        return mal(
          new ErrorApi(
            xhr.status,
            datos?.error ?? (xhr.status >= 500 ? 'El servidor no respondió correctamente.' : 'Solicitud rechazada.'),
            datos as unknown as Record<string, unknown>,
          ),
        );
      }
      ok((datos && 'datos' in datos ? datos.datos : datos) as T);
    };
    sinAvance();
    xhr.send(archivo);
  });
}

export const mensajeError = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado.');

export function qs(params: Record<string, string | number | null | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
