-- Eliminar inspecciones (permiso utcd_restauradores_visitas_eliminar). Como piden los lineamientos, nada
-- se borra: la inspección queda oculta en listas, detalle, archivos y CSV, y se guarda quién la eliminó,
-- cuándo y por qué. Sus datos, fotos y PDF se conservan.

ALTER TABLE visitas_registro ADD COLUMN eliminada_en TEXT;

ALTER TABLE visitas_registro ADD COLUMN eliminada_por INTEGER REFERENCES usuarios(id);

ALTER TABLE visitas_registro ADD COLUMN motivo_eliminacion TEXT;
