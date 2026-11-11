/** Espera a que un service worker nuevo termine de instalarse (o se rinde a los `ms`). */
function instalado(sw: ServiceWorker, ms = 10_000): Promise<ServiceWorker | null> {
  if (sw.state === 'installed') return Promise.resolve(sw);
  return new Promise((ok) => {
    const t = setTimeout(() => ok(null), ms);
    sw.addEventListener('statechange', () => {
      if (sw.state === 'installed') {
        clearTimeout(t);
        ok(sw);
      } else if (sw.state === 'redundant') {
        clearTimeout(t);
        ok(null);
      }
    });
  });
}

/**
 * Recarga tomando la versión más reciente publicada. Un `location.reload()` simple puede volver a abrir
 * la versión guardada en el teléfono (la nueva queda «en espera» hasta cerrar todas las pestañas),
 * y esa versión vieja puede no entender las respuestas del servidor nuevo.
 */
export async function actualizarYRecargar() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update().catch(() => {});
      const nuevo = reg.waiting ?? (reg.installing ? await instalado(reg.installing) : null);
      if (nuevo) {
        await new Promise<void>((ok) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => ok(), { once: true });
          nuevo.postMessage({ type: 'SKIP_WAITING' });
          setTimeout(ok, 3000);
        });
      }
    }
  } catch {
    // Sin service worker: basta con recargar.
  }
  window.location.reload();
}
