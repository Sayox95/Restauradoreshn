/**
 * SCADA Distribución — Service Worker
 *
 * Estrategias:
 *   /api/data   → Network first + cache fallback (catálogos offline)
 *   /api/save   → Network first; solo si NO hay red (o 502/503/504) se
 *                 guarda en IndexedDB para sincronizar después
 *   resto API   → Network only
 *   HTML/assets → Cache first + actualización en segundo plano
 *
 * Actualizaciones: el SW nuevo queda en espera (no hace skipWaiting solo).
 * La página decide cuándo activarlo (si el formulario está vacío, o cuando
 * el usuario pulsa "Actualizar"), para no perder una visita a medio llenar.
 *
 * Versión: en cada deploy de Cloudflare Pages, build.mjs reemplaza BUILD_ID
 * por el commit desplegado. Al cambiar este archivo, todos los dispositivos
 * detectan la actualización automáticamente (no hay que editar nada a mano).
 */

importScripts('/idb.js');

const APP_VERSION = '2.1.0';
const BUILD_ID    = 'dev-202611092000'; // lo reemplaza build.mjs en cada deploy
const CACHE_NAME  = 'scada-' + BUILD_ID;
const SYNC_TAG    = 'scada-sync-visitas';

// Respuestas del servidor que se consideran "temporalmente sin servicio"
const RETRY_STATUS = [502, 503, 504];

// Assets que se cachean en el install (críticos para offline)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/idb.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
];

// ══════════════════════════════════════════════════════════════════
//  INSTALL — cachear assets estáticos
// ══════════════════════════════════════════════════════════════════
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ══════════════════════════════════════════════════════════════════
//  MESSAGE — la app pide activar el SW nuevo
// ══════════════════════════════════════════════════════════════════
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ══════════════════════════════════════════════════════════════════
//  ACTIVATE — limpiar caches viejos y tomar control
// ══════════════════════════════════════════════════════════════════
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
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

  if (path === '/api/data' && method === 'GET') {
    event.respondWith(networkFirstCache(event.request));
    return;
  }

  if (path === '/api/save' && method === 'POST') {
    event.respondWith(saveConFallback(event.request));
    return;
  }

  // Resto de /api/* y cualquier no-GET → red directa
  if (path.startsWith('/api/') || method !== 'GET') return;

  event.respondWith(cacheFirst(event.request));
});

// ── Network first: intenta red, si falla usa caché ──────────────
async function networkFirstCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Sin red y sin caché → devolver estructura vacía válida
    return new Response(JSON.stringify({
      status: 'ok', offline: true, updated: new Date().toISOString(),
      restauradores: [], materiales: [], personal: [],
      tipos: [], marcas: [], modems: [], tableros: []
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

// ── Cache first: sirve desde caché, actualiza en segundo plano ──
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Fallback al index.html solo para navegación
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Sin conexión', { status: 503 });
  }
}

// ── Save con fallback ────────────────────────────────────────────
// Solo se encola si NO hay red o el servidor está temporalmente caído.
// Errores de validación/servidor (400, 500…) se devuelven tal cual a la
// app, para que el técnico vea el error en vez de un falso "guardado".
async function saveConFallback(request) {
  let response;
  try {
    response = await fetch(request.clone(), { cache: 'no-cache' });
  } catch {
    return encolarOffline(request);
  }
  if (RETRY_STATUS.includes(response.status)) return encolarOffline(request);
  return response;
}

async function encolarOffline(request) {
  let body = {};
  try { body = await request.json(); } catch {}

  try {
    await guardarPendiente(body);
  } catch (e) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'No se pudo guardar localmente: ' + (e?.message || e)
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    await self.registration.sync.register(SYNC_TAG);
  } catch (e) {
    console.warn('Background Sync no soportado:', e.message);
  }

  return new Response(JSON.stringify({
    status   : 'ok',
    offline  : true,
    visitaNum: body.visitaNum || '',
    message  : 'Guardado localmente. Se sincronizará al recuperar conexión.'
  }), { headers: { 'Content-Type': 'application/json' } });
}

// ══════════════════════════════════════════════════════════════════
//  BACKGROUND SYNC
//  - Si la app está abierta, se le pide a ella que sincronice (puede
//    generar y subir el PDF con fotos).
//  - Si está cerrada, el SW sube solo los datos de la visita y la marca
//    como `subido`; la app generará y subirá el PDF al abrirse.
// ══════════════════════════════════════════════════════════════════
self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(manejarSync());
  }
});

async function manejarSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  if (clients.length) {
    clients.forEach(c => c.postMessage({ type: 'SYNC_REQUEST' }));
    return;
  }
  await scadaWithSyncLock(sincronizarPendientes);
}

async function sincronizarPendientes() {
  const pendientes = (await getPendientes()).filter(p => !p.subido);
  if (!pendientes.length) return;

  let subidos   = 0;
  let falloRed  = false;

  for (const item of pendientes) {
    let resp;
    try {
      resp = await fetch('/api/save', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(item.data)
      });
    } catch {
      falloRed = true;
      break; // sin internet: el navegador reintentará el sync
    }
    if (resp.ok) {
      await marcarSubido(item);
      subidos++;
    } else if (RETRY_STATUS.includes(resp.status)) {
      falloRed = true;
      break;
    } else {
      // Error permanente (validación, etc.): se conserva en la cola para
      // que la app lo muestre; no se reintenta en bucle aquí.
      console.warn('Visita rechazada por el servidor:', item.visitaNum, resp.status);
    }
  }

  if (subidos) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE', count: subidos }));
  }

  // Lanzar error hace que el navegador reprograme el sync
  if (falloRed) throw new Error('Sin conexión — sync reprogramado');
}

// ══════════════════════════════════════════════════════════════════
//  IndexedDB helpers (esquema en /idb.js)
// ══════════════════════════════════════════════════════════════════
async function guardarPendiente(data) {
  const db = await scadaOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendientes', 'readwrite');
    tx.objectStore('pendientes').add({
      visitaNum: data.visitaNum || '',
      data     : data,
      savedAt  : Date.now()
    });
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

async function getPendientes() {
  const db = await scadaOpenDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('pendientes', 'readonly').objectStore('pendientes').getAll();
    req.onsuccess = e => resolve(e.target.result || []);
    req.onerror   = e => reject(e.target.error);
  });
}

async function marcarSubido(item) {
  const db = await scadaOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendientes', 'readwrite');
    tx.objectStore('pendientes').put({ ...item, subido: true });
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}
