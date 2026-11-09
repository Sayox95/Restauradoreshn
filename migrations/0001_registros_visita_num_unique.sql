-- Evita visitas duplicadas en D1 (reintentos de sincronización offline).
-- Ejecutar una sola vez:
--   npx wrangler d1 execute <NOMBRE_DB> --remote --file=migrations/0001_registros_visita_num_unique.sql
--
-- 1) Revisar primero si ya hay duplicados (opcional, solo lectura):
--   SELECT visita_num, COUNT(*) AS n FROM registros GROUP BY visita_num HAVING n > 1;
--
-- 2) Eliminar duplicados conservando el registro más antiguo de cada visita.
--    Si alguna copia tiene el PDF asociado, se copia la clave al registro conservado.
UPDATE registros
SET pdf_r2_key = (
  SELECT r2.pdf_r2_key FROM registros r2
  WHERE r2.visita_num = registros.visita_num
    AND r2.pdf_r2_key IS NOT NULL AND r2.pdf_r2_key <> ''
  LIMIT 1
)
WHERE (pdf_r2_key IS NULL OR pdf_r2_key = '')
  AND id IN (SELECT MIN(id) FROM registros GROUP BY visita_num);

DELETE FROM registros
WHERE id NOT IN (SELECT MIN(id) FROM registros GROUP BY visita_num);

-- 3) Garantizar unicidad a futuro
CREATE UNIQUE INDEX IF NOT EXISTS idx_registros_visita_num ON registros (visita_num);
