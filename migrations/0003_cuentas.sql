-- Cuentas propias, sesiones, roles y permisos, intentos de ingreso y auditoría (lineamientos UTCD:
-- servicios propios que reemplazan al SSO y a la bitácora de TI). Fechas en UTC, ISO-8601.
-- Se aplica sola al primer pedido a la API (server/plumbing/esquema.ts).

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Estado de la cuenta en `estado`; `activo` y `solicitud_pendiente` se mantienen en sincronía
-- (compatibilidad con el proyecto de referencia). Nada se borra.
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre TEXT NOT NULL,
  hash_password TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'supervisor', 'tecnico')),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL,
  solicitud_pendiente INTEGER NOT NULL DEFAULT 0 CHECK (solicitud_pendiente IN (0, 1)),
  correo TEXT COLLATE NOCASE,
  telefono TEXT,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('pendiente', 'activa', 'inactiva', 'rechazada')),
  debe_cambiar_password INTEGER NOT NULL DEFAULT 0 CHECK (debe_cambiar_password IN (0, 1)),
  ultimo_ingreso_en TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_correo ON usuarios(correo) WHERE correo IS NOT NULL;

-- Solo se guarda el hash del token de la cookie.
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_en TEXT NOT NULL,
  creado_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sesiones_usuario ON sesiones(usuario_id);

-- Sembradas al arrancar desde shared/permisos.ts.
CREATE TABLE IF NOT EXISTS permisos (codigo TEXT PRIMARY KEY, modulo TEXT NOT NULL, nombre TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS roles (codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rol_permisos (
  rol_codigo TEXT NOT NULL REFERENCES roles(codigo) ON DELETE CASCADE,
  permiso_codigo TEXT NOT NULL REFERENCES permisos(codigo) ON DELETE CASCADE,
  PRIMARY KEY (rol_codigo, permiso_codigo)
);
CREATE TABLE IF NOT EXISTS usuario_roles (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_codigo TEXT NOT NULL REFERENCES roles(codigo),
  PRIMARY KEY (usuario_id, rol_codigo)
);

-- Límite de intentos fallidos de ingreso (por usuario y por dirección).
CREATE TABLE IF NOT EXISTS intentos_login (
  clave TEXT PRIMARY KEY,
  fallos INTEGER NOT NULL,
  desde TEXT NOT NULL,
  bloqueado_hasta TEXT
);

-- Quién, qué, antes y después de toda escritura (en el mismo batch que la escritura).
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id INTEGER,
  antes TEXT,
  despues TEXT,
  creado_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_auditoria_entidad ON auditoria(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS ix_auditoria_fecha ON auditoria(creado_en);
