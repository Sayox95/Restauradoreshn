-- Esquema original del sistema (antes de los lineamientos UTCD). En producción estas tablas ya
-- existen y la migración no hace nada; sirve para crear una base nueva (local o de pruebas) igual a
-- la de producción. Las migraciones siguientes la llevan al esquema actual.

CREATE TABLE IF NOT EXISTS restauradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  energis TEXT,
  zona TEXT,
  sector TEXT,
  subestacion TEXT,
  ubicacion TEXT,
  circuito TEXT,
  longitud REAL,
  latitud REAL,
  estado TEXT DEFAULT 'ACTIVO',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS materiales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT,
  nombre TEXT,
  unidad TEXT,
  stock REAL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS personal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  cargo TEXT,
  empleado_id TEXT,
  activo INTEGER DEFAULT 1,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS tipos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  elemento TEXT,
  tipo TEXT
);

CREATE TABLE IF NOT EXISTS marcas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  elemento TEXT,
  marca TEXT,
  modelo TEXT,
  tipo_control TEXT
);

CREATE TABLE IF NOT EXISTS tableros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  marca TEXT,
  campo TEXT,
  orden INTEGER DEFAULT 99,
  activo INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visita_num TEXT NOT NULL,
  fecha_visita TEXT,
  hora_llegada TEXT,
  hora_salida TEXT,
  tipo_visita TEXT,
  codigo_energis TEXT,
  circuito TEXT,
  ubicacion TEXT,
  zona TEXT,
  sector TEXT,
  subestacion TEXT,
  latitud REAL,
  longitud REAL,
  gen_distribuida TEXT,
  tipo_recon TEXT,
  marca_reconectador TEXT,
  modelo_recon TEXT,
  serie_recon TEXT,
  medio_extincion TEXT,
  tipo_control TEXT,
  serie_control TEXT,
  proview_control TEXT,
  has_modem1 INTEGER,
  tipo_modem1 TEXT,
  marca_modem1 TEXT,
  modelo_modem1 TEXT,
  serie_modem1 TEXT,
  antena_modem1 TEXT,
  tipo_antena1 TEXT,
  tec_modem1 TEXT,
  has_modem2 INTEGER,
  tipo_modem2 TEXT,
  marca_modem2 TEXT,
  modelo_modem2 TEXT,
  serie_modem2 TEXT,
  antena_modem2 TEXT,
  tipo_antena2 TEXT,
  tec_modem2 TEXT,
  tablero_marca TEXT,
  tablero_campos TEXT,
  alarma_presente TEXT,
  reset_alarma TEXT,
  desc_alarma TEXT,
  battery_test TEXT,
  battery_test_med REAL,
  cambio_baterias TEXT,
  medicion_ac REAL,
  medicion_bat REAL,
  medicion_cargador REAL,
  corr_ia REAL,
  corr_ib REAL,
  corr_ic REAL,
  corr_in REAL,
  ajuste_activo TEXT,
  c_apert_fase REAL,
  c_apert_neutro REAL,
  gabinete TEXT,
  borneras TEXT,
  obs_estado_fisico TEXT,
  ater_rest_state TEXT,
  ater_ctrl_state TEXT,
  ater_pot_state TEXT,
  cable_tierra TEXT,
  num_varillas INTEGER,
  ater_control REAL,
  ater_restaurador REAL,
  ater_otros REAL,
  tipo_cuchilla TEXT,
  estado_cuchillas TEXT,
  num_cuchillas INTEGER,
  pararrayos TEXT,
  num_pararrayos INTEGER,
  pot_cantidad INTEGER,
  pot_pararrayos TEXT,
  pot_cuchilla TEXT,
  fase_conexion TEXT,
  materiales_json TEXT,
  materiales_resumen TEXT,
  obs_materiales TEXT,
  obs_generales TEXT,
  personal_json TEXT,
  personal_resumen TEXT,
  firma_responsable TEXT,
  obs_responsable TEXT,
  pdf_r2_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_registros_energis ON registros (codigo_energis);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros (fecha_visita);
CREATE INDEX IF NOT EXISTS idx_registros_circuito ON registros (circuito);
