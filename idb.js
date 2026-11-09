/**
 * Esquema único de IndexedDB — compartido por la página (index.html)
 * y el Service Worker (sw.js, vía importScripts).
 *
 * IMPORTANTE: cualquier cambio de stores debe hacerse SOLO aquí y
 * subiendo SCADA_DB_VERSION, para que la página y el SW nunca creen
 * la base con esquemas distintos.
 *
 * Stores:
 *   pendientes    → visitas guardadas offline (autoIncrement, campo `id`)
 *   pdf_queue     → PDFs pendientes de subir a R2 (keyPath `visitaNum`)
 *   fotos_offline → fotos de visitas offline (keyPath `visitaNum`)
 *   catalogos     → caché de catálogos (/api/data), clave externa
 */
const SCADA_DB_NAME    = 'scadaDB';
const SCADA_DB_VERSION = 11;
const SCADA_SYNC_LOCK  = 'scada-sync';

function scadaUpgradeDB(db, tx) {
  if (!db.objectStoreNames.contains('pendientes')) {
    const s = db.createObjectStore('pendientes', { keyPath: 'id', autoIncrement: true });
    s.createIndex('visitaNum', 'visitaNum', { unique: false });
    s.createIndex('savedAt',   'savedAt',   { unique: false });
  }

  if (!db.objectStoreNames.contains('fotos_offline')) {
    db.createObjectStore('fotos_offline', { keyPath: 'visitaNum' });
  }

  if (!db.objectStoreNames.contains('catalogos')) {
    db.createObjectStore('catalogos');
  }

  if (!db.objectStoreNames.contains('pdf_queue')) {
    db.createObjectStore('pdf_queue', { keyPath: 'visitaNum' });
  } else {
    // Versiones anteriores creaban pdf_queue con esquemas distintos según
    // quién abría primero la base (página: autoIncrement; SW: keyPath).
    // Migrar al esquema correcto conservando los PDFs pendientes.
    const old = tx.objectStore('pdf_queue');
    if (old.keyPath !== 'visitaNum') {
      const req = old.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        db.deleteObjectStore('pdf_queue');
        const store = db.createObjectStore('pdf_queue', { keyPath: 'visitaNum' });
        items.forEach(it => { if (it && it.visitaNum) store.put(it); });
      };
    }
  }
}

function scadaOpenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SCADA_DB_NAME, SCADA_DB_VERSION);
    req.onupgradeneeded = e => scadaUpgradeDB(e.target.result, e.target.transaction);
    req.onsuccess = e => {
      const db = e.target.result;
      // Si otra pestaña/SW pide una versión nueva, cerrar para no bloquearla
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror   = e => reject(e.target.error);
    req.onblocked = () => console.warn('[IDB] apertura bloqueada por otra conexión abierta');
  });
}

/**
 * Ejecuta fn() con un bloqueo exclusivo compartido entre la página y el SW,
 * para que nunca suban la misma cola de pendientes al mismo tiempo.
 * Si el navegador no soporta Web Locks, ejecuta fn() directamente.
 */
function scadaWithSyncLock(fn) {
  const locks = (typeof navigator !== 'undefined') && navigator.locks;
  if (locks && locks.request) return locks.request(SCADA_SYNC_LOCK, fn);
  return fn();
}
