# Inspección de Restauradores (UTCD) — instrucciones para Claude

Sistema de hojas de visita para la inspección de restauradores. Sigue los **Lineamientos UTCD · Apps
en la nube**; el stack se queda en Cloudflare (Pages + Functions + D1 + R2).

> Estado: la app todavía no está migrada a la estructura de los lineamientos (React + TS, módulos,
> cuentas y permisos). La migración está propuesta por fases y pendiente de aprobación; mientras tanto,
> los cambios respetan las reglas de abajo.

## Reglas del proyecto

- **Git**: excepción acordada con el dueño del proyecto: los cambios van **directo a `main`** (sin ramas
  ni PR). Commits `tipo(módulo): qué cambia` (≤ 72 caracteres), cuerpo en viñetas que explique el porqué,
  **sin líneas de atribución**.
- **Idioma**: textos, comentarios y nombres en español.
- **Despliegue**: Cloudflare Pages con `node build.mjs` y salida `dist` (el build escribe el `BUILD_ID`
  para que los dispositivos se actualicen solos). Las migraciones de D1 viven en `migrations/`.

## Excepciones acordadas

Códigos de la sección «Excepciones previstas» de los lineamientos. Aprobó: dueño del proyecto, 2026-11-11.

- **E1 · Captura sin conexión** — módulo visitas. Motivo: las inspecciones se hacen en zonas sin
  cobertura. La visita, sus fotos y su PDF se guardan en el dispositivo (IndexedDB, esquema único en
  `idb.js`) y se envían al reconectar; envío idempotente por `visita_num` (índice único) y bloqueo
  compartido entre la app y el service worker.
- **E2 · Fotos en resolución original** — módulo visitas. Motivo: las fotos son evidencia técnica (placas,
  lecturas). 1 obligatoria y hasta 3 más, máximo 25 MB cada una, subidas una por una a R2
  (`fotos/<visita>/<orden>.<ext>`) y registradas en `registros_fotos`.
- **E3 · PDF generado en la app** — ficha de visita. Motivo: no existe un formato oficial seriado. Se
  genera con jsPDF, se archiva en R2 (`pdfs/<visita>.pdf`) y la base sigue siendo la fuente oficial.
- **E4 · Mediciones numéricas cortas en una fila** — formulario de visita. El resto del formulario va en
  una sola columna; solo voltajes (AC, baterías, cargador), corrientes (IA, IB, IC, IN) y resistencias de
  aterrizaje van en una fila.

## Actualizaciones de la app

- «Momento tranquilo»: formulario sin datos. Si hay una visita en curso se muestra el aviso y la versión
  nueva se aplica al terminarla; nunca se recarga encima de lo escrito (tampoco desde otra pestaña).
- La versión nueva se detecta solo por eventos (abrir, volver a la app, foco, conexión, cambio de
  sección); sin consultas periódicas.
