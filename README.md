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
   panel de administración. Sin ella `/api/admin` responde 503. Al ingresarla,
   `/api/admin-login` entrega una sesión firmada que vence en 8 horas (el
   dispositivo nunca guarda la clave). Cambiar el secret invalida todas las sesiones.
2. **Migración D1** (una sola vez) para evitar visitas duplicadas:

   ```bash
   npx wrangler d1 execute <NOMBRE_DB> --remote --file=migrations/0001_registros_visita_num_unique.sql
   ```

3. **Migración D1 v2** (formulario v2: mangueras COOPER, tipo de batería,
   potencial y fotos). Ejecutar una vez el contenido de
   `migrations/0002_campos_formulario_v2.sql` en la consola de D1. Mientras no
   se ejecute, las visitas se siguen guardando, pero sin esos campos nuevos.

## Fotografías

Mínimo 1 y máximo 4 por visita. El archivo **original** (sin comprimir) se sube
por separado a R2 en `fotos/{visita}/{orden}.{ext}` mediante `POST /api/foto` y
queda registrado en la tabla `registros_fotos`. Se pueden ver en
`/api/foto/{visita}/{orden}.jpg`. El PDF incluye una copia reducida (1600 px)
para que no pese decenas de MB.

## Publicar una versión nueva

Cambiar `CACHE_NAME` y `APP_VERSION` en `sw.js` (y `APP_VERSION` en `index.html`).
Los dispositivos aplican la actualización automáticamente cuando el formulario
está vacío; si hay una visita a medio llenar, muestran un aviso y esperan.
