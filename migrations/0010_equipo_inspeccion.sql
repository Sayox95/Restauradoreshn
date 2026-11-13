-- Equipo inspeccionado (restaurador, y los que se agreguen, p. ej. regulador). Va en visitas_registro
-- (registros ya está en el límite de columnas de D1). Las inspecciones existentes son de restaurador;
-- las de la versión anterior no tienen fila y se leen como restaurador (COALESCE).
-- Sin CHECK: los equipos válidos están en shared/constantes.ts (EQUIPOS), así agregar uno no obliga a
-- reconstruir la tabla.

ALTER TABLE visitas_registro ADD COLUMN equipo TEXT NOT NULL DEFAULT 'restaurador';

CREATE INDEX IF NOT EXISTS ix_visitas_registro_equipo ON visitas_registro(equipo);
