/**
 * SCADA Distribución — Service Worker
 * - Cachea el HTML y assets para uso offline
 * - Guarda visitas pendientes en IndexedDB cuando no hay internet
 * - Background Sync: sube visitas pendientes cuando recupera conexión
 */

const CACHE_NAME = 'scada-202604151500';  // actualiza este timestamp en cada deploy
const SYNC_TAG      = 'scada-sync-visitas';
const DB_NAME       = 'scadaDB';
const DB_VERSION    = 1;
const STORE_PENDING = 'pendientes';
const STORE_CACHE   = 'catalogos';

// Archivos a cachear para uso offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// ══════════════════════════════════════════════════════════════════
//  INSTALL — cachear assets estáticos
// ══════════════════════════════════════════════════════════════════
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ══════════════════════════════════════════════════════════════════
//  ACTIVATE — limpiar caches viejos
// ══════════════════════════════════════════════════════════════════
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ══════════════════════════════════════════════════════════════════
//  FETCH — estrategia: Network first, caché como fallback
// ══════════════════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Las llamadas a /api/* se manejan diferente
  if (url.pathname.startsWith('/api/')) {
    // /api/data → cache first (catálogos)
    if (url.pathname === '/api/data') {
      event.respondWith(networkFirstWithCache(event.request));
      return;
    }
    // /api/save → si falla por offline, guardar en IndexedDB
    if (url.pathname === '/api/save' && event.request.method === 'POST') {
      event.respondWith(saveWithFallback(event.request));
      return;
    }
    // resto de API → network only
    return;
  }

  // HTML y assets → cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Network first para /api/data, guardando en cache para offline
async function networkFirstWithCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({
      status: 'ok',
      offline: true,
      restauradores: [],
      materiales: [],
      personal: [],
      tipos: [],
      marcas: [],
      modems: [],
      tableros: []
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

// Guardar visita: intentar red, si falla guardar en IndexedDB
async function saveWithFallback(request) {
  try {
    const response = await fetch(request.clone());
    if (response.ok) return response;
    throw new Error('Server error');
  } catch {
    // Sin conexión — guardar en IndexedDB como pendiente
    const body = await request.json();
    await savePendiente(body);

    // Registrar Background Sync para cuando haya internet
    await self.registration.sync.register(SYNC_TAG);

    return new Response(JSON.stringify({
      status: 'ok',
      offline: true,
      visitaNum: body.visitaNum,
      message: 'Guardado localmente. Se sincronizará cuando haya conexión.'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ══════════════════════════════════════════════════════════════════
//  BACKGROUND SYNC — subir visitas pendientes cuando hay internet
// ══════════════════════════════════════════════════════════════════
self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(sincronizarPendientes());
  }
});

async function sincronizarPendientes() {
  const pendientes = await getPendientes();
  if (!pendientes.length) return;

  const exitosos = [];

  for (const item of pendientes) {
    try {
      const resp = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data)
      });
      if (resp.ok) {
        exitosos.push(item.id);
      }
    } catch {
      // Sigue sin internet, intentar luego
      break;
    }
  }

  if (exitosos.length) {
    await deletePendientes(exitosos);
    // Notificar a la app que se sincronizaron
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(client => client.postMessage({
      type: 'SYNC_COMPLETE',
      count: exitosos.length
    }));
  }
}

// ══════════════════════════════════════════════════════════════════
//  IndexedDB helpers
// ══════════════════════════════════════════════════════════════════
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const store = db.createObjectStore(STORE_PENDING, {
          keyPath: 'id', autoIncrement: true
        });
        store.createIndex('visitaNum', 'visitaNum', { unique: false });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function savePendiente(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    store.add({ visitaNum: data.visitaNum, data, savedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

async function getPendientes() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PENDING, 'readonly');
    const store = tx.objectStore(STORE_PENDING);
    const req   = store.getAll();
    req.onsuccess = e => resolve(e.target.result || []);
    req.onerror   = e => reject(e.target.error);
  });
}

async function deletePendientes(ids) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    ids.forEach(id => store.delete(id));
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}
