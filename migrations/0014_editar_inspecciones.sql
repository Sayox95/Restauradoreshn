-- Edición de inspecciones (permiso visitas_editar): quién y cuándo editó por última vez. El detalle de
-- cada edición (motivo, antes y después) queda en `auditoria` (evento InspeccionEditada). Van en
-- visitas_registro porque `registros` está en el límite de columnas de D1.

ALTER TABLE visitas_registro ADD COLUMN editado_en TEXT;
ALTER TABLE visitas_registro ADD COLUMN editado_por INTEGER REFERENCES usuarios(id);
