-- Roles por módulo (como el SSO: a cada persona se le habilita cada módulo por separado). El rol
-- «Administrador» se reparte en Supervisor (Inspecciones), Administrador de usuarios y Administrador de
-- catálogos, así nadie pierde accesos. Los permisos de cada rol se siembran al arrancar.

INSERT OR IGNORE INTO roles (codigo, nombre) VALUES
  ('utcd_restauradores_supervisor', 'Supervisor'),
  ('utcd_restauradores_admin_usuarios', 'Administrador de usuarios'),
  ('utcd_restauradores_admin_catalogos', 'Administrador de catálogos');
INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_codigo)
  SELECT usuario_id, 'utcd_restauradores_supervisor' FROM usuario_roles WHERE rol_codigo = 'utcd_restauradores_administrador';
INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_codigo)
  SELECT usuario_id, 'utcd_restauradores_admin_usuarios' FROM usuario_roles WHERE rol_codigo = 'utcd_restauradores_administrador';
INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_codigo)
  SELECT usuario_id, 'utcd_restauradores_admin_catalogos' FROM usuario_roles WHERE rol_codigo = 'utcd_restauradores_administrador';
DELETE FROM usuario_roles WHERE rol_codigo = 'utcd_restauradores_administrador';
DELETE FROM rol_permisos WHERE rol_codigo = 'utcd_restauradores_administrador';
DELETE FROM roles WHERE codigo = 'utcd_restauradores_administrador';
