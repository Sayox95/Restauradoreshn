-- Permisos a la medida por usuario. El perfil (un rol por cuenta: Técnico, Supervisor o Administrador)
-- vuelve a ser la plantilla de permisos; si a una cuenta se le marcan otros, quedan en usuario_permisos
-- y la cuenta es «personalizada». Las cuentas con roles por módulo conservan exactamente sus permisos:
-- si coinciden con su perfil usan el rol; si no, quedan personalizadas. Los permisos de cada rol se
-- siembran al arrancar.

CREATE TABLE IF NOT EXISTS usuario_permisos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  permiso_codigo TEXT NOT NULL REFERENCES permisos(codigo) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, permiso_codigo)
);

ALTER TABLE usuarios ADD COLUMN permisos_personalizados INTEGER NOT NULL DEFAULT 0 CHECK (permisos_personalizados IN (0, 1));

-- Permisos que cada cuenta tiene hoy por sus roles.
INSERT OR IGNORE INTO usuario_permisos (usuario_id, permiso_codigo)
  SELECT DISTINCT ur.usuario_id, rp.permiso_codigo FROM usuario_roles ur JOIN rol_permisos rp ON rp.rol_codigo = ur.rol_codigo;

-- Personalizadas: las que tienen roles y cuyos permisos no son exactamente los de su perfil.
WITH plantilla (perfil, permiso) AS (VALUES
  ('tecnico', 'utcd_restauradores_visitas_registrar'),
  ('supervisor', 'utcd_restauradores_visitas_registrar'),
  ('supervisor', 'utcd_restauradores_visitas_consultar'),
  ('supervisor', 'utcd_restauradores_visitas_exportar'),
  ('admin', 'utcd_restauradores_visitas_registrar'),
  ('admin', 'utcd_restauradores_visitas_consultar'),
  ('admin', 'utcd_restauradores_visitas_exportar'),
  ('admin', 'utcd_restauradores_usuarios_gestionar'),
  ('admin', 'utcd_restauradores_catalogos_gestionar'))
UPDATE usuarios SET permisos_personalizados = 1
WHERE EXISTS (SELECT 1 FROM usuario_roles ur WHERE ur.usuario_id = usuarios.id)
  AND (EXISTS (SELECT 1 FROM usuario_permisos up WHERE up.usuario_id = usuarios.id
                 AND up.permiso_codigo NOT IN (SELECT permiso FROM plantilla WHERE perfil = usuarios.rol))
    OR EXISTS (SELECT 1 FROM plantilla t WHERE t.perfil = usuarios.rol
                 AND t.permiso NOT IN (SELECT up.permiso_codigo FROM usuario_permisos up WHERE up.usuario_id = usuarios.id)));

DELETE FROM usuario_permisos WHERE usuario_id IN (SELECT id FROM usuarios WHERE permisos_personalizados = 0);

-- Un rol por cuenta: el de su perfil.
INSERT OR IGNORE INTO roles (codigo, nombre) VALUES
  ('utcd_restauradores_tecnico', 'Técnico'), ('utcd_restauradores_supervisor', 'Supervisor'), ('utcd_restauradores_administrador', 'Administrador');

DELETE FROM usuario_roles;

INSERT INTO usuario_roles (usuario_id, rol_codigo)
  SELECT id, CASE rol WHEN 'admin' THEN 'utcd_restauradores_administrador' WHEN 'supervisor' THEN 'utcd_restauradores_supervisor' ELSE 'utcd_restauradores_tecnico' END
  FROM usuarios;

DELETE FROM rol_permisos WHERE rol_codigo IN ('utcd_restauradores_admin_usuarios', 'utcd_restauradores_admin_catalogos');

DELETE FROM roles WHERE codigo IN ('utcd_restauradores_admin_usuarios', 'utcd_restauradores_admin_catalogos');
