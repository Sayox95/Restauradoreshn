import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAMBIOS } from '../server/plumbing/esquema';
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
    expect(aplicadas).toEqual(['0003_cuentas.sql', '0004_visitas_registro.sql', '0005_cargo_usuario.sql']);
    expect((await columnas())!.n).toBe(100);
    // La visita anterior queda «registrada» y la ve quien puede consultar todas.
    const lista = (await t.pedir('GET', '/api/v1/visitas', { cookie: sup.cookie })).datos.datos;
    expect(lista.filas).toMatchObject([{ visita_num: 'HV-ANTERIOR', estado: 'registrada', registrado_por: null }]);
    expect((await t.pedir('POST', '/api/v1/visitas', { cookie: sup.cookie, cuerpo: visitaCompleta() })).status).toBe(201);
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
