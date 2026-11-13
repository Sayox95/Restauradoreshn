import { beforeEach, describe, expect, it } from 'vitest';
import { crearEntorno, DIA } from './entorno';

type E = Awaited<ReturnType<typeof crearEntorno>>;
let t: E;

beforeEach(async () => {
  t = await crearEntorno();
});

describe('autenticación', () => {
  it('rechaza solicitudes sin sesión', async () => {
    expect((await t.pedir('GET', '/api/v1/visitas')).status).toBe(401);
  });

  it('rechaza credenciales incorrectas sin revelar el motivo', async () => {
    await t.crearUsuario('ana', 'admin');
    const a = await t.pedir('POST', '/api/v1/sesion/login', { cuerpo: { usuario: 'ana', password: 'mala' } });
    const b = await t.pedir('POST', '/api/v1/sesion/login', { cuerpo: { usuario: 'nadie', password: 'mala' } });
    expect(a.status).toBe(401);
    expect(a.datos.error).toBe(b.datos.error);
  });

  it('emite cookie HttpOnly y Secure, y el logout invalida la sesión', async () => {
    await t.crearUsuario('ana', 'admin');
    const login = await t.pedir('POST', '/api/v1/sesion/login', { cuerpo: { usuario: 'ANA', password: 'clave-segura-1' } });
    const cookie = login.headers.get('Set-Cookie')!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    const c = cookie.split(';')[0]!;
    expect((await t.pedir('GET', '/api/v1/sesion/yo', { cookie: c })).status).toBe(200);
    const salida = await t.pedir('POST', '/api/v1/sesion/logout', { cookie: c });
    expect(salida.headers.get('Set-Cookie')).toMatch(/Max-Age=0/);
    expect(salida.headers.get('Clear-Site-Data')).toBe('"cache"');
    expect((await t.pedir('GET', '/api/v1/sesion/yo', { cookie: c })).datos.datos).toBeNull();
  });

  it('cerrar sesión solo cierra este dispositivo; con todas=1 cierra todos', async () => {
    const { cookie: c1 } = await t.crearUsuario('ana', 'admin');
    const entrar = async () =>
      (await t.pedir('POST', '/api/v1/sesion/login', { cuerpo: { usuario: 'ana', password: 'clave-segura-1' } })).headers.get('Set-Cookie')!.split(';')[0]!;
    const c2 = await entrar();
    const c3 = await entrar();
    await t.pedir('POST', '/api/v1/sesion/logout', { cookie: c1 });
    expect((await t.pedir('GET', '/api/v1/sesion/yo', { cookie: c2 })).datos.datos).not.toBeNull();
    await t.pedir('POST', '/api/v1/sesion/logout?todas=1', { cookie: c2 });
    expect((await t.pedir('GET', '/api/v1/sesion/yo', { cookie: c3 })).datos.datos).toBeNull();
  });

  it('al iniciar sesión se borran las sesiones vencidas de cualquier usuario', async () => {
    await t.crearUsuario('beto', 'tecnico');
    t.avanzar(31 * DIA);
    await t.crearUsuario('ana', 'admin');
    const r = await t.DB.prepare('SELECT COUNT(*) AS n FROM sesiones').first<{ n: number }>();
    expect(r!.n).toBe(1);
  });

  it('la sesión expira a los 30 días sin uso', async () => {
    const { cookie } = await t.crearUsuario('ana', 'admin');
    t.avanzar(31 * DIA);
    expect((await t.pedir('GET', '/api/v1/sesion/yo', { cookie })).datos.datos).toBeNull();
    expect((await t.pedir('GET', '/api/v1/visitas', { cookie })).status).toBe(401);
  });

  it('bloquea escrituras desde otro origen', async () => {
    const { cookie } = await t.crearUsuario('ana', 'admin');
    const r = await t.pedir('POST', '/api/v1/catalogos/tipos', { cookie, cuerpo: { tipo: 'X' }, headers: { Origin: 'https://malo.test' } });
    expect(r.status).toBe(403);
  });

  it('un usuario desactivado pierde el acceso', async () => {
    const admin = await t.crearUsuario('ana', 'admin');
    const enc = await t.crearUsuario('beto', 'supervisor');
    await t.pedir('POST', `/api/v1/usuarios/${enc.id}/desactivar`, { cookie: admin.cookie, cuerpo: {} });
    expect((await t.pedir('GET', '/api/v1/sesion/yo', { cookie: enc.cookie })).datos.datos).toBeNull();
    expect((await t.pedir('GET', '/api/v1/visitas', { cookie: enc.cookie })).status).toBe(401);
  });
});

describe('permisos por rol', () => {
  it('el técnico registra visitas pero no consulta las de otros, ni exporta ni administra', async () => {
    const tec = await t.crearUsuario('beto', 'tecnico');
    expect((await t.pedir('GET', '/api/v1/visitas', { cookie: tec.cookie })).status).toBe(403);
    expect((await t.pedir('GET', '/api/v1/visitas/mios', { cookie: tec.cookie })).status).toBe(200);
    expect((await t.pedir('GET', '/api/v1/visitas/exportar', { cookie: tec.cookie })).status).toBe(403);
    expect((await t.pedir('GET', '/api/v1/usuarios', { cookie: tec.cookie })).status).toBe(403);
    expect((await t.pedir('GET', '/api/v1/catalogos/restauradores', { cookie: tec.cookie })).status).toBe(403);
    expect((await t.pedir('GET', '/api/v1/catalogos/visita', { cookie: tec.cookie })).status).toBe(200);
  });

  it('el supervisor consulta y exporta, pero no administra', async () => {
    const sup = await t.crearUsuario('carla', 'supervisor');
    expect((await t.pedir('GET', '/api/v1/visitas', { cookie: sup.cookie })).status).toBe(200);
    expect((await t.pedir('GET', '/api/v1/visitas/exportar', { cookie: sup.cookie })).status).toBe(200);
    expect((await t.pedir('GET', '/api/v1/usuarios', { cookie: sup.cookie })).status).toBe(403);
  });
});

describe('superficie pública', () => {
  it('solo el login responde sin sesión; la configuración inicial ya no existe', async () => {
    expect((await t.pedir('GET', '/api/auth/instalacion')).status).toBe(401);
    expect((await t.pedir('POST', '/api/auth/instalacion', { cuerpo: { clave: 'x', usuario: 'intruso', nombre: 'X', password: '12345678' } })).status).toBe(
      401,
    );
    for (const ruta of [
      '/api/v1/visitas',
      '/api/v1/visitas/mios',
      '/api/v1/visitas/1',
      '/api/v1/visitas/1/fotos/1',
      '/api/v1/visitas/1/pdf',
      '/api/v1/visitas/exportar',
      '/api/v1/catalogos/visita',
      '/api/v1/catalogos/restauradores',
      '/api/v1/usuarios',
    ])
      expect((await t.pedir('GET', ruta)).status).toBe(401);
    const n = await t.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first<{ n: number }>();
    expect(n!.n).toBe(0);
  });
});

describe('intentos de ingreso', () => {
  const entrar = (password: string) => t.pedir('POST', '/api/v1/sesion/login', { cuerpo: { usuario: 'ana', password } });

  it('bloquea 15 minutos tras 5 contraseñas incorrectas, incluso con la correcta', async () => {
    await t.crearUsuario('ana', 'admin');
    for (let i = 0; i < 5; i++) expect((await entrar('mala')).status).toBe(401);
    const r = await entrar('clave-segura-1');
    expect(r.status).toBe(429);
    expect(r.datos.error).toMatch(/Espere 15 minutos/);
    t.avanzar(16 * 60_000);
    expect((await entrar('clave-segura-1')).status).toBe(200);
  });

  it('un ingreso correcto reinicia el contador', async () => {
    await t.crearUsuario('ana', 'admin');
    for (let i = 0; i < 4; i++) await entrar('mala');
    expect((await entrar('clave-segura-1')).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await entrar('mala')).status).toBe(401);
    expect((await entrar('clave-segura-1')).status).toBe(200);
  });

  it('también cuenta para usuarios que no existen (no revela cuáles existen)', async () => {
    for (let i = 0; i < 5; i++) await t.pedir('POST', '/api/v1/sesion/login', { cuerpo: { usuario: 'nadie', password: 'x' } });
    expect((await t.pedir('POST', '/api/v1/sesion/login', { cuerpo: { usuario: 'nadie', password: 'x' } })).status).toBe(429);
  });
});

describe('solicitudes de cuenta', () => {
  it('el administrador aprueba una solicitud de cuenta como técnico', async () => {
    const admin = await t.crearUsuario('ana', 'admin');
    await t.pedir('POST', '/api/v1/sesion/solicitar-cuenta', {
      cuerpo: { nombre: 'Carlos Ruiz', correo: 'carlos@eneeutcd.hn', telefono: '9999-0000', password: 'clave-segura-1' },
    });
    const sol = (await t.pedir('GET', '/api/v1/usuarios', { cookie: admin.cookie })).datos.datos.find((u: any) => u.usuario === 'carlos');
    expect(
      (await t.pedir('POST', `/api/v1/usuarios/${sol.id}/aprobar`, { cookie: admin.cookie, cuerpo: { roles: ['utcd_restauradores_tecnico'] } })).status,
    ).toBe(200);
    const login = await t.pedir('POST', '/api/v1/sesion/login', { cuerpo: { usuario: 'carlos', password: 'clave-segura-1' } });
    const yo = await t.pedir('GET', '/api/v1/sesion/yo', { cookie: login.headers.get('Set-Cookie')!.split(';')[0]! });
    expect(yo.datos.datos.usuario.rol).toBe('tecnico');
    expect(yo.datos.datos.usuario.permisos).toEqual(['utcd_restauradores_visitas_registrar']);
  });
});

describe('permisos por módulo y acción (códigos del SSO)', () => {
  it('«yo» devuelve los permisos del usuario como los claims del token', async () => {
    const sup = await t.crearUsuario('beto', 'supervisor');
    const yo = (await t.pedir('GET', '/api/v1/sesion/yo', { cookie: sup.cookie })).datos.datos.usuario;
    expect(yo.permisos.sort()).toEqual(
      ['utcd_restauradores_visitas_consultar', 'utcd_restauradores_visitas_exportar', 'utcd_restauradores_visitas_registrar'].sort(),
    );
  });

  it('el acceso lo dan los roles asignados (usuario_roles), no el perfil guardado', async () => {
    const u = await t.crearUsuario('carla', 'tecnico');
    const consultar = () => t.pedir('GET', '/api/v1/visitas', { cookie: u.cookie });
    expect((await consultar()).status).toBe(403);
    // Se le agrega el rol de supervisor (como marcar un rol en el SSO): ya puede consultar.
    await t.DB.prepare("INSERT INTO usuario_roles VALUES (?, 'utcd_restauradores_supervisor')").bind(u.id).run();
    expect((await consultar()).status).toBe(200);
  });

  it('los permisos, módulos y roles quedan sembrados en la base', async () => {
    await t.crearUsuario('ana', 'admin');
    const n = async (sql: string) => (await t.DB.prepare(sql).first<{ n: number }>())!.n;
    expect(await n('SELECT COUNT(*) AS n FROM permisos')).toBe(5);
    expect(await n("SELECT COUNT(*) AS n FROM permisos WHERE codigo NOT LIKE 'utcd_restauradores_%'")).toBe(0);
    expect(await n('SELECT COUNT(*) AS n FROM roles')).toBe(4);
    expect(await n("SELECT COUNT(*) AS n FROM rol_permisos WHERE rol_codigo = 'utcd_restauradores_supervisor'")).toBe(3);
    // El administrador tiene tres roles, uno por módulo: juntos suman los cinco permisos.
    expect(await n("SELECT COUNT(*) AS n FROM usuario_roles ur JOIN usuarios u ON u.id = ur.usuario_id WHERE u.usuario = 'ana'")).toBe(3);
  });
});

describe('accesos por módulo (roles del SSO)', () => {
  const R = {
    tecnico: 'utcd_restauradores_tecnico',
    supervisor: 'utcd_restauradores_supervisor',
    usuarios: 'utcd_restauradores_admin_usuarios',
    catalogos: 'utcd_restauradores_admin_catalogos',
  };

  it('se habilita cada módulo por separado y los permisos siguen a los roles', async () => {
    const admin = await t.crearUsuario('ana', 'admin');
    const sup = await t.crearUsuario('sara', 'supervisor');
    const editar = (roles: string[]) => t.pedir('PATCH', `/api/v1/usuarios/${sup.id}`, { cookie: admin.cookie, cuerpo: { roles } });
    // Supervisor que además administra catálogos, pero no usuarios.
    expect((await editar([R.supervisor, R.catalogos])).status).toBe(200);
    const yo = (await t.pedir('GET', '/api/v1/sesion/yo', { cookie: sup.cookie })).datos.datos.usuario;
    expect(yo.roles).toEqual([R.catalogos, R.supervisor]);
    expect((await t.pedir('GET', '/api/v1/catalogos/materiales', { cookie: sup.cookie })).status).toBe(200);
    expect((await t.pedir('GET', '/api/v1/usuarios', { cookie: sup.cookie })).status).toBe(403);
    // A lo sumo un rol por módulo y al menos un acceso.
    expect((await editar([R.tecnico, R.supervisor])).status).toBe(422);
    expect((await editar([])).status).toBe(422);
    // El cambio queda en el historial de la cuenta.
    const historial = (await t.pedir('GET', `/api/v1/usuarios/${sup.id}`, { cookie: admin.cookie })).datos.datos.historial;
    expect(historial[0]).toMatchObject({ accion: 'editar', antes: { roles: [R.supervisor] }, despues: { roles: [R.catalogos, R.supervisor] } });
  });

  it('nadie se quita a sí mismo el acceso a usuarios', async () => {
    const admin = await t.crearUsuario('ana', 'admin');
    const quitar = await t.pedir('PATCH', `/api/v1/usuarios/${admin.id}`, { cookie: admin.cookie, cuerpo: { roles: [R.supervisor, R.catalogos] } });
    expect(quitar.status).toBe(422);
  });
});
