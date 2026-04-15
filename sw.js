/**
 * SCADA Distribución — Service Worker v202604151810
 * 
 * Estrategias:
 *   /api/data   → Network first + cache fallback (catálogos offline)
 *   /api/save   → Network first + IndexedDB fallback (visitas offline)
 *   resto API   → Network only
 *   HTML/assets → Cache first (carga instantánea)
 *
 * Para forzar actualización en todos los dispositivos:
 *   Cambia CACHE_NAME por ej: 'scada-202604160900'
 */

const CACHE_NAME    = 'scada-202604160101';
const SYNC_TAG      = 'scada-sync-visitas';
const DB_NAME       = 'scadaDB';
const DB_VERSION    = 2;
const STORE_PENDING = 'pendientes';
const STORE_PDFS    = 'pdfs_pendientes';
const STORE_PDFS    = 'pdfs_pendientes';

// Assets que se cachean en el install (críticos para offline)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ══════════════════════════════════════════════════════════════════
//  INSTALL — cachear assets estáticos inmediatamente
// ══════════════════════════════════════════════════════════════════
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())  // activar inmediatamente sin esperar
  );
});

// ══════════════════════════════════════════════════════════════════
//  ACTIVATE — limpiar caches viejos y tomar control de inmediato
// ══════════════════════════════════════════════════════════════════
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // controlar todas las tabs abiertas
  );
});

// ══════════════════════════════════════════════════════════════════
//  FETCH — enrutador principal
// ══════════════════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo interceptar peticiones del mismo origen
  if (url.origin !== self.location.origin) return;

  const path   = url.pathname;
  const method = event.request.method;

  // ── /api/data → catálogos: network first, caché como fallback ──
  if (path === '/api/data' && method === 'GET') {
    event.respondWith(networkFirstCache(event.request));
    return;
  }

  // ── /api/save → guardar visita: network first, IndexedDB si falla ──
  if (path === '/api/save' && method === 'POST') {
    event.respondWith(saveConFallback(event.request));
    return;
  }

  // ── Resto de /api/* → network only (admin, pdf, etc.) ──
  if (path.startsWith('/api/')) return;

  // ── HTML y assets estáticos → cache first ──
  event.respondWith(cacheFirst(event.request));
});

// ── Network first: intenta red, si falla usa caché ──────────────
async function networkFirstCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Sin red y sin caché → devolver estructura vacía válida
    return new Response(JSON.stringify({
      status        : 'ok',
      offline       : true,
      updated       : new Date().toISOString(),
      restauradores : [],
      materiales    : [],
      personal      : [],
      tipos         : [],
      marcas        : [],
      modems        : [],
      tableros      : []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── Cache first: sirve desde caché, actualiza en segundo plano ──
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Actualizar caché en segundo plano (stale-while-revalidate)
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }
  // No está en caché → fetch normal
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Fallback al index.html para navegación SPA
    const fallback = await caches.match('/index.html');
    return fallback || new Response('Sin conexión', { status: 503 });
  }
}

// ── Save con fallback: intenta red, si falla guarda en IndexedDB ─
async function saveConFallback(request) {
  try {
    const response = await fetch(request.clone(), { cache: 'no-cache' });
    if (response.ok) return response;
    throw new Error('HTTP ' + response.status);
  } catch {
    // Sin conexión → guardar en IndexedDB como pendiente
    let body = {};
    try { body = await request.json(); } catch {}

    await guardarPendiente(body);

    // Registrar Background Sync para subir cuando haya internet
    try {
      await self.registration.sync.register(SYNC_TAG);
    } catch(e) {
      console.warn('Background Sync no soportado:', e.message);
    }

    return new Response(JSON.stringify({
      status    : 'ok',
      offline   : true,
      visitaNum : body.visitaNum || '',
      message   : 'Guardado localmente. Se sincronizará al recuperar conexión.'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ══════════════════════════════════════════════════════════════════
//  BACKGROUND SYNC — subir visitas pendientes
// ══════════════════════════════════════════════════════════════════
self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(sincronizarPendientes());
  }
});

async function sincronizarPendientes() {
  const pendientes = await getPendientes();
  if (!pendientes.length) return;

  const subidos = [];

  for (const item of pendientes) {
    try {
      const resp = await fetch('/api/save', {
        method  : 'POST',
        headers : { 'Content-Type': 'application/json' },
        body    : JSON.stringify(item.data)
      });
      if (resp.ok) {
        subidos.push(item.id);
      }
    } catch {
      break; // Sin internet, intentar en el próximo sync
    }
  }

  if (subidos.length) {
    await eliminarPendientes(subidos);
    // Notificar a todas las tabs abiertas
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(client => client.postMessage({
      type  : 'SYNC_COMPLETE',
      count : subidos.length
    }));
  }
}

// ══════════════════════════════════════════════════════════════════
//  IndexedDB helpers
// ══════════════════════════════════════════════════════════════════
function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const store = db.createObjectStore(STORE_PENDING, {
          keyPath: 'id', autoIncrement: true
        });
        store.createIndex('visitaNum', 'visitaNum', { unique: false });
        store.createIndex('savedAt',   'savedAt',   { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, {
          keyPath: 'id', autoIncrement: true
        });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function guardarPendiente(data) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    store.add({
      visitaNum : data.visitaNum || '',
      data      : data,
      savedAt   : Date.now()
    });
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

async function getPendientes() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PENDING, 'readonly');
    const req   = tx.objectStore(STORE_PENDING).getAll();
    req.onsuccess = e => resolve(e.target.result || []);
    req.onerror   = e => reject(e.target.error);
  });
}

async function eliminarPendientes(ids) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    ids.forEach(id => store.delete(id));
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}
