import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Versión de esta compilación. Va dentro de la app (__VERSION_APP__) y en /version.json (fuera del caché
 * del service worker): si una página se abrió sin service worker (p. ej. recarga forzada) y luego toma el
 * control uno nuevo, la app compara ambas para saber si quedó vieja (ver src/common/pwa/pwa.ts).
 */
const VERSION_APP = new Date().toISOString();
const archivoVersion = (): Plugin => ({
  name: 'archivo-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION_APP }) });
  },
});

export default defineConfig({
  define: { __VERSION_APP__: JSON.stringify(VERSION_APP) },
  plugins: [
    react(),
    archivoVersion(),
    VitePWA({
      // Actualización por eventos (sin consultas periódicas): el service worker nuevo se activa en
      // cuanto se instala (skipWaiting + clientsClaim) y la app recarga al detectar el cambio de
      // control (ver src/lib/pwa.ts). Workbox pone la huella de cada archivo dentro de sw.js, así que
      // cada deploy con cambios produce un sw.js distinto byte a byte, sin cambiar un nombre a mano.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/icon-192.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Inspección de Restauradores – UTCD',
        short_name: 'Restauradores',
        description: 'Hojas de visita para la inspección de restauradores.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f1f5f9',
        theme_color: '#0f2b46',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Solo archivos estáticos: la API siempre va por red (nunca se muestran datos guardados falsamente).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true, // al activarse borra los cachés de versiones anteriores
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: { '@shared': resolve(process.cwd(), 'shared'), '@': resolve(process.cwd(), 'src') },
  },
  server: {
    proxy: { '/api': 'http://localhost:8788' },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 400,
  },
});
