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
  pdf_subido: boolean;
  /** Último error que no es de conexión (el servidor rechazó algo): se muestra a la persona. */
  error?: string;
}

export interface Borrador {
  datos: Record<string, unknown>;
  fotos: FotoLocal[];
  guardado_en: string;
  /** Sección en la que iba (para retomar donde quedó). */
  paso?: number;
}

let abierta: Promise<IDBDatabase> | null = null;
function abrir(): Promise<IDBDatabase> {
  if (abierta) return abierta;
  abierta = new Promise((ok, mal) => {
    const req = indexedDB.open(NOMBRE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cola')) db.createObjectStore('cola', { keyPath: 'visita_num' });
      if (!db.objectStoreNames.contains('borrador')) db.createObjectStore('borrador');
      if (!db.objectStoreNames.contains('catalogos')) db.createObjectStore('catalogos');
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

async function operar<T>(store: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
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
    .then((ya) => ya || navigator.storage.persist())
    .catch(() => {});
}

// ── Cola de envíos ──────────────────────────────────────────────────────────────────────────
const oyentes = new Set<() => void>();
/** Avisa a las pantallas (contador, lista) que la cola cambió. */
export function alCambiarCola(fn: () => void) {
  oyentes.add(fn);
  return () => void oyentes.delete(fn);
}
const avisar = () => oyentes.forEach((f) => f());

export const listarCola = async () =>
  ((await operar<Pendiente[]>('cola', 'readonly', (s) => s.getAll())) ?? []).sort((a, b) => a.guardado_en.localeCompare(b.guardado_en));
export async function guardarEnCola(p: Pendiente) {
  pedirPersistencia();
  await operar('cola', 'readwrite', (s) => s.put(p));
  avisar();
}
export async function quitarDeCola(visitaNum: string) {
  await operar('cola', 'readwrite', (s) => s.delete(visitaNum));
  avisar();
}

// ── Borrador ────────────────────────────────────────────────────────────────────────────────
export const leerBorrador = () => operar<Borrador>('borrador', 'readonly', (s) => s.get('actual'));
export const guardarBorrador = (b: Borrador) => {
  pedirPersistencia();
  return operar('borrador', 'readwrite', (s) => s.put(b, 'actual'));
};
export const borrarBorrador = () => operar('borrador', 'readwrite', (s) => s.delete('actual'));

// ── Catálogos para capturar sin señal ──────────────────────────────────────────────────────
export const leerCatalogosLocales = () => operar<CatalogosVisita>('catalogos', 'readonly', (s) => s.get('visita'));
export const guardarCatalogosLocales = (c: CatalogosVisita) => operar('catalogos', 'readwrite', (s) => s.put(c, 'visita'));
