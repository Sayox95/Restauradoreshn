/**
 * Actualización de la app por eventos, sin consultas periódicas:
 * - al abrir la app el navegador revisa si cambió /sw.js;
 * - se vuelve a revisar al volver a la app (visibilitychange), al recibir el foco, al recuperar la
 *   conexión (online) y al cambiar de sección (revisarActualizacion, desde ActualizacionAutomatica);
 * - el service worker nuevo se activa solo (skipWaiting + clientsClaim) y, cuando toma el control
 *   (controllerchange), se avisa a la app para que recargue con la versión nueva.
 *
 * Página abierta sin service worker al mando (primera visita o recarga forzada, Ctrl+Shift+R): el primer
 * cambio de control puede ser la misma versión (primera visita) o una nueva publicada mientras tanto.
 * Ahí, y solo ahí, se compara la versión de la app con /version.json para decidir.
 */
declare const __VERSION_APP__: string;

/** Revisiones seguidas (p. ej. foco y visibilidad juntos, o varias secciones rápido) cuentan como una. */
const ESPERA_ENTRE_REVISIONES_MS = 5_000;
let registro: ServiceWorkerRegistration | null = null;
let ultimaRevision = 0;

/** Pide al navegador revisar si cambió /sw.js (un pedido liviano; responde 304 si no hay cambios). */
export function revisarActualizacion() {
  if (!registro || Date.now() - ultimaRevision < ESPERA_ENTRE_REVISIONES_MS) return;
  ultimaRevision = Date.now();
  registro.update().catch(() => {});
}

/** ¿La versión publicada es otra que la de esta página? Sin respuesta se asume que no. */
async function versionPublicadaEsOtra() {
  try {
    const r = await fetch('/version.json', { cache: 'no-store' });
    if (!r.ok) return false;
    const { version } = (await r.json()) as { version?: string };
    return !!version && version !== __VERSION_APP__;
  } catch {
    return false;
  }
}

export function iniciarActualizaciones(alHaberVersionNueva: () => void) {
  if (!('serviceWorker' in navigator)) return;
  let habiaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (habiaControlador) alHaberVersionNueva();
    else void versionPublicadaEsOtra().then((otra) => otra && alHaberVersionNueva());
    habiaControlador = true;
  });

  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((r) => {
      registro = r;
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && revisarActualizacion());
      addEventListener('focus', revisarActualizacion);
      addEventListener('online', revisarActualizacion);
    })
    .catch(() => {
      // Sin service worker la app funciona igual (solo sin modo instalable/caché).
    });
}
