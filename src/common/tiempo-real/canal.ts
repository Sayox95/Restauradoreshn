/**
 * Conexión única y compartida con el canal de tiempo real (lineamientos: «una sola conexión compartida»).
 * Solo recibe avisos «cambió <módulo> (id)»; cada pantalla decide si le interesa (useTiempoReal).
 * Si se corta, se reconecta sola (con espera creciente) y avisa «reconectado» para que las pantallas
 * vuelvan a consultar lo que pudo cambiar mientras tanto. Sin el canal publicado, la app funciona igual.
 */
import type { Aviso, Notificacion } from '@shared/tiempo-real';

export type Evento = Aviso | 'reconectado';
type Escucha = (e: Evento) => void;

const escuchas = new Set<Escucha>();
const notificados = new Set<(n: Notificacion) => void>();
let ws: WebSocket | null = null;
let conexion: string | null = null;
let activo = false;
let yaConecto = false;
let fallos = 0;
let reintento: ReturnType<typeof setTimeout> | undefined;
let latido: ReturnType<typeof setInterval> | undefined;

/** Id de esta conexión: se manda al guardar para no recibir el aviso del propio cambio. */
export const conexionActual = () => conexion;

export function escuchar(fn: Escucha) {
  escuchas.add(fn);
  return () => {
    escuchas.delete(fn);
  };
}

/** Notificaciones dirigidas a este usuario (las muestra el notificador global). */
export function escucharNotificaciones(fn: (n: Notificacion) => void) {
  notificados.add(fn);
  return () => {
    notificados.delete(fn);
  };
}

function abrir() {
  if (!activo || ws || !navigator.onLine) return;
  clearTimeout(reintento);
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/v1/tiempo-real`;
  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch {
    return programar();
  }
  ws = socket;
  socket.onmessage = (m) => {
    if (m.data === 'pong') return;
    let datos: { tipo?: string; conexion?: string; modulo?: Aviso['modulo']; id?: number | null; mensaje?: string };
    try {
      datos = JSON.parse(String(m.data));
    } catch {
      return;
    }
    if (datos.tipo === 'conectado') {
      fallos = 0;
      conexion = datos.conexion ?? null;
      if (yaConecto) emitir('reconectado');
      yaConecto = true;
    } else if (datos.tipo === 'aviso' && datos.modulo) emitir({ modulo: datos.modulo, id: datos.id ?? null });
    else if (datos.tipo === 'notificacion' && datos.modulo && datos.mensaje) {
      const n: Notificacion = { mensaje: datos.mensaje, modulo: datos.modulo, id: datos.id ?? null };
      for (const fn of notificados) fn(n);
    }
  };
  // Latido para que la conexión no se cierre por inactividad (lo responde la plataforma sin costo).
  socket.onopen = () => {
    clearInterval(latido);
    latido = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('ping'), 45_000);
  };
  socket.onclose = () => {
    if (ws === socket) ws = null;
    conexion = null;
    clearInterval(latido);
    if (activo) programar();
  };
}

/** Reintento con espera creciente (1 s … 30 s); si el canal no responde nunca, cada 5 min. */
function programar() {
  clearTimeout(reintento);
  fallos++;
  const espera = fallos > 8 ? 5 * 60_000 : Math.min(30_000, 1000 * 2 ** (fallos - 1)) + Math.random() * 1000;
  reintento = setTimeout(abrir, espera);
}

function emitir(e: Evento) {
  for (const fn of escuchas) fn(e);
}

// Al volver a la app o recuperar la conexión, se intenta de inmediato.
const reanudar = () => {
  if (document.visibilityState !== 'visible' || ws) return;
  fallos = 0;
  abrir();
};

/** Se abre al entrar a la app con sesión y se cierra al salir. */
export function iniciarCanal() {
  if (activo || typeof WebSocket === 'undefined') return;
  activo = true;
  yaConecto = false;
  fallos = 0;
  // Si el Worker del canal no está publicado (503), no se intenta más hasta volver a abrir la app:
  // nada de reintentos periódicos contra algo que no existe.
  void fetch('/api/v1/tiempo-real', { credentials: 'same-origin' })
    .then((r) => {
      if (r.status === 503 || !activo) return detenerCanal();
      document.addEventListener('visibilitychange', reanudar);
      addEventListener('online', reanudar);
      abrir();
    })
    .catch(() => {
      // Sin señal: se intentará al volver la conexión.
      if (!activo) return;
      document.addEventListener('visibilitychange', reanudar);
      addEventListener('online', reanudar);
    });
}

export function detenerCanal() {
  activo = false;
  clearTimeout(reintento);
  clearInterval(latido);
  document.removeEventListener('visibilitychange', reanudar);
  removeEventListener('online', reanudar);
  ws?.close(1000, 'salida');
  ws = null;
  conexion = null;
}
