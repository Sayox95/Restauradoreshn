# SCADA Distribución — Inspección de restauradores (PWA)

Hoja de visita offline-first para inspección de restauradores. Frontend en un
solo `index.html` + Service Worker; backend en Cloudflare Pages Functions con
D1 (`env.DB`) y R2 (`env.PDF_BUCKET`).

## Archivos

| Archivo | Rol |
|---|---|
| `index.html` | App completa (formulario, generación de PDF con jsPDF, panel admin) |
| `sw.js` | Service Worker: caché offline, cola de visitas, Background Sync |
| `idb.js` | Esquema único de IndexedDB compartido por la página y el SW |
| `logo.png` | Logo del PDF (servido desde el mismo origen, disponible offline) |
| `functions/api/*` | Endpoints `/api/data`, `/api/save`, `/api/pdf`, `/api/save-pdf-key`, `/api/admin` |
| `migrations/` | SQL para D1 |

## Configuración requerida en Cloudflare Pages

1. **`ADMIN_TOKEN`** (Settings → Variables and Secrets, tipo *Secret*): clave del
   panel de administración. Sin ella `/api/admin` responde 503. La app la pide
   al abrir el panel y la recuerda en el dispositivo (menú Admin → *Cerrar sesión admin*).
2. **Migración D1** (una sola vez) para evitar visitas duplicadas:

   ```bash
   npx wrangler d1 execute <NOMBRE_DB> --remote --file=migrations/0001_registros_visita_num_unique.sql
   ```

## Publicar una versión nueva

Cambiar `CACHE_NAME` y `APP_VERSION` en `sw.js` (y `APP_VERSION` en `index.html`).
Los dispositivos aplican la actualización automáticamente cuando el formulario
está vacío; si hay una visita a medio llenar, muestran un aviso y esperan.
