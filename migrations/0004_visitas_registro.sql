-- Visitas con estado, quién las registró y cuándo (hora del servidor y hora de captura en el
-- dispositivo, excepción E1), firma dibujada; fotos con quién las subió; catálogos que se
-- desactivan en lugar de borrarse. Se aplica sola al primer pedido a la API.
-- Las visitas anteriores a esta migración quedan «registrada» y sin usuario (no había cuentas).

ALTER TABLE registros ADD COLUMN estado TEXT NOT NULL DEFAULT 'registrada' CHECK (estado IN ('registrada'));
ALTER TABLE registros ADD COLUMN registrado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE registros ADD COLUMN registrado_en TEXT;
ALTER TABLE registros ADD COLUMN capturado_en TEXT;
ALTER TABLE registros ADD COLUMN firma_img TEXT;
CREATE INDEX IF NOT EXISTS ix_registros_registrado_por ON registros(registrado_por, registrado_en);

ALTER TABLE registros_fotos ADD COLUMN subido_por INTEGER REFERENCES usuarios(id);

ALTER TABLE materiales ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1));
ALTER TABLE tipos ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1));
ALTER TABLE marcas ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1));
