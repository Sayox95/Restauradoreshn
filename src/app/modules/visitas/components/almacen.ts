/**
 * Almacén del teléfono (IndexedDB) para la excepción E1 — captura sin conexión:
 *  - cola: visitas guardadas que faltan por enviar (con sus fotos originales y lo que ya se envió);
 *  - borrador: la visita en curso, para no perderla si el sistema cierra la app (p. ej. al abrir la cámara);
 *  - catalogos: lo que necesita el formulario para llenarse sin señal.
 * Un solo esquema con su versión; cambiarlo implica subir VERSION.
 */
import type { CatalogosVisita } from '@shared/tipos';
import type { VisitaEntrada } from '@shared/visitas';

const NOMBRE = 'restauradores';
const VERSION = 1;

/** Foto de una visita: el archivo ORIGINAL (E2) y una copia reducida para el PDF. */
export interface FotoLocal {
  original: Blob;
  nombre: string;
  /** Copia reducida (data URL JPEG, 1600 px) para la ficha PDF y la vista previa. */
  copia: string | null;
  observacion: string | null;
}

export interface Pendiente {
  visita_num: string;
  visita: VisitaEntrada;
  fotos: FotoLocal[];
  guardado_en: string;
  /** Id en el servidor, cuando la visita ya se registró. */
  id?: number;
  /** Órdenes (1..n) de las fotos ya subidas. */
  fotos_subidas: number[];
  /** Órdenes de las fotos cuya copia reducida ya se subió (o no se pudo subir y no se reintenta). */
  copias_subidas?: number[];
  pdf_subido: boolean;
  /** Último error que no es de conexión (el servidor rechazó algo): se muestra a la persona. */
  error?: string;
  /** Cuenta que la guardó: solo esa la ve y la envía (lineamientos §11). */
  usuario_id?: number;
}

export interface Borrador {
  datos: Record<string, unknown>;
  fotos: FotoLocal[];
  guardado_en: string;
  /** Sección en la que iba (para retomar donde quedó). */
  paso?: number;
  /** Cuenta que la está capturando. */
  usuario_id?: number;
}

let abierta: Promise<IDBDatabase> | null = null;
function abrir(): Promise<IDBDatabase> {
  if (abierta) return abierta;
  abierta = new Promise((ok, mal) => {
    const req = indexedDB.open(NOMBRE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cola'))
        db.createObjectStore('cola', { keyPath: 'visita_num' });
      if (!db.objectStoreNames.contains('borrador'))
        db.createObjectStore('borrador');
      if (!db.objectStoreNames.contains('catalogos'))
        db.createObjectStore('catalogos');
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => {
        req.result.close();
        abierta = null;
      };
      ok(req.result);
    };
    req.onerror = () => {
      abierta = null;
      mal(req.error);
    };
  });
  return abierta;
}

async function operar<T>(
  store: string,
  modo: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const tx = db.transaction(store, modo);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => ok(req ? req.result : undefined);
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error);
  });
}

/**
 * Pide al navegador que no borre lo guardado aunque le falte espacio o la app no se use en días (Safari
 * puede borrar los datos de una web sin uso). Se pide una vez, al guardar algo por primera vez; en
 * Chrome y Safari se concede o niega sin preguntar a la persona. Si no se puede, la app sigue igual.
 */
let persistenciaPedida = false;
function pedirPersistencia() {
  if (persistenciaPedida) return;
  persistenciaPedida = true;
  void navigator.storage
    ?.persisted?.()
    .then(ya => ya || navigator.storage.persist())
    .catch(() => {});
}

// ── Cuenta dueña de lo guardado ────────────────────────────────────────────────────────────
/**
 * Lo que vive en el dispositivo (borrador y cola sin señal) se liga a la cuenta que lo creó
 * (lineamientos §11): si varias personas usan el mismo teléfono, cada una ve, continúa y envía solo lo
 * suyo; lo de otra cuenta espera en el teléfono hasta que esa persona vuelva a entrar. La fija el layout
 * con la sesión activa.
 */
let cuentaActual: number | null = null;
export function fijarCuenta(id: number | null) {
  if (id === cuentaActual) return;
  cuentaActual = id;
  // Se llama al dibujar el layout: las pantallas se actualizan después, no en medio de ese dibujo.
  queueMicrotask(avisar);
}
/**
 * Dueño de lo guardado antes de ligarlo a la cuenta: quien inspecciona es el técnico #1 del personal,
 * que la app prellenaba con la cuenta que capturaba.
 */
const duenoAnterior = (datos: unknown): number | undefined => {
  const personal = (
    datos as { personal?: { usuario_id?: number | null }[] } | undefined
  )?.personal;
  return personal?.[0]?.usuario_id ?? undefined;
};
const esDeLaCuenta = (usuarioId: number | undefined, datos: unknown) =>
  cuentaActual !== null && (usuarioId ?? duenoAnterior(datos)) === cuentaActual;

// ── Cola de envíos ──────────────────────────────────────────────────────────────────────────
const oyentes = new Set<() => void>();
/** Avisa a las pantallas (contador, lista) que la cola cambió. */
export function alCambiarCola(fn: () => void) {
  oyentes.add(fn);
  return () => void oyentes.delete(fn);
}
const avisar = () => oyentes.forEach(f => f());

/** Pendientes de la cuenta activa (lo de otras cuentas no se muestra ni se envía). */
export const listarCola = async () =>
  ((await operar<Pendiente[]>('cola', 'readonly', s => s.getAll())) ?? [])
    .filter(p => esDeLaCuenta(p.usuario_id, p.visita))
    .sort((a, b) => a.guardado_en.localeCompare(b.guardado_en));
export async function guardarEnCola(p: Pendiente) {
  pedirPersistencia();
  const conDueno = {
    ...p,
    usuario_id:
      p.usuario_id ?? duenoAnterior(p.visita) ?? cuentaActual ?? undefined,
  };
  await operar('cola', 'readwrite', s => s.put(conDueno));
  avisar();
}
export async function quitarDeCola(visitaNum: string) {
  await operar('cola', 'readwrite', s => s.delete(visitaNum));
  avisar();
}

// ── Borrador ────────────────────────────────────────────────────────────────────────────────
// Un borrador por cuenta. El que se guardaba antes con la clave «actual» pasa a su dueño al leerlo.
const claveBorrador = () => `cuenta-${cuentaActual}`;
export async function leerBorrador(): Promise<Borrador | undefined> {
  if (cuentaActual === null) return undefined;
  const propio = await operar<Borrador>('borrador', 'readonly', s =>
    s.get(claveBorrador()),
  );
  if (propio) return propio;
  const anterior = await operar<Borrador>('borrador', 'readonly', s =>
    s.get('actual'),
  );
  if (!anterior || !esDeLaCuenta(anterior.usuario_id, anterior.datos))
    return undefined;
  await operar('borrador', 'readwrite', s =>
    s.put({ ...anterior, usuario_id: cuentaActual! }, claveBorrador()),
  );
  await operar('borrador', 'readwrite', s => s.delete('actual'));
  return anterior;
}
export const guardarBorrador = (b: Borrador) => {
  if (cuentaActual === null) return Promise.resolve(undefined);
  pedirPersistencia();
  return operar('borrador', 'readwrite', s =>
    s.put({ ...b, usuario_id: cuentaActual! }, claveBorrador()),
  );
};
export const borrarBorrador = () =>
  operar('borrador', 'readwrite', s => s.delete(claveBorrador()));

// ── Catálogos para capturar sin señal ──────────────────────────────────────────────────────
export const leerCatalogosLocales = () =>
  operar<CatalogosVisita>('catalogos', 'readonly', s => s.get('visita'));
export const guardarCatalogosLocales = (c: CatalogosVisita) =>
  operar('catalogos', 'readwrite', s => s.put(c, 'visita'));
