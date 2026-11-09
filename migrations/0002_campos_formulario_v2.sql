-- Formulario v2: mangueras extras (COOPER), tipo de batería, potencial y fotos en R2.
-- Ejecutar UNA sola vez (en la consola de D1 o con wrangler).
-- Si alguna línea dice "duplicate column name", esa columna ya existía: se puede ignorar.

ALTER TABLE registros ADD COLUMN term_sens_v TEXT;
ALTER TABLE registros ADD COLUMN mangu_sens_v TEXT;
ALTER TABLE registros ADD COLUMN term_mangu_aux TEXT;
ALTER TABLE registros ADD COLUMN mangu_aux TEXT;
ALTER TABLE registros ADD COLUMN tipo_bateria TEXT;
ALTER TABLE registros ADD COLUMN tiene_potencial TEXT;
ALTER TABLE registros ADD COLUMN alimentado_acometida TEXT;
ALTER TABLE registros ADD COLUMN obs_potencial TEXT;
ALTER TABLE registros ADD COLUMN num_fotos INTEGER;

-- Una fila por foto original guardada en R2 (fotos/{visita}/{orden}.{ext})
CREATE TABLE IF NOT EXISTS registros_fotos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  visita_num   TEXT    NOT NULL,
  orden        INTEGER NOT NULL,
  r2_key       TEXT    NOT NULL,
  observacion  TEXT,
  content_type TEXT,
  size         INTEGER,
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE (visita_num, orden)
);
CREATE INDEX IF NOT EXISTS idx_registros_fotos_visita ON registros_fotos (visita_num);
