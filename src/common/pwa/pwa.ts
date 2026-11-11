/**
 * Actualización de la app por eventos, sin consultas periódicas:
 * - al abrir la app el navegador revisa si cambió /sw.js;
 * - se vuelve a revisar al volver a la pestaña (visibilitychange) y al recuperar la conexión (online);
 * - el service worker nuevo se activa solo (skipWaiting + clientsClaim) y, cuando toma el control
 *   (controllerchange), se avisa a la app para que recargue con la versión nueva.
 */
export function iniciarActualizaciones(alHaberVersionNueva: () => void) {
  if (!('serviceWorker' in navigator)) return;
  // Si la página aún no tenía service worker (primera visita), el primer cambio de control no es una versión nueva.
  let habiaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (habiaControlador) alHaberVersionNueva();
    habiaControlador = true;
  });

  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registro) => {
      const revisar = () => registro.update().catch(() => {});
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && revisar());
      addEventListener('online', revisar);
    })
    .catch(() => {
      // Sin service worker la app funciona igual (solo sin modo instalable/caché).
    });
}
