import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAMBIOS, reiniciarEsquemaParaPruebas } from '../server/plumbing/esquema';
import { visitaCompleta } from './datos';
import { crearEntorno } from './entorno';

/** Sentencias de un archivo .sql (sin comentarios y con los espacios normalizados). */
function sentencias(archivo: string) {
  const texto = readFileSync(join(import.meta.dirname, '..', 'migrations', archivo), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  return texto
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

describe('migraciones', () => {
  it('cada entrada de esquema.ts coincide sentencia por sentencia con su archivo', () => {
    for (const c of CAMBIOS) expect(c.sentencias.map((s) => s.replace(/\s+/g, ' ').trim())).toEqual(sentencias(c.migracion));
  });

  it('sobre la base de producción (hasta 0002) aplica sola las cuentas y el registro de visitas', async () => {
    const t = await crearEntorno(2);
    // Como en producción: `registros` llega con más columnas de las del archivo base (96 allá). Se
    // llena hasta el límite de D1 (100) para asegurar que ninguna migración le agregue columnas.
    const columnas = () => t.DB.prepare('SELECT COUNT(*) AS n FROM pragma_table_info(?)').bind('registros').first<{ n: number }>();
    for (let i = (await columnas())!.n; i < 100; i++) await t.DB.exec(`ALTER TABLE registros ADD COLUMN extra_${i} TEXT;`);
    // Una visita guardada por la versión anterior (sin usuario).
    await t.DB.prepare("INSERT INTO registros (visita_num, fecha_visita, has_modem1) VALUES ('HV-ANTERIOR', '2026-10-01', 1)").run();
    await t.DB.exec(
      'CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);',
    );
    // El primer pedido a la API aplica 0003 y 0004 (con «usuarios» creada, el usuario de prueba se puede crear).
    expect((await t.pedir('GET', '/api/v1/sesion/yo')).status).toBe(200);
    const sup = await t.crearUsuario('carla', 'supervisor');
    const aplicadas = (await t.DB.prepare('SELECT name FROM d1_migrations ORDER BY name').all<{ name: string }>()).results.map((r) => r.name);
    expect(aplicadas).toEqual([
      '0003_cuentas.sql',
      '0004_visitas_registro.sql',
      '0005_cargo_usuario.sql',
      '0006_roles_por_modulo.sql',
      '0007_permisos_usuario.sql',
    ]);
    expect((await columnas())!.n).toBe(100);
    // La visita anterior queda «registrada» y la ve quien puede consultar todas.
    const lista = (await t.pedir('GET', '/api/v1/visitas', { cookie: sup.cookie })).datos.datos;
    expect(lista.filas).toMatchObject([{ visita_num: 'HV-ANTERIOR', estado: 'registrada', registrado_por: null }]);
    expect((await t.pedir('POST', '/api/v1/visitas', { cookie: sup.cookie, cuerpo: visitaCompleta() })).status).toBe(201);
  });

  it('las cuentas con roles por módulo vuelven a un rol por perfil sin perder ni ganar permisos', async () => {
    const t = await crearEntorno(6);
    const P = {
      registrar: 'utcd_restauradores_visitas_registrar',
      consultar: 'utcd_restauradores_visitas_consultar',
      exportar: 'utcd_restauradores_visitas_exportar',
      usuarios: 'utcd_restauradores_usuarios_gestionar',
      catalogos: 'utcd_restauradores_catalogos_gestionar',
    };
    // Como en producción con 0006: roles por módulo ya sembrados con sus permisos.
    await t.DB.exec(`
      INSERT INTO permisos (codigo, modulo, nombre) VALUES ('${P.registrar}', 'v', 'x'), ('${P.consultar}', 'v', 'x'), ('${P.exportar}', 'v', 'x'), ('${P.usuarios}', 'u', 'x'), ('${P.catalogos}', 'c', 'x');
      INSERT INTO roles (codigo, nombre) VALUES ('utcd_restauradores_tecnico', 'Técnico');
      INSERT INTO rol_permisos VALUES ('utcd_restauradores_tecnico', '${P.registrar}'), ('utcd_restauradores_supervisor', '${P.registrar}'), ('utcd_restauradores_supervisor', '${P.consultar}'), ('utcd_restauradores_supervisor', '${P.exportar}'), ('utcd_restauradores_admin_usuarios', '${P.usuarios}'), ('utcd_restauradores_admin_catalogos', '${P.catalogos}');
      INSERT INTO usuarios (id, usuario, nombre, hash_password, rol, creado_en, actualizado_en) VALUES
        (1, 'jefa', 'Jefa', 'x', 'admin', '2026-01-01', '2026-01-01'), (2, 'tec', 'Tec', 'x', 'tecnico', '2026-01-01', '2026-01-01'),
        (3, 'mixto', 'Mixto', 'x', 'admin', '2026-01-01', '2026-01-01');
      INSERT INTO usuario_roles (usuario_id, rol_codigo) VALUES
        (1, 'utcd_restauradores_supervisor'), (1, 'utcd_restauradores_admin_usuarios'), (1, 'utcd_restauradores_admin_catalogos'),
        (2, 'utcd_restauradores_tecnico'), (3, 'utcd_restauradores_tecnico'), (3, 'utcd_restauradores_admin_catalogos');
    `);
    expect((await t.pedir('GET', '/api/v1/sesion/yo')).status).toBe(200);
    const roles = (await t.DB.prepare('SELECT usuario_id, rol_codigo FROM usuario_roles ORDER BY usuario_id').all()).results;
    expect(roles).toEqual([
      { usuario_id: 1, rol_codigo: 'utcd_restauradores_administrador' },
      { usuario_id: 2, rol_codigo: 'utcd_restauradores_tecnico' },
      { usuario_id: 3, rol_codigo: 'utcd_restauradores_administrador' },
    ]);
    const personalizados = (await t.DB.prepare('SELECT id, permisos_personalizados AS p FROM usuarios ORDER BY id').all()).results;
    expect(personalizados).toEqual([
      { id: 1, p: 0 },
      { id: 2, p: 0 },
      { id: 3, p: 1 },
    ]);
    // La cuenta mixta (técnico + catálogos) conserva exactamente esos permisos, a la medida.
    const mixto = (await t.DB.prepare('SELECT permiso_codigo FROM usuario_permisos WHERE usuario_id = 3 ORDER BY permiso_codigo').all()).results;
    expect(mixto).toEqual([{ permiso_codigo: P.catalogos }, { permiso_codigo: P.registrar }]);
    expect(
      await t.DB.prepare("SELECT 1 FROM roles WHERE codigo IN ('utcd_restauradores_admin_usuarios', 'utcd_restauradores_admin_catalogos')").first(),
    ).toBeNull();
    // Al volver a arrancar, 0006 no se vuelve a aplicar (sus roles ya no existen, pero 0007 está aplicada).
    reiniciarEsquemaParaPruebas();
    expect((await t.pedir('GET', '/api/v1/sesion/yo')).status).toBe(200);
    expect((await t.DB.prepare('SELECT usuario_id, rol_codigo FROM usuario_roles ORDER BY usuario_id').all()).results).toEqual(roles);
    // El administrador tiene los cinco permisos por su rol.
    const n = await t.DB.prepare("SELECT COUNT(*) AS n FROM rol_permisos WHERE rol_codigo = 'utcd_restauradores_administrador'").first<{ n: number }>();
    expect(n!.n).toBe(5);
  });

  it('ninguna tabla pasa de 100 columnas (límite de D1)', async () => {
    const t = await crearEntorno();
    await t.pedir('GET', '/api/v1/sesion/yo');
    const tablas = (await t.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>()).results;
    for (const { name } of tablas) {
      const n = (await t.DB.prepare('SELECT COUNT(*) AS n FROM pragma_table_info(?)').bind(name).first<{ n: number }>())!.n;
      expect(n, name).toBeLessThanOrEqual(100);
    }
  });

  it('una columna que ya existe no hace fallar la migración', async () => {
    const t = await crearEntorno(3);
    await t.DB.exec('ALTER TABLE marcas ADD COLUMN activo INTEGER NOT NULL DEFAULT 1;');
    expect((await t.pedir('GET', '/api/v1/sesion/yo')).status).toBe(200);
    expect(await t.DB.prepare("SELECT 1 FROM sqlite_master WHERE name = 'visitas_registro'").first()).toBeTruthy();
  });
});
