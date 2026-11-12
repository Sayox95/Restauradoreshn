# Inspección de Restauradores (UTCD) — instrucciones para Claude

Sistema de hojas de visita para la inspección de restauradores. Sigue los **Lineamientos UTCD · Apps
en la nube**; el stack se queda en Cloudflare (Pages + Functions + D1 + R2).

> Estado: versión 3, migrada a la estructura de los lineamientos (React + TS, módulos, cuentas y
> permisos). Por ahora la visita tiene un solo estado: **registrada**.

## Reglas del proyecto

- **Git**: excepción acordada con el dueño del proyecto: los cambios van **directo a `main`** (sin ramas
  ni PR). Commits `tipo(módulo): qué cambia` (≤ 72 caracteres), cuerpo en viñetas que explique el porqué,
  **sin líneas de atribución**.
- **Idioma**: textos, comentarios y nombres en español.
- **Antes de subir**: `npm run verificar` (tsc, eslint, pruebas y build) sin errores, y `npm run format`.
- **Despliegue**: Cloudflare Pages con `npm run build` y salida `dist` (ver `docs/despliegue.md`).
  Enlaces en el panel: `DB` (D1) y `PDF_BUCKET` o `ARCHIVOS` (R2); `TIEMPO_REAL` opcional.

## Estructura

- `server/plumbing`: router (cada ruta declara su permiso), sesión, http, esquema, fotos, tiempo real.
- `server/modules/<modulo>`: `endpoints.ts` (ruta base `/api/v1/<modulo>`; lo propio bajo `/mios`),
  `permisos.ts`, `comun.ts` y `features/<accion>.ts`. Módulos: visitas, usuarios, catalogos, sesion.
- `src/app/modules/<modulo>`: `permisos.ts`, `api.ts`, `urls.ts`, `<modulo>-menu.ts`,
  `<modulo>-routing.tsx`, `index.ts`, `features/<accion>/pagina.tsx`.
- `shared/`: permisos (códigos `utcd_restauradores_<modulo>_<accion>`, solo en `shared/permisos.ts`),
  constantes, esquemas y las reglas de la hoja (`shared/visitas.ts`, las usan app y servidor).
- El código **nunca pregunta por un rol**, solo por permisos. Tabla en `docs/permisos.md`.
- Base: cambio de esquema = archivo en `migrations/` **y** su entrada en `server/plumbing/esquema.ts`
  (se aplican solos al arrancar). Nunca `SELECT r.*` sobre `registros` (100 columnas, límite de D1).

## Excepciones acordadas

Códigos de la sección «Excepciones previstas» de los lineamientos. Aprobó: dueño del proyecto, 2026-11-11.

- **E1 · Captura sin conexión** — módulo visitas. Motivo: las inspecciones se hacen en zonas sin
  cobertura. La visita, sus fotos y su PDF se guardan en el dispositivo (IndexedDB, esquema único en
  `src/app/modules/visitas/components/almacen.ts`) y se envían por eventos al reconectar; envío
  idempotente por `visita_num` (índice único) y un solo envío a la vez (Web Locks).
- **E2 · Fotos en resolución original** — módulo visitas. Motivo: las fotos son evidencia técnica (placas,
  lecturas). 1 obligatoria y hasta 3 más, máximo 25 MB cada una, subidas una por una a R2
  (`fotos/<visita>/<orden>.<ext>`) y registradas en `registros_fotos`.
- **E3 · PDF generado en la app** — ficha de visita. Motivo: no existe un formato oficial seriado. Se
  genera con jsPDF, se archiva en R2 (`pdfs/<visita>.pdf`) y la base sigue siendo la fuente oficial.
- **E4 · Mediciones numéricas cortas en una fila** — formulario de visita. El resto del formulario va en
  una sola columna; solo voltajes (AC, baterías, cargador), corrientes (IA, IB, IC, IN) y resistencias de
  aterrizaje van en una fila.

## Actualizaciones de la app

- «Momento tranquilo»: formulario sin datos. Si hay una visita en curso (`marcarTrabajo`) se muestra el
  aviso y la versión nueva se aplica al terminarla; nunca se recarga encima de lo escrito.
- La versión nueva se detecta solo por eventos (abrir, volver a la app, foco, conexión, cambio de
  sección); sin consultas periódicas.

## Pendientes acordados

- **Optimizar `registros` (96 columnas, límite de D1: 100)** — después de estabilizar la versión 3.
  Pasar lo repetido a tablas hijas: módems 1 y 2 → `visita_modems`, materiales (hoy JSON) →
  `visita_materiales`, personal (hoy JSON) → `visita_personal`; el resto se queda en columnas.
  Requiere mover los datos de producción: antes presentar el plan (qué se mueve, respaldo y
  verificación) y esperar la confirmación del dueño del proyecto.
- **Alcance por sector** — cuando se sectorice: el técnico ve sus inspecciones, el supervisor las de
  su sector y el administrador todas. Como en el sistema de referencia: sectores asignados al usuario
  (`usuarios_sectores`, sin sectores = todos) aplicados en `filtroVisitas`; el código sigue preguntando
  solo por permisos. Hoy el supervisor (permiso Consultar) ve todas.
