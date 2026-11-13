import { MODULOS, ROLES_SISTEMA, TODOS_LOS_PERMISOS } from '../../shared/permisos';
import { type Env } from './contexto';

/**
 * Migraciones que el servidor aplica solo al arrancar (lineamientos UTCD: «desplegar basta»). Cada
 * entrada equivale a su archivo en migrations/ (tests/esquema.test.ts verifica que coincidan
 * sentencia por sentencia), sabe si ya está aplicada y queda anotada en d1_migrations.
 * Nunca se edita una migración ya aplicada: un cambio nuevo es otra migración hacia adelante.
 */
export interface Cambio {
  migracion: string;
  sentencias: string[];
  /** Cómo saber si ya se aplicó (en producción 0000 a 0002 ya existían antes de esta versión). */
  yaAplicado: (env: Env) => Promise<boolean>;
}

export const BASE = [
  `CREATE TABLE IF NOT EXISTS restauradores ( id INTEGER PRIMARY KEY AUTOINCREMENT, energis TEXT, zona TEXT, sector TEXT, subestacion TEXT, ubicacion TEXT, circuito TEXT, longitud REAL, latitud REAL, estado TEXT DEFAULT 'ACTIVO', updated_at TEXT )`,
  `CREATE TABLE IF NOT EXISTS materiales ( id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT, nombre TEXT, unidad TEXT, stock REAL DEFAULT 0, updated_at TEXT )`,
  `CREATE TABLE IF NOT EXISTS personal ( id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, cargo TEXT, empleado_id TEXT, activo INTEGER DEFAULT 1, updated_at TEXT )`,
  `CREATE TABLE IF NOT EXISTS tipos ( id INTEGER PRIMARY KEY AUTOINCREMENT, elemento TEXT, tipo TEXT )`,
  `CREATE TABLE IF NOT EXISTS marcas ( id INTEGER PRIMARY KEY AUTOINCREMENT, elemento TEXT, marca TEXT, modelo TEXT, tipo_control TEXT )`,
  `CREATE TABLE IF NOT EXISTS tableros ( id INTEGER PRIMARY KEY AUTOINCREMENT, marca TEXT, campo TEXT, orden INTEGER DEFAULT 99, activo INTEGER DEFAULT 1 )`,
  `CREATE TABLE IF NOT EXISTS registros ( id INTEGER PRIMARY KEY AUTOINCREMENT, visita_num TEXT NOT NULL, fecha_visita TEXT, hora_llegada TEXT, hora_salida TEXT, tipo_visita TEXT, codigo_energis TEXT, circuito TEXT, ubicacion TEXT, zona TEXT, sector TEXT, subestacion TEXT, latitud REAL, longitud REAL, gen_distribuida TEXT, tipo_recon TEXT, marca_reconectador TEXT, modelo_recon TEXT, serie_recon TEXT, medio_extincion TEXT, tipo_control TEXT, serie_control TEXT, proview_control TEXT, has_modem1 INTEGER, tipo_modem1 TEXT, marca_modem1 TEXT, modelo_modem1 TEXT, serie_modem1 TEXT, antena_modem1 TEXT, tipo_antena1 TEXT, tec_modem1 TEXT, has_modem2 INTEGER, tipo_modem2 TEXT, marca_modem2 TEXT, modelo_modem2 TEXT, serie_modem2 TEXT, antena_modem2 TEXT, tipo_antena2 TEXT, tec_modem2 TEXT, tablero_marca TEXT, tablero_campos TEXT, alarma_presente TEXT, reset_alarma TEXT, desc_alarma TEXT, battery_test TEXT, battery_test_med REAL, cambio_baterias TEXT, medicion_ac REAL, medicion_bat REAL, medicion_cargador REAL, corr_ia REAL, corr_ib REAL, corr_ic REAL, corr_in REAL, ajuste_activo TEXT, c_apert_fase REAL, c_apert_neutro REAL, gabinete TEXT, borneras TEXT, obs_estado_fisico TEXT, ater_rest_state TEXT, ater_ctrl_state TEXT, ater_pot_state TEXT, cable_tierra TEXT, num_varillas INTEGER, ater_control REAL, ater_restaurador REAL, ater_otros REAL, tipo_cuchilla TEXT, estado_cuchillas TEXT, num_cuchillas INTEGER, pararrayos TEXT, num_pararrayos INTEGER, pot_cantidad INTEGER, pot_pararrayos TEXT, pot_cuchilla TEXT, fase_conexion TEXT, materiales_json TEXT, materiales_resumen TEXT, obs_materiales TEXT, obs_generales TEXT, personal_json TEXT, personal_resumen TEXT, firma_responsable TEXT, obs_responsable TEXT, pdf_r2_key TEXT )`,
  `CREATE INDEX IF NOT EXISTS idx_registros_energis ON registros (codigo_energis)`,
  `CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros (fecha_visita)`,
  `CREATE INDEX IF NOT EXISTS idx_registros_circuito ON registros (circuito)`,
];

export const VISITA_UNICA = [
  `UPDATE registros SET pdf_r2_key = ( SELECT r2.pdf_r2_key FROM registros r2 WHERE r2.visita_num = registros.visita_num AND r2.pdf_r2_key IS NOT NULL AND r2.pdf_r2_key <> '' LIMIT 1 ) WHERE (pdf_r2_key IS NULL OR pdf_r2_key = '') AND id IN (SELECT MIN(id) FROM registros GROUP BY visita_num)`,
  `DELETE FROM registros WHERE id NOT IN (SELECT MIN(id) FROM registros GROUP BY visita_num)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_registros_visita_num ON registros (visita_num)`,
];

export const CAMPOS_V2 = [
  `ALTER TABLE registros ADD COLUMN term_sens_v TEXT`,
  `ALTER TABLE registros ADD COLUMN mangu_sens_v TEXT`,
  `ALTER TABLE registros ADD COLUMN term_mangu_aux TEXT`,
  `ALTER TABLE registros ADD COLUMN mangu_aux TEXT`,
  `ALTER TABLE registros ADD COLUMN tipo_bateria TEXT`,
  `ALTER TABLE registros ADD COLUMN tiene_potencial TEXT`,
  `ALTER TABLE registros ADD COLUMN alimentado_acometida TEXT`,
  `ALTER TABLE registros ADD COLUMN obs_potencial TEXT`,
  `ALTER TABLE registros ADD COLUMN num_fotos INTEGER`,
  `CREATE TABLE IF NOT EXISTS registros_fotos ( id INTEGER PRIMARY KEY AUTOINCREMENT, visita_num TEXT NOT NULL, orden INTEGER NOT NULL, r2_key TEXT NOT NULL, observacion TEXT, content_type TEXT, size INTEGER, created_at TEXT DEFAULT (datetime('now')), UNIQUE (visita_num, orden) )`,
  `CREATE INDEX IF NOT EXISTS idx_registros_fotos_visita ON registros_fotos (visita_num)`,
];

export const CUENTAS = [
  `CREATE TABLE IF NOT EXISTS configuracion ( clave TEXT PRIMARY KEY, valor TEXT NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS usuarios ( id INTEGER PRIMARY KEY, usuario TEXT NOT NULL UNIQUE COLLATE NOCASE, nombre TEXT NOT NULL, hash_password TEXT NOT NULL, rol TEXT NOT NULL CHECK (rol IN ('admin', 'supervisor', 'tecnico')), activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)), creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL, solicitud_pendiente INTEGER NOT NULL DEFAULT 0 CHECK (solicitud_pendiente IN (0, 1)), correo TEXT COLLATE NOCASE, telefono TEXT, estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('pendiente', 'activa', 'inactiva', 'rechazada')), debe_cambiar_password INTEGER NOT NULL DEFAULT 0 CHECK (debe_cambiar_password IN (0, 1)), ultimo_ingreso_en TEXT )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_correo ON usuarios(correo) WHERE correo IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS sesiones ( token_hash TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, expira_en TEXT NOT NULL, creado_en TEXT NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS ix_sesiones_usuario ON sesiones(usuario_id)`,
  `CREATE TABLE IF NOT EXISTS permisos (codigo TEXT PRIMARY KEY, modulo TEXT NOT NULL, nombre TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS roles (codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rol_permisos ( rol_codigo TEXT NOT NULL REFERENCES roles(codigo) ON DELETE CASCADE, permiso_codigo TEXT NOT NULL REFERENCES permisos(codigo) ON DELETE CASCADE, PRIMARY KEY (rol_codigo, permiso_codigo) )`,
  `CREATE TABLE IF NOT EXISTS usuario_roles ( usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, rol_codigo TEXT NOT NULL REFERENCES roles(codigo), PRIMARY KEY (usuario_id, rol_codigo) )`,
  `CREATE TABLE IF NOT EXISTS intentos_login ( clave TEXT PRIMARY KEY, fallos INTEGER NOT NULL, desde TEXT NOT NULL, bloqueado_hasta TEXT )`,
  `CREATE TABLE IF NOT EXISTS auditoria ( id INTEGER PRIMARY KEY, usuario_id INTEGER REFERENCES usuarios(id), accion TEXT NOT NULL, entidad TEXT NOT NULL, entidad_id INTEGER, antes TEXT, despues TEXT, creado_en TEXT NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS ix_auditoria_entidad ON auditoria(entidad, entidad_id)`,
  `CREATE INDEX IF NOT EXISTS ix_auditoria_fecha ON auditoria(creado_en)`,
];

export const VISITAS_REGISTRO = [
  `CREATE TABLE IF NOT EXISTS visitas_registro ( registro_id INTEGER PRIMARY KEY REFERENCES registros(id), estado TEXT NOT NULL DEFAULT 'registrada' CHECK (estado IN ('registrada')), registrado_por INTEGER REFERENCES usuarios(id), registrado_en TEXT, capturado_en TEXT, firma_img TEXT )`,
  `CREATE INDEX IF NOT EXISTS ix_visitas_registro_por ON visitas_registro(registrado_por, registrado_en)`,
  `ALTER TABLE registros_fotos ADD COLUMN subido_por INTEGER REFERENCES usuarios(id)`,
  `ALTER TABLE materiales ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))`,
  `ALTER TABLE tipos ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))`,
  `ALTER TABLE marcas ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))`,
];

export const CARGO_USUARIO = [`ALTER TABLE usuarios ADD COLUMN cargo TEXT`];

const existeTabla = (tabla: string) => async (env: Env) =>
  !!(await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").bind(tabla).first());
const existeIndice = (indice: string) => async (env: Env) =>
  !!(await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").bind(indice).first());
const existeColumna = (tabla: string, columna: string) => async (env: Env) =>
  (await env.DB.prepare(`PRAGMA table_info(${tabla})`).all<{ name: string }>()).results.some((c) => c.name === columna);

export const CAMBIOS: Cambio[] = [
  { migracion: '0000_base.sql', sentencias: BASE, yaAplicado: existeTabla('registros') },
  { migracion: '0001_registros_visita_num_unique.sql', sentencias: VISITA_UNICA, yaAplicado: existeIndice('idx_registros_visita_num') },
  { migracion: '0002_campos_formulario_v2.sql', sentencias: CAMPOS_V2, yaAplicado: existeColumna('registros', 'num_fotos') },
  { migracion: '0003_cuentas.sql', sentencias: CUENTAS, yaAplicado: existeTabla('usuarios') },
  { migracion: '0004_visitas_registro.sql', sentencias: VISITAS_REGISTRO, yaAplicado: existeTabla('visitas_registro') },
  { migracion: '0005_cargo_usuario.sql', sentencias: CARGO_USUARIO, yaAplicado: existeColumna('usuarios', 'cargo') },
];

export let listo = false;

/** Solo para pruebas: cada prueba usa una base nueva que hay que preparar de nuevo. */
export function reiniciarEsquemaParaPruebas() {
  listo = false;
}

/**
 * Cada solicitud hace su propia verificación hasta que una termina bien. No se comparte una promesa
 * en curso entre solicitudes: en Workers, si la solicitud que la inició se cancela, esa promesa no
 * termina nunca y todas las demás quedarían esperando. Aplicar dos veces a la vez es seguro: cada
 * migración va en una transacción y la segunda falla sin cambiar nada.
 */
export async function asegurarEsquema(env: Env): Promise<void> {
  if (listo) return;
  await aplicar(env);
  await sembrarPermisos(env);
  listo = true;
}

/**
 * Equivale a `migration-seed --scope permisos` del marco de TI: deja en la base los módulos, permisos
 * y roles tal como están en shared/permisos.ts (idempotente). A los usuarios que aún no tienen rol
 * en usuario_roles se les asigna el de su perfil.
 */
export async function sembrarPermisos(env: Env) {
  const db = env.DB;
  const codigos = TODOS_LOS_PERMISOS;
  const roles = ROLES_SISTEMA.map((r) => r.codigo);
  await db.batch([
    ...MODULOS.flatMap((m) =>
      m.permisos.map((p) =>
        db
          .prepare(
            'INSERT INTO permisos (codigo, modulo, nombre) VALUES (?,?,?) ON CONFLICT(codigo) DO UPDATE SET modulo = excluded.modulo, nombre = excluded.nombre',
          )
          .bind(p.codigo, m.codigo, p.nombre),
      ),
    ),
    db.prepare(`DELETE FROM permisos WHERE codigo NOT IN (${codigos.map(() => '?').join(',')})`).bind(...codigos),
    ...ROLES_SISTEMA.map((r) =>
      db.prepare('INSERT INTO roles (codigo, nombre) VALUES (?,?) ON CONFLICT(codigo) DO UPDATE SET nombre = excluded.nombre').bind(r.codigo, r.nombre),
    ),
    db.prepare(`DELETE FROM rol_permisos WHERE rol_codigo IN (${roles.map(() => '?').join(',')})`).bind(...roles),
    ...ROLES_SISTEMA.flatMap((r) => r.permisos.map((p) => db.prepare('INSERT INTO rol_permisos (rol_codigo, permiso_codigo) VALUES (?,?)').bind(r.codigo, p))),
    db
      .prepare(
        `INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_codigo)
       SELECT u.id, CASE u.rol ${ROLES_SISTEMA.map(() => 'WHEN ? THEN ?').join(' ')} END FROM usuarios u
       WHERE NOT EXISTS (SELECT 1 FROM usuario_roles ur WHERE ur.usuario_id = u.id)`,
      )
      .bind(...ROLES_SISTEMA.flatMap((r) => [r.perfil, r.codigo])),
  ]);
}

/**
 * Quita los «ALTER TABLE … ADD COLUMN» cuya columna ya existe (una base de producción que alguien
 * ajustó a mano, o un intento anterior): así una migración no falla por una columna repetida.
 */
async function pendientes(env: Env, sentencias: string[]) {
  const quedan: string[] = [];
  for (const sql of sentencias) {
    const m = /^ALTER TABLE (\w+) ADD COLUMN (\w+)/i.exec(sql.trim());
    if (m && (await existeColumna(m[1]!, m[2]!)(env))) continue;
    quedan.push(sql);
  }
  return quedan;
}

export async function aplicar(env: Env) {
  for (const c of CAMBIOS) {
    if (await c.yaAplicado(env)) continue;
    try {
      const sentencias = await pendientes(env, c.sentencias);
      if (sentencias.length) await env.DB.batch(sentencias.map((sql) => env.DB.prepare(sql)));
    } catch (e) {
      // Otra instancia pudo aplicarla al mismo tiempo: si ya quedó aplicada, se sigue.
      if (!(await c.yaAplicado(env))) throw e;
    }
    await env.DB.batch([
      env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)',
      ),
      env.DB.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)').bind(c.migracion),
    ]);
  }
}
