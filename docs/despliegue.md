# Despliegue (Cloudflare Pages)

La app se publica sola desde `main` con la integración de Git de Cloudflare Pages. La base D1 y el
bucket R2 son los mismos de la versión anterior: **no se crean recursos nuevos**.

## Paso 1 · Antes de publicar la versión 3: enviar lo pendiente

La versión anterior guardaba en el teléfono las visitas sin enviar en otro almacén. Antes de publicar,
en cada teléfono que tenga visitas pendientes: abra la app con señal y espere a que se envíen.

## Paso 2 · Configuración de compilación (una sola vez)

En el panel de Cloudflare: **Workers & Pages → el proyecto de la app → Settings → Build**:

| Campo | Valor |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |

La versión de Node la toma del archivo `.node-version`. Mientras no se cambie el comando, el despliegue
de la versión 3 falla y sigue publicada la anterior (no se rompe nada).

## Paso 3 · Enlaces (ya existen)

En **Settings → Bindings** deben seguir los de siempre:

- `DB` → la base D1 de la app.
- `PDF_BUCKET` → el bucket R2 (ahí quedan también las fotos). También se acepta el nombre `ARCHIVOS`.

El secreto `ADMIN_TOKEN` de la versión anterior ya no se usa; puede quitarse cuando la versión 3 esté
funcionando.

## Paso 4 · Publicar

**Deployments → Retry deployment** (o subir un cambio a `main`). Al abrir la app por primera vez, la
base se actualiza sola (tablas de cuentas, permisos, auditoría y columnas nuevas de la visita); las
visitas anteriores quedan como **registradas**.

## Paso 5 · Primer administrador

1. En la app, **Solicitar cuenta** con su correo `@eneeutcd.hn` (su usuario es lo que va antes de la @).
2. En el panel: **Storage & Databases → D1 → la base → Console**, pegue (cambiando `su.usuario`):

```sql
UPDATE usuarios SET rol = 'admin', estado = 'activa', activo = 1, solicitud_pendiente = 0 WHERE usuario = 'su.usuario';
DELETE FROM usuario_roles WHERE usuario_id = (SELECT id FROM usuarios WHERE usuario = 'su.usuario');
INSERT INTO usuario_roles (usuario_id, rol_codigo) SELECT id, r.codigo FROM usuarios, (SELECT 'utcd_restauradores_supervisor' AS codigo UNION SELECT 'utcd_restauradores_admin_usuarios' UNION SELECT 'utcd_restauradores_admin_catalogos') r WHERE usuario = 'su.usuario';
```

3. Ingrese. Desde **Administración → Usuarios** aprueba las demás solicitudes y habilita sus
   **accesos** por módulo (Inspecciones: Técnico o Supervisor; Usuarios; Catálogos).

## Opcional · Tiempo real

Sin el Worker del canal la app funciona igual (las listas se actualizan al abrirlas). Para avisos en
vivo: publique `workers/tiempo-real` como un Worker (`npm run tiempo-real:deploy` o desde el panel con
el comando `npx wrangler deploy --config workers/tiempo-real/wrangler.toml`) y en **Settings → Bindings**
del proyecto agregue un *Durable Object* `TIEMPO_REAL` → Worker `restauradores-tiempo-real`, clase
`CanalTiempoReal`.

## Desarrollo local

```bash
npm ci
npm run verificar      # tsc, eslint, pruebas y build
npm run build && npm run pages:dev   # http://localhost:8788 con D1 y R2 locales
```

En local, el primer administrador se crea con `npm run crear-admin -- --usuario admin --nombre "Administrador"`
(con `--sql` solo imprime la sentencia).
