import { beforeEach, describe, expect, it } from 'vitest';
import { crearEntorno } from './entorno';

type E = Awaited<ReturnType<typeof crearEntorno>>;
let t: E;

beforeEach(async () => {
  t = await crearEntorno();
});

describe('catálogos de la hoja de visita', () => {
  it('se desactivan en lugar de borrarse y el formulario solo recibe los activos', async () => {
    const admin = await t.crearUsuario('ana', 'admin');
    const c = admin.cookie;
    const r = await t.pedir('POST', '/api/v1/catalogos/restauradores', {
      cookie: c,
      cuerpo: { energis: '302496', circuito: 'BER-L207', ubicacion: 'Barandillas', latitud: 15.5, longitud: -88 },
    });
    expect(r.status).toBe(201);
    expect(r.datos.datos.activo).toBe(true);
    // Mismo Energis activo: no se permite.
    expect((await t.pedir('POST', '/api/v1/catalogos/restauradores', { cookie: c, cuerpo: { energis: '302496' } })).status).toBe(409);
    // Desactivar guarda «INACTIVO» (formato de la tabla original) y lo saca del formulario.
    await t.pedir('PATCH', `/api/v1/catalogos/restauradores/${r.datos.datos.id}`, { cookie: c, cuerpo: { energis: '302496', activo: false } });
    expect((await t.DB.prepare('SELECT estado FROM restauradores').first<{ estado: string }>())!.estado).toBe('INACTIVO');
    const form = await t.pedir('GET', '/api/v1/catalogos/visita', { cookie: c });
    expect(form.datos.datos.restauradores).toEqual([]);
    expect((await t.pedir('GET', '/api/v1/catalogos/restauradores', { cookie: c })).datos.datos).toHaveLength(1);
    expect((await t.DB.prepare("SELECT COUNT(*) AS n FROM auditoria WHERE entidad = 'restauradores'").first<{ n: number }>())!.n).toBe(2);
  });

  it('el cargo del personal es de la lista de la hoja; uno escrito a mano antes no pasa a la inspección', async () => {
    const c = (await t.crearUsuario('ana', 'admin')).cookie;
    const persona = (cargo: string) => t.pedir('POST', '/api/v1/catalogos/personal', { cookie: c, cuerpo: { nombre: `P ${cargo}`, cargo } });
    expect((await persona('Técnico SCADA')).status).toBe(201);
    expect((await persona('Técnico')).status).toBe(422);
    // Un cargo libre guardado por la versión anterior.
    await t.DB.prepare("INSERT INTO personal (nombre, cargo) VALUES ('Antiguo', 'Técnico')").run();
    const f = (await t.pedir('GET', '/api/v1/catalogos/visita', { cookie: c })).datos.datos;
    expect(f.personal.map((p: { nombre: string; cargo: string | null }) => [p.nombre, p.cargo])).toEqual([
      ['Antiguo', null],
      ['P Técnico SCADA', 'Técnico SCADA'],
    ]);
  });

  it('arma marcas, módems y tableros para el formulario', async () => {
    const c = (await t.crearUsuario('ana', 'admin')).cookie;
    const marca = (cuerpo: object) => t.pedir('POST', '/api/v1/catalogos/marcas', { cookie: c, cuerpo });
    await marca({ elemento: 'RESTAURADOR', marca: 'COOPER', modelo: 'VSA', tipo_control: 'Form 6' });
    await marca({ elemento: 'RESTAURADOR', marca: 'COOPER', modelo: 'NOVA', tipo_control: 'Form 6' });
    await marca({ elemento: 'MODEM DATOS', marca: 'INHAND', modelo: 'IR915' });
    await t.pedir('PUT', '/api/v1/catalogos/tableros', { cookie: c, cuerpo: { marca: 'COOPER', campos: ['Protection Enabled', 'Ground Enabled'] } });
    const f = (await t.pedir('GET', '/api/v1/catalogos/visita', { cookie: c })).datos.datos;
    expect(f.marcas).toEqual([{ marca: 'COOPER', modelos: ['NOVA', 'VSA'], controles: ['Form 6'] }]);
    expect(f.modems).toEqual([{ marca: 'INHAND', elemento: 'MODEM DATOS', modelos: ['IR915'] }]);
    expect(f.tableros).toEqual([{ marca: 'COOPER', campos: ['Protection Enabled', 'Ground Enabled'] }]);
  });

  it('al guardar un tablero, los campos que ya no están se desactivan y el orden se respeta', async () => {
    const c = (await t.crearUsuario('ana', 'admin')).cookie;
    await t.pedir('PUT', '/api/v1/catalogos/tableros', { cookie: c, cuerpo: { marca: 'NOVA', campos: ['A', 'B', 'C'] } });
    await t.pedir('PUT', '/api/v1/catalogos/tableros', { cookie: c, cuerpo: { marca: 'NOVA', campos: ['C', 'A'] } });
    const filas = (await t.DB.prepare('SELECT campo, orden, activo FROM tableros ORDER BY campo').all<any>()).results;
    expect(filas).toEqual([
      { campo: 'A', orden: 2, activo: 1 },
      { campo: 'B', orden: 2, activo: 0 },
      { campo: 'C', orden: 1, activo: 1 },
    ]);
    expect((await t.pedir('PUT', '/api/v1/catalogos/tableros', { cookie: c, cuerpo: { marca: 'NOVA', campos: ['X', 'x'] } })).status).toBe(422);
  });
});
