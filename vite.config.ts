import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Versión (lineamientos v2 §11): la SemVer de package.json, que se sube antes de cada publicación y se
 * etiqueta vX.Y.Z; la app la muestra (__VERSION_APP__). Aparte, la marca de esta compilación
 * (__COMPILACION__): con ella la app sabe si quedó vieja tras una recarga forzada (src/common/pwa/pwa.ts),
 * aunque alguien publique sin subir la versión. Las dos van en /version.json, fuera del caché del SW.
 */
const VERSION_APP = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
const COMPILACION = new Date().toISOString();
const archivoVersion = (): Plugin => ({
  name: 'archivo-version',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: VERSION_APP, compilacion: COMPILACION }),
    });
  },
});

export default defineConfig({
  define: {
    __VERSION_APP__: JSON.stringify(VERSION_APP),
    __COMPILACION__: JSON.stringify(COMPILACION),
  },
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
    // Alias de la plantilla de TI (@common, @components, @modules) más @shared y @ para lo propio de la app.
    alias: {
      '@shared': resolve(process.cwd(), 'shared'),
      '@components': resolve(process.cwd(), 'src/common/components'),
      '@common': resolve(process.cwd(), 'src/common'),
      '@modules': resolve(process.cwd(), 'src/app/modules'),
      '@': resolve(process.cwd(), 'src'),
    },
  },
  server: {
    proxy: { '/api': 'http://localhost:8788' },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 400,
  },
});
