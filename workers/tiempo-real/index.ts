/**
 * Canal de tiempo real (Durable Object con WebSockets en hibernación): equivale al hub de SignalR del
 * marco de TI. Se publica aparte (`npm run tiempo-real:deploy`) y la app lo usa por el enlace TIEMPO_REAL.
 * No es público (workers_dev = false): solo lo alcanzan las Functions de la app, que ya validaron la sesión.
 *
 * - /conectar: abre la conexión de un usuario (los datos vienen del servidor de la app, no del navegador).
 * - /avisar: reparte avisos («algo cambió») y notificaciones dirigidas a las conexiones que deben recibirlos.
 * Los clientes no envían nada por el canal (salvo el «ping» de mantenimiento, que responde la plataforma
 * sin despertar al objeto).
 */
import { DurableObject } from 'cloudflare:workers';
import { type AvisoCanal, type DatosConexion, debeNotificar, debeRecibir, type NotificacionCanal } from '../../shared/tiempo-real';

export class CanalTiempoReal extends DurableObject<Record<string, never>> {
  constructor(ctx: DurableObjectState, env: Record<string, never>) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/conectar') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba WebSocket.', { status: 426 });
      const { 0: cliente, 1: servidor } = new WebSocketPair();
      const datos: DatosConexion = {
        conexion: crypto.randomUUID(),
        usuario: Number(req.headers.get('X-Usuario')),
        permisos: (req.headers.get('X-Permisos') ?? '').split(',').filter(Boolean),
      };
      this.ctx.acceptWebSocket(servidor);
      servidor.serializeAttachment(datos);
      servidor.send(JSON.stringify({ tipo: 'conectado', conexion: datos.conexion }));
      return new Response(null, { status: 101, webSocket: cliente });
    }
    if (url.pathname === '/avisar' && req.method === 'POST') {
      const mensajes = (await req.json()) as (AvisoCanal | NotificacionCanal)[];
      for (const ws of this.ctx.getWebSockets()) {
        const datos = ws.deserializeAttachment() as DatosConexion | null;
        if (!datos) continue;
        for (const m of mensajes) {
          const salida =
            m.tipo === 'notificacion'
              ? debeNotificar(datos, m) && { tipo: 'notificacion', mensaje: m.mensaje, modulo: m.modulo, id: m.id }
              : debeRecibir(datos, m) && { tipo: 'aviso', modulo: m.modulo, id: m.id };
          if (!salida) continue;
          try {
            ws.send(JSON.stringify(salida));
          } catch {
            /* conexión cerrándose */
          }
        }
      }
      return new Response('ok');
    }
    return new Response('No encontrado', { status: 404 });
  }

  async webSocketClose(ws: WebSocket, codigo: number) {
    try {
      ws.close(codigo === 1005 ? 1000 : codigo, 'cierre');
    } catch {
      /* ya cerrado */
    }
  }

  async webSocketError(ws: WebSocket) {
    try {
      ws.close(1011, 'error');
    } catch {
      /* ya cerrado */
    }
  }
}

export default {
  fetch: () => new Response('Canal de tiempo real: solo accesible desde la app.', { status: 404 }),
} satisfies ExportedHandler;
