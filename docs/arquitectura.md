# Arquitectura

Inspección de Restauradores sigue los **Lineamientos UTCD · Apps en la nube** con el stack en
Cloudflare: Pages (app React) + Functions (API) + D1 (base) + R2 (fotos y PDF).

## Estructura

```
functions/api/[[ruta]].ts   Única Function: entrega cada solicitud a server/app.ts
server/plumbing/            router (cada ruta declara su permiso), sesión, http, esquema, fotos, tiempo real
server/modules/<modulo>/    endpoints.ts (ruta base /api/v1/<modulo>, lo propio bajo /mios), permisos.ts,
                            comun.ts y features/<accion>.ts
shared/                     permisos, constantes, esquemas zod y reglas de la hoja de visita (servidor y app)
src/app/modules/<modulo>/   permisos.ts, api.ts, urls.ts, <modulo>-menu.ts, <modulo>-routing.tsx,
                            index.ts, features/<accion>/pagina.tsx, components/
src/common/                 seguridad, http, componentes, tonos, utilidades, PWA, tiempo real
migrations/                 SQL de cada cambio de esquema (y su copia en server/plumbing/esquema.ts)
workers/tiempo-real/        Worker opcional con el Durable Object del canal de tiempo real
tests/                      pruebas de la API con una D1 y un R2 en memoria
```

## Módulos

| Módulo | Servidor | App |
| --- | --- | --- |
| visitas | registrar, listar (todas / mías), ver, fotos, PDF, exportar CSV | inspección de restaurador (10 secciones), inspecciones y registros (con lo pendiente de envío), detalle |
| usuarios | listar, ver, crear, editar, aprobar / rechazar solicitudes | administración de cuentas |
| catalogos | catálogos de la hoja (restauradores, materiales, tipos, marcas), tableros por marca, zona horaria; el personal de la inspección sale de los usuarios | lista de catálogos (`/admin/catalogos`) y una pantalla por catálogo (`/admin/catalogos/<clave>`) para crear y editar |
| sesion | ingreso, salida, solicitud de cuenta, cambio de contraseña | ingreso, mi cuenta |

## Menú y «+ Nueva»

- Cada módulo declara sus opciones de menú (`<modulo>-menu.ts`) y lo que se puede empezar desde
  «+ Nueva» (`OpcionNueva`: hoy «Inspección de restaurador»; después, regulador y otros).
  `src/app/menu.ts` las reúne y `src/app/nueva/pagina.tsx` las muestra según los permisos.
- En pantalla el registro se llama **inspección**; en el código y la base el módulo sigue siendo
  `visitas` (tabla `registros`).
- Folio generado en el dispositivo: `IR-AAAAMMDD-HHMMSS-XXXX` (4 caracteres al azar para que no choque
  aunque dos personas guarden en el mismo segundo). Los folios anteriores `HV-…` siguen válidos.

## Decisiones

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Reglas de la hoja | `shared/visitas.ts` (`requisitosVisita`) las usan la app y el servidor | Se escriben una vez: la app valida por sección y el servidor rechaza una visita incompleta (422). |
| Atomicidad | Visita + auditoría en `DB.batch()` | Se guardan juntas o no se guardan. |
| Auditoría | Cada fila lleva `evento`, el nombre del evento de dominio que tendrá en TI (`server/plumbing/eventos.ts`) | Al migrar, la bitácora por eventos usa los mismos nombres (lineamientos §7). |
| Idempotencia | `visita_num` único (índice); reenviar la misma visita devuelve la existente | El envío se repite sin duplicar (E1). |
| Columnas | Nunca `SELECT r.*` sobre `registros` | La tabla tiene 100 columnas y D1 no devuelve resultados de más de 100. |
| Esquema | Migraciones aplicadas solas al arrancar (`asegurarEsquema`); con todo al día basta una consulta (`alDia`: migraciones anotadas y huella de permisos) | No hay pasos manuales al publicar y el primer pedido de un servidor que despierta no espera. |
| Abrir la app | Con una sesión confirmada en los últimos 14 días se dibuja de inmediato y el servidor la confirma en paralelo; si no, espera al servidor | Abre al instante sin mostrar nada que luego se quite: tras cada uso a la sesión le quedan al menos 15 días. |
| Cerrar sesión | Confirmación (avisa si hay envíos pendientes o una inspección en curso, que se conservan), «Cerrando sesión…», limpieza y aviso «Sesión cerrada.»; sin señal el cierre queda pendiente | Lineamientos: «Cerrar sesión la borra en el servidor y limpia los datos del navegador» y «Cerrar sesión con envíos pendientes pide confirmación y no borra la cola». |
| Filtros | `SelectorMultiple` (listas con casillas; sin nada marcado = todos), en la URL; circuitos agrupados por subestación con buscador | Lineamientos de UX; los filtros se conservan al abrir una inspección y volver. |
| Tiempo real | Avisos sin datos por WebSocket (opcional) | Si el Worker no está publicado la app funciona igual y no reintenta. |

## Excepciones acordadas (ver CLAUDE.md)

- **E1 · Captura sin conexión**: `src/app/modules/visitas/components/almacen.ts` (IndexedDB:
  cola, borrador y catálogos) y `envio.ts` (envío por eventos, un solo envío a la vez con Web Locks).
- **E2 · Fotos originales**: 1 obligatoria y hasta 3 más, ≤ 25 MB, subidas una por una a
  `fotos/<visita>/<orden>.<ext>`; copia reducida solo para la vista previa y el PDF.
- **E3 · PDF generado en la app**: `components/ficha-pdf.ts` (jsPDF), archivado en `pdfs/<visita>.pdf`.
- **E4 · Mediciones en una fila**: `FilaMediciones` (voltajes, corrientes, resistencias); el resto en una columna.
