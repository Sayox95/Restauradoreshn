-- Copia reducida de cada foto (excepción E2: «pantallas y documentos usan una copia reducida generada
-- en el navegador; el original se descarga a pedido»). La genera el teléfono al capturar y la sube junto
-- al original; el detalle la muestra en lugar del original de hasta 25 MB.

ALTER TABLE registros_fotos ADD COLUMN copia_r2_key TEXT;
