-- Catálogo de cargos: lo administra Catálogos (antes era una lista fija en el código). La cuenta guarda
-- el cargo por id, así un cambio de nombre se ve en todas las cuentas. Las inspecciones ya registradas
-- conservan el cargo como texto (es el de ese momento).

CREATE TABLE IF NOT EXISTS cargos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  actualizado_en TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cargos_nombre_activo ON cargos (lower(nombre)) WHERE activo = 1;

INSERT INTO cargos (nombre) VALUES ('Técnico SCADA'), ('Ingeniero de Campo'), ('Jefe de Cuadrilla'), ('Supervisor'), ('Auxiliar Técnico'), ('Contratista');

-- Cargos que ya tengan las cuentas y no estén en la lista (no se pierde ninguno).
INSERT INTO cargos (nombre)
  SELECT DISTINCT cargo FROM usuarios WHERE cargo IS NOT NULL AND trim(cargo) <> '' AND lower(cargo) NOT IN (SELECT lower(nombre) FROM cargos);

ALTER TABLE usuarios ADD COLUMN cargo_id INTEGER REFERENCES cargos(id);

UPDATE usuarios SET cargo_id = (SELECT c.id FROM cargos c WHERE lower(c.nombre) = lower(usuarios.cargo)) WHERE cargo IS NOT NULL;

ALTER TABLE usuarios DROP COLUMN cargo;
