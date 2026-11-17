-- Nombre del evento de dominio en cada fila de auditoría (lineamientos v2 §7): el mismo que tendrá en la
-- bitácora del marco de TI (InspeccionRegistrada, CuentaAprobada…). Las filas anteriores quedan sin él.

ALTER TABLE auditoria ADD COLUMN evento TEXT;
