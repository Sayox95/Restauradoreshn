import { beforeEach, describe, expect, it } from 'vitest';
import { debeNotificar, debeRecibir } from '../shared/tiempo-real';
import { visitaCompleta } from './datos';
import { crearEntorno } from './entorno';

type E = Awaited<ReturnType<typeof crearEntorno>>;
let t: E;
let llamadas: { url: string; init?: RequestInit }[];

/** Canal simulado: registra lo que la app le envía. */
const conCanal = () => {
  llamadas = [];
  (t.env as any).TIEMPO_REAL = {
    idFromName: () => 'canal',
    get: () => ({
      fetch: async (url: string, init?: RequestInit) => {
        llamadas.push({ url, init });
        return new Response('conectado');
      },
    }),
  };
};
const avisos = async () => {
  await new Promise((r) => setTimeout(r, 0));
  return llamadas
    .filter((l) => l.url.endsWith('/avisar'))
    .flatMap((l) => JSON.parse(String(l.init!.body)))
    .filter((a: { tipo?: string }) => a.tipo !== 'notificacion');
};

beforeEach(async () => {
  t = await crearEntorno();
  conCanal();
});

describe('avisos de tiempo real', () => {
  it('tras guardar con éxito avisa el módulo y el id, con la conexión de origen', async () => {
    const tec = await t.crearUsuario('beto', 'tecnico');
    const r = await t.pedir('POST', '/api/v1/visitas', { cookie: tec.cookie, cuerpo: visitaCompleta(), headers: { 'X-Conexion-Tiempo-Real': 'conexion-1' } });
    expect(r.status).toBe(201);
    expect(await avisos()).toEqual([{ modulo: 'visitas', id: null, origen: 'conexion-1', permiso: null, destinatario: null }]);
  });

  it('no avisa en consultas, en errores ni al cerrar sesión', async () => {
    const tec = await t.crearUsuario('beto', 'tecnico');
    await t.pedir('GET', '/api/v1/visitas/mios', { cookie: tec.cookie });
    await t.pedir('POST', '/api/v1/visitas', { cookie: tec.cookie, cuerpo: visitaCompleta({ fecha_visita: null }) });
    await t.pedir('POST', '/api/v1/sesion/logout', { cookie: tec.cookie });
    expect(await avisos()).toEqual([]);
  });

  it('las cuentas solo se avisan a quien gestiona usuarios (también las solicitudes)', async () => {
    const admin = await t.crearUsuario('ana', 'admin');
    await t.pedir('POST', '/api/v1/sesion/solicitar-cuenta', {
      cuerpo: { nombre: 'Juan Pérez', correo: 'juan.perez@eneeutcd.hn', telefono: '9999-1234', password: 'clave-larga-1' },
    });
    const sup = await t.crearUsuario('beto', 'supervisor');
    await t.pedir('POST', `/api/v1/usuarios/${sup.id}/desactivar`, { cookie: admin.cookie, cuerpo: {} });
    const lista = await avisos();
    expect(lista.map((a) => [a.modulo, a.permiso, a.destinatario])).toEqual([
      ['usuarios', 'utcd_restauradores_usuarios_gestionar', undefined],
      ['usuarios', 'utcd_restauradores_usuarios_gestionar', sup.id],
    ]);
  });

  it('sin el canal publicado la app funciona igual', async () => {
    delete (t.env as any).TIEMPO_REAL;
    const tec = await t.crearUsuario('beto', 'tecnico');
    expect((await t.pedir('POST', '/api/v1/visitas', { cookie: tec.cookie, cuerpo: visitaCompleta() })).status).toBe(201);
    const ws = await t.pedir('GET', '/api/v1/tiempo-real', { cookie: tec.cookie, headers: { Upgrade: 'websocket' } });
    expect(ws.status).toBe(503);
    // La app pregunta sin Upgrade para saber si reintentar: también 503.
    expect((await t.pedir('GET', '/api/v1/tiempo-real', { cookie: tec.cookie })).status).toBe(503);
  });
});

describe('conexión al canal', () => {
  it('requiere sesión, WebSocket y el mismo origen; pasa usuario y permisos al canal', async () => {
    expect((await t.pedir('GET', '/api/v1/tiempo-real', { headers: { Upgrade: 'websocket' } })).status).toBe(401);
    const tec = await t.crearUsuario('carlos', 'tecnico');
    expect((await t.pedir('GET', '/api/v1/tiempo-real', { cookie: tec.cookie })).status).toBe(426);
    const ajeno = await t.pedir('GET', '/api/v1/tiempo-real', { cookie: tec.cookie, headers: { Upgrade: 'websocket', Origin: 'https://malo.test' } });
    expect(ajeno.status).toBe(403);
    await t.pedir('GET', '/api/v1/tiempo-real', { cookie: tec.cookie, headers: { Upgrade: 'websocket' } });
    const conectar = llamadas.find((l) => l.url.endsWith('/conectar'))!;
    const h = new Headers(conectar.init!.headers);
    expect(h.get('X-Usuario')).toBe(String(tec.id));
    expect(h.get('X-Permisos')).toBe('utcd_restauradores_visitas_registrar');
  });

  it('cada conexión recibe los avisos que le corresponden, salvo los propios', () => {
    const c = { conexion: 'a', usuario: 1, permisos: ['utcd_restauradores_visitas_registrar'] };
    const aviso = { modulo: 'visitas' as const, id: 1, origen: null, permiso: null };
    expect(debeRecibir(c, aviso)).toBe(true);
    expect(debeRecibir(c, { ...aviso, origen: 'a' })).toBe(false);
    expect(debeRecibir(c, { ...aviso, modulo: 'usuarios', permiso: 'utcd_restauradores_usuarios_gestionar' })).toBe(false);
    // El dueño de la cuenta recibe el aviso de su cuenta aunque no gestione usuarios.
    expect(debeRecibir(c, { ...aviso, modulo: 'usuarios', permiso: 'utcd_restauradores_usuarios_gestionar', destinatario: 1 })).toBe(true);
  });

  it('las notificaciones se entregan por usuario o por permiso, nunca a quien hizo el cambio', () => {
    const n = { tipo: 'notificacion' as const, mensaje: 'x', modulo: 'usuarios' as const, id: 1, origen: null };
    const admin = { conexion: 'a', usuario: 2, permisos: ['utcd_restauradores_usuarios_gestionar'] };
    const tec = { conexion: 'c', usuario: 3, permisos: ['utcd_restauradores_visitas_registrar'] };
    const solicitud = { ...n, destino: { permiso: 'utcd_restauradores_usuarios_gestionar' as const, excluir: 3 } };
    expect(debeNotificar(admin, solicitud)).toBe(true);
    expect(debeNotificar(tec, solicitud)).toBe(false);
    const directa = { ...n, destino: { usuarios: [3], excluir: 2 } };
    expect(debeNotificar(tec, directa)).toBe(true);
    expect(debeNotificar(admin, directa)).toBe(false);
    expect(debeNotificar(tec, { ...directa, origen: 'c' })).toBe(false);
  });
});
