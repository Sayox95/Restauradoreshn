-- Cargo de cada cuenta (uno de CARGOS_PERSONAL): el personal de la inspección sale de los usuarios,
-- ya no del catálogo «Personal» (que queda en la base sin usarse, igual que su N° de empleado).

ALTER TABLE usuarios ADD COLUMN cargo TEXT;
