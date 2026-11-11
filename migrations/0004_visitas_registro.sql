-- Registro de cada visita: estado, quién la registró y cuándo (hora del servidor y hora de captura en
-- el dispositivo, excepción E1) y la firma dibujada. Va en una tabla aparte porque `registros` ya
-- tiene 96 columnas en producción y D1 no permite más de 100 por tabla.
-- Las visitas anteriores no tienen fila aquí: se leen como «registrada» y sin usuario.

CREATE TABLE IF NOT EXISTS visitas_registro (
  registro_id INTEGER PRIMARY KEY REFERENCES registros(id),
  estado TEXT NOT NULL DEFAULT 'registrada' CHECK (estado IN ('registrada')),
  registrado_por INTEGER REFERENCES usuarios(id),
  registrado_en TEXT,
  capturado_en TEXT,
  firma_img TEXT
);
CREATE INDEX IF NOT EXISTS ix_visitas_registro_por ON visitas_registro(registrado_por, registrado_en);

-- Fotos con quién las subió; catálogos que se desactivan en lugar de borrarse.
ALTER TABLE registros_fotos ADD COLUMN subido_por INTEGER REFERENCES usuarios(id);
ALTER TABLE materiales ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1));
ALTER TABLE tipos ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1));
ALTER TABLE marcas ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1));
