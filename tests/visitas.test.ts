import { beforeEach, describe, expect, it } from 'vitest';
import { PATRON_FOLIO, folioNuevo, requisitosVisita, visitaEsquema } from '../shared/visitas';
import { JPEG, PDF, visitaCompleta } from './datos';
import { crearEntorno } from './entorno';

type E = Awaited<ReturnType<typeof crearEntorno>>;
let t: E;

beforeEach(async () => {
  t = await crearEntorno();
});

const registrar = (cookie: string, extra = {}) => t.pedir('POST', '/api/v1/visitas', { cookie, cuerpo: visitaCompleta(extra) });

describe('registrar una visita', () => {
  it('guarda la visita como «registrada», con quién y cuándo, y su auditoría en el mismo batch', async () => {
    const tec = await t.crearUsuario('beto', 'tecnico');
    const r = await registrar(tec.cookie);
    expect(r.status).toBe(201);
    expect(r.datos.datos.creada).toBe(true);
    expect(r.datos.datos.visita).toMatchObject({ visita_num: 'HV-20261101-080000', estado: 'registrada', registrado_por: 'Nombre beto' });
    const fila = await t.DB.prepare(
      'SELECT v.estado, v.registrado_por, v.registrado_en, v.capturado_en, r.has_modem1, r.materiales_json FROM registros r JOIN visitas_registro v ON v.registro_id = r.id',
    ).first<any>();
    expect(fila).toMatchObject({
      estado: 'registrada',
      registrado_por: tec.id,
      registrado_en: t.reloj.ahora,
      capturado_en: '2026-11-01T16:30:00.000Z',
      has_modem1: 0,
    });
    const aud = await t.DB.prepare("SELECT accion, entidad_id, despues FROM auditoria WHERE entidad = 'visita'").first<any>();
    expect(aud.accion).toBe('registrar');
    expect(JSON.parse(aud.despues).firma_img).toBeUndefined();
  });

  it('reenviar la misma visita no la duplica (sincronización sin conexión, E1)', async () => {
    const tec = await t.crearUsuario('beto', 'tecnico');
    expect((await registrar(tec.cookie)).status).toBe(201);
    const otra = await registrar(tec.cookie);
    expect(otra.status).toBe(200);
    expect(otra.datos.datos.creada).toBe(false);
    expect((await t.DB.prepare('SELECT COUNT(*) AS n FROM registros').first<{ n: number }>())!.n).toBe(1);
    // El mismo número usado por otra persona es un conflicto.
    const ana = await t.crearUsuario('ana', 'tecnico');
    expect((await registrar(ana.cookie)).status).toBe(409);
  });

  it('el folio es legible y único aunque se generen muchos en el mismo segundo', () => {
    const ahora = new Date(2026, 10, 12, 9, 5, 7);
    const folios = Array.from({ length: 500 }, () => folioNuevo(ahora));
    expect(folios[0]).toMatch(/^IR-20261112-090507-[A-Z2-9]{4}$/);
    expect(folios.every((f) => PATRON_FOLIO.test(f))).toBe(true);
    expect(new Set(folios).size).toBeGreaterThan(495);
  });

  it('rechaza una visita incompleta con los campos que faltan', async () => {
    const tec = await t.crearUsuario('beto', 'tecnico');
    const r = await registrar(tec.cookie, { hora_salida: '', num_fotos: 0, firma_img: null });
    expect(r.status).toBe(422);
    expect(r.datos.faltantes).toEqual(expect.arrayContaining(['hora_salida', 'fotos', 'firma_img']));
  });

  it('exige lo que aplica según las respuestas (potencial, batería, módem, COOPER)', () => {
    const ctx = { camposTablero: [], hayOpciones: () => false, fotos: 1 };
    const falta = (extra: object) =>
      requisitosVisita(visitaEsquema.parse(visitaCompleta(extra)), ctx)
        .filter((x) => !x.ok)
        .map((x) => x.campo);
    expect(falta({})).toEqual([]);
    expect(falta({ tiene_potencial: 'SI', alimentado_acometida: null })).toEqual([
      'pot_cantidad',
      'fase_conexion',
      'pot_pararrayos',
      'pot_cuchilla',
      'ater_pot_state',
    ]);
    expect(falta({ cambio_baterias: 'SI' })).toEqual(['tipo_bateria']);
    expect(falta({ has_modem1: 'SI', antena_modem1: 'EXTERNA' })).toEqual(['tipo_modem1', 'serie_modem1', 'tipo_antena1', 'tec_modem1']);
    expect(falta({ marca_reconectador: 'COOPER' })).toEqual(['proview_control', 'term_sens_v', 'mangu_sens_v', 'term_mangu_aux', 'mangu_aux']);
    expect(falta({ gabinete: 'NOK' })).toEqual(['obs_estado_fisico']);
    expect(falta({ alarma_presente: 'SI' })).toEqual(['desc_alarma']);
    // Monofásico: IB e IC no aplican.
    expect(falta({ tipo_recon: '1F', corr_ib: null, corr_ic: null })).toEqual([]);
    // Coordenadas invertidas.
    expect(falta({ latitud: -88.0167, longitud: 15.5169 })).toEqual(['latitud', 'longitud']);
  });
});

describe('ver las visitas', () => {
  it('sin permiso de consultar cada quien ve solo las suyas; el supervisor ve todas', async () => {
    const beto = await t.crearUsuario('beto', 'tecnico');
    const ana = await t.crearUsuario('ana', 'tecnico');
    const sup = await t.crearUsuario('carla', 'supervisor');
    const id = (await registrar(beto.cookie)).datos.datos.visita.id;
    await registrar(ana.cookie, { visita_num: 'HV-20261101-090000' });
    expect((await t.pedir('GET', '/api/v1/visitas/mios', { cookie: beto.cookie })).datos.datos.total).toBe(1);
    expect((await t.pedir('GET', `/api/v1/visitas/${id}`, { cookie: beto.cookie })).status).toBe(200);
    expect((await t.pedir('GET', `/api/v1/visitas/${id}`, { cookie: ana.cookie })).status).toBe(404);
    const todas = await t.pedir('GET', '/api/v1/visitas?q=BER', { cookie: sup.cookie });
    expect(todas.datos.datos.total).toBe(2);
    const det = await t.pedir('GET', `/api/v1/visitas/${id}`, { cookie: sup.cookie });
    expect(det.datos.datos.datos).toMatchObject({ has_modem1: 'NO', personal: [{ nombre: 'Mauricio Cerros' }] });
  });

  it('exporta a CSV con permiso de exportar', async () => {
    const sup = await t.crearUsuario('carla', 'supervisor');
    await registrar(sup.cookie);
    const csv = await t.pedir('GET', '/api/v1/visitas/exportar', { cookie: sup.cookie });
    expect(csv.status).toBe(200);
    expect(csv.headers.get('Content-Type')).toMatch(/text\/csv/);
    expect(String(csv.datos)).toContain('HV-20261101-080000');
  });
});

describe('fotos originales y PDF (E2, E3)', () => {
  it('solo quien registró sube fotos; se sirven solo a quien puede ver la visita', async () => {
    const beto = await t.crearUsuario('beto', 'tecnico');
    const ana = await t.crearUsuario('ana', 'tecnico');
    const id = (await registrar(beto.cookie)).datos.datos.visita.id;
    const subir = (cookie: string, orden = 1) => t.pedir('PUT', `/api/v1/visitas/${id}/fotos/${orden}?obs=Placa`, { cookie, binario: JPEG });
    expect((await subir(ana.cookie)).status).toBe(404);
    expect((await subir(beto.cookie, 5)).status).toBe(400);
    expect((await subir(beto.cookie)).status).toBe(201);
    // Reenviar la misma foto la reemplaza (no duplica).
    expect((await subir(beto.cookie)).status).toBe(201);
    expect((await t.DB.prepare('SELECT COUNT(*) AS n FROM registros_fotos').first<{ n: number }>())!.n).toBe(1);
    expect([...t.ARCHIVOS.objetos.keys()]).toEqual(['fotos/HV-20261101-080000/1.jpg']);
    const foto = await t.pedir('GET', `/api/v1/visitas/${id}/fotos/1`, { cookie: beto.cookie });
    expect(foto.status).toBe(200);
    expect(foto.headers.get('Cache-Control')).toMatch(/private/);
    expect((await t.pedir('GET', `/api/v1/visitas/${id}/fotos/1`, { cookie: ana.cookie })).status).toBe(404);
  });

  it('valida el formato de la foto por su contenido', async () => {
    const beto = await t.crearUsuario('beto', 'tecnico');
    const id = (await registrar(beto.cookie)).datos.datos.visita.id;
    const r = await t.pedir('PUT', `/api/v1/visitas/${id}/fotos/1`, { cookie: beto.cookie, binario: new TextEncoder().encode('no soy una foto') });
    expect(r.status).toBe(415);
  });

  it('archiva el PDF de la ficha y lo sirve con sesión', async () => {
    const beto = await t.crearUsuario('beto', 'tecnico');
    const id = (await registrar(beto.cookie)).datos.datos.visita.id;
    expect((await t.pedir('PUT', `/api/v1/visitas/${id}/pdf`, { cookie: beto.cookie, binario: JPEG })).status).toBe(415);
    expect((await t.pedir('PUT', `/api/v1/visitas/${id}/pdf`, { cookie: beto.cookie, binario: PDF })).status).toBe(201);
    const det = await t.pedir('GET', `/api/v1/visitas/${id}`, { cookie: beto.cookie });
    expect(det.datos.datos.tiene_pdf).toBe(true);
    const pdf = await t.pedir('GET', `/api/v1/visitas/${id}/pdf`, { cookie: beto.cookie });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('Content-Type')).toBe('application/pdf');
    expect((await t.pedir('GET', `/api/v1/visitas/${id}/pdf`)).status).toBe(401);
  });
});
