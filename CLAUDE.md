# Inspección de Restauradores (UTCD) — instrucciones para Claude

Sistema de hojas de visita para la inspección de restauradores. Sigue los **Lineamientos UTCD · Apps
en la nube**; el stack se queda en Cloudflare (Pages + Functions + D1 + R2).

> Estado: versión 3, migrada a la estructura de los lineamientos (React + TS, módulos, cuentas y
> permisos). Por ahora la inspección tiene un solo estado: **registrada**.

## Términos y navegación

- En pantalla se dice **inspección** (no «visita»); internamente el módulo es `visitas`. «Fecha de
  visita» y «Tipo de visita» (Visita 1/2/3) son campos de la hoja y se quedan.
- Menú: «Inspecciones y registros» (una sola sección: con Consultar, todas; si no, las propias: las que
  registró y en las que figura en el personal) y
  «+ Nueva», que reúne los tipos que declara cada módulo (`OpcionNueva`). Sin botones repetidos.

## Reglas del proyecto

- **Git**: excepción acordada con el dueño del proyecto: los cambios van **directo a `main`** (sin ramas
  ni PR). Commits `tipo(módulo): qué cambia` (≤ 72 caracteres), cuerpo en viñetas que explique el porqué,
  **sin líneas de atribución**.
- **Idioma**: textos, comentarios y nombres en español.
- **Antes de subir**: `npm run verificar` (tsc, eslint, pruebas y build) sin errores, y `npm run format`.
- **Versión** (lineamientos §11): SemVer en `package.json`, visible en Mi cuenta y en el menú. Cada
  publicación sube la versión (parche: correcciones; menor: funciones nuevas) y su commit lleva la
  etiqueta `vX.Y.Z`.
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
- Permisos a la medida por usuario (diferencia acordada, ver «Excepciones acordadas»): el perfil (un rol
  por cuenta) es la plantilla; la pantalla de usuarios marca o desmarca cada permiso y, si difieren, la
  cuenta es «personalizada» (`usuario_permisos`). En SQL, «tiene permiso» solo con `sqlTienePermiso`;
  nunca leer `rol_permisos` directo.
- Base: cambio de esquema = archivo en `migrations/` **y** su entrada en `server/plumbing/esquema.ts`
  (se aplican solos al arrancar). Nunca `SELECT r.*` sobre `registros` (100 columnas, límite de D1).

## Excepciones acordadas

Códigos de la sección «Excepciones previstas» de los lineamientos. Aprobó: dueño del proyecto, 2026-11-11.

- **E1 · Captura sin conexión** — módulo visitas. Motivo: las inspecciones se hacen en zonas sin
  cobertura. La visita y sus fotos (original y copia) se guardan en el dispositivo (IndexedDB, esquema único en
  `src/app/modules/visitas/components/almacen.ts`) y se envían por eventos al reconectar; envío
  idempotente por `visita_num` (índice único) y un solo envío a la vez (Web Locks). Orden del envío:
  registro → copias reducidas → fotos originales, una por una, cada paso anotado en la cola para
  retomarlo donde quedó. Al guardar, la pantalla queda bloqueada mostrando el avance real hasta que
  todo termina; se corta tras 60 s sin avance (`subirArchivo`) o 5 min en total, y entonces la
  inspección queda en el teléfono y se envía sola por eventos.
- **E2 · Fotos en resolución original** — módulo visitas. Motivo: las fotos son evidencia técnica (placas,
  lecturas). 1 obligatoria y hasta 3 más, máximo 25 MB cada una, subidas una por una a R2
  (`fotos/<visita>/<orden>.<ext>`) y registradas en `registros_fotos`. En pantalla se muestra la copia
  reducida (`<orden>-copia.jpg`, generada en el teléfono); el original se abre a pedido en el visor.
- **E3 · PDF generado en la app** — ficha de visita. Motivo: no existe un formato oficial seriado. Se
  genera con jsPDF **al descargarlo** (pantalla final, también sin señal, y botón «PDF» del detalle), con
  los datos y la firma de la base y las copias de las fotos (sin copia, se deriva del original). No se
  sube ni se archiva: la base es la fuente oficial y el PDF siempre coincide con ella. Diferencia
  acordada (dueño del proyecto, 2026-11-27): las inspecciones anteriores sin firma en la base (HV-…)
  entregan su PDF archivado en R2 (`pdfs/<visita>.pdf`), que no se borra; si se editan, el PDF se
  genera de nuevo y en la firma dice «Firma en el PDF original».
- **E4 · Mediciones numéricas cortas en una fila** — formulario de visita. El resto del formulario va en
  una sola columna; solo voltajes (AC, baterías, cargador), corrientes (IA, IB, IC, IN) y resistencias de
  aterrizaje van en una fila.

### Diferencias con los lineamientos v2 (17/11/2026)

Aprobó: dueño del proyecto, 2026-11-17. Motivo común: la app ya estaba avanzada y en uso cuando salió la
versión 2 de los lineamientos; estos cambios moverían datos de producción o rehacer partes estables.
Se revisan con TI al migrar al marco de TI.

- **Permisos a la medida por usuario** (omite §6 «nunca permisos sueltos»): se conserva el perfil como
  plantilla con casillas por permiso (`usuario_permisos`). Al migrar, cada combinación personalizada
  necesita su rol en el SSO o que TI permita permisos por persona.
- **Identificadores numéricos y folio del dispositivo** (omite §9 y E1 v2: UUID y `codigo` desde
  `contadores`): las tablas siguen con `id` entero y el folio `IR-…` lo genera el teléfono.
- **Catálogos sin `codigo`** (omite §10): las inspecciones guardan el texto del ítem, no su código.
- **Formulario de la inspección sin react-hook-form** (omite §11 solo en ese formulario): conserva su
  estado propio (borrador, validación por sección, sin señal) y valida con las mismas reglas compartidas
  que el servidor (`requisitosVisita`). Los demás formularios sí usan react-hook-form.

## Edición de inspecciones

- Permiso `visitas_editar` (solo Administrador). Pantalla aparte (`/visitas/:id/editar`), con conexión:
  todo entra bloqueado y en resumen; el lápiz abre una sección a la vez con los mismos campos del
  registro; «Aplicar» la valida y la bloquea («Modificada»); al final «Guardar cambios» muestra
  antes → después, pide el motivo y guarda todo en una sola escritura.
- No se editan el folio, quién y cuándo registró, la firma ni las fotos (solo su observación).
- El servidor recalcula los cambios (`shared/edicion.ts`), exige completo solo lo de las secciones que
  cambiaron (las antiguas pueden tener datos que hoy se piden) y rechaza con 409 si la inspección
  cambió desde que se abrió (`version`). Historial en `auditoria` (motivo y cambios).

## Actualizaciones de la app

- «Momento tranquilo»: formulario sin datos. Si hay una visita en curso (`marcarTrabajo`) se muestra el
  aviso y la versión nueva se aplica al terminarla; nunca se recarga encima de lo escrito.
- La versión nueva se detecta solo por eventos (abrir, volver a la app, foco, conexión, cambio de
  sección); sin consultas periódicas.
- Página abierta sin service worker al mando (primera visita o recarga forzada): al tomar el control
  uno nuevo se compara `__COMPILACION__` con `/version.json` (sin caché) para saber si quedó vieja.

## Sesión

- Abrir la app: con una sesión confirmada por el servidor en los últimos 14 días se dibuja de inmediato y
  se confirma en paralelo (acuerdo del proyecto, no está en los lineamientos); si no, espera al servidor.
  Si el servidor ya no la reconoce, el ingreso dice «Su sesión terminó…».
- Cerrar sesión (lineamientos): confirma, avisa si hay envíos pendientes o una inspección en curso (se
  conservan), muestra «Cerrando sesión…», borra la sesión en el servidor y los datos del navegador. Sin
  señal queda pendiente (`cierre-pendiente`) y se completa al volver la señal.
- Lo que vive en el dispositivo (borrador y cola sin señal) es de la cuenta que lo creó (`fijarCuenta` en
  `almacen.ts`): cada cuenta ve, continúa y envía solo lo suyo.
- Filtros de listas: `SelectorMultiple` (casillas; sin nada marcado = todos) y en la URL.

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
