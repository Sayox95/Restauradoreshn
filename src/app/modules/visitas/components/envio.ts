/**
 * Envío de las visitas guardadas en el teléfono (excepción E1). Cada paso es repetible sin duplicar:
 * registrar (idempotente por número de visita), subir cada foto original (reemplaza), archivar el PDF.
 * Solo al terminar todo se quita de la cola. Se envía por eventos (al guardar, al volver la señal, al
 * abrir la app o a pedido), nunca con consultas periódicas, y una sola vez a la vez (Web Locks).
 */
import { visitaEsquema } from '@shared/visitas';
import { useEffect, useState } from 'react';
import { ErrorApi, mensajeError } from '@/common/http/api';
import { registrarVisita, subirFoto, subirPdf } from '@/app/modules/visitas/api';
import { type Pendiente, alCambiarCola, guardarEnCola, listarCola, quitarDeCola } from './almacen';
import { generarFicha } from './ficha-pdf';

export interface ResultadoEnvio {
  enviadas: { visita_num: string; id: number }[];
  /** Se detuvo por falta de conexión o de sesión: lo que falta queda en el teléfono. */
  detenido: 'sin_conexion' | 'sin_sesion' | null;
  /** Visitas que el servidor rechazó (quedan en la cola con su mensaje). */
  rechazadas: number;
}

async function enviarUna(p: Pendiente): Promise<number> {
  if (!p.id) {
    const r = await registrarVisita(p.visita);
    p.id = r.visita.id;
    p.error = undefined;
    await guardarEnCola(p);
  }
  for (let i = 0; i < p.fotos.length; i++) {
    const orden = i + 1;
    if (p.fotos_subidas.includes(orden)) continue;
    const f = p.fotos[i]!;
    await subirFoto(p.id, orden, f.original, f.observacion);
    p.fotos_subidas = [...p.fotos_subidas, orden];
    await guardarEnCola(p);
  }
  if (!p.pdf_subido) {
    const pdf = await generarFicha(
      visitaEsquema.parse(p.visita),
      p.fotos.filter((f) => f.copia).map((f) => ({ base64: f.copia!, observacion: f.observacion })),
    );
    await subirPdf(p.id, pdf);
    p.pdf_subido = true;
    await guardarEnCola(p);
  }
  await quitarDeCola(p.visita_num);
  return p.id;
}

async function procesar(): Promise<ResultadoEnvio> {
  const res: ResultadoEnvio = { enviadas: [], detenido: null, rechazadas: 0 };
  for (const p of await listarCola()) {
    try {
      res.enviadas.push({ visita_num: p.visita_num, id: await enviarUna(p) });
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 0) {
        res.detenido = 'sin_conexion';
        break;
      }
      if (e instanceof ErrorApi && e.status === 401) {
        res.detenido = 'sin_sesion';
        break;
      }
      // El servidor rechazó la visita: se conserva con su mensaje para corregirla o consultarla.
      p.error = mensajeError(e);
      await guardarEnCola(p);
      res.rechazadas++;
    }
  }
  return res;
}

let enCurso: Promise<ResultadoEnvio> | null = null;

/** Envía todo lo pendiente. Si ya hay un envío en curso (en esta u otra pestaña), espera a ese. */
export function enviarPendientes(): Promise<ResultadoEnvio> {
  if (enCurso) return enCurso;
  const tarea = () => procesar();
  const envio = (navigator.locks ? navigator.locks.request('cola-visitas', tarea) : tarea()) as Promise<ResultadoEnvio>;
  enCurso = envio.finally(() => {
    enCurso = null;
  });
  return enCurso as Promise<ResultadoEnvio>;
}

/** Lista de pendientes (se actualiza sola) y si hay un envío en curso. */
export function useCola() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    let vivo = true;
    const leer = () =>
      listarCola()
        .then((l) => vivo && setPendientes(l))
        .catch(() => {});
    leer();
    const quitar = alCambiarCola(leer);
    return () => {
      vivo = false;
      quitar();
    };
  }, []);
  const enviar = async () => {
    setEnviando(true);
    try {
      return await enviarPendientes();
    } finally {
      setEnviando(false);
    }
  };
  return { pendientes, enviando, enviar };
}

/**
 * Envío automático por eventos: al abrir la app, al volver la señal y al volver a la app.
 * Montado una vez junto al layout.
 */
export function useEnvioAutomatico() {
  useEffect(() => {
    const intentar = () => {
      if (navigator.onLine) void enviarPendientes().catch(() => {});
    };
    const alVolver = () => document.visibilityState === 'visible' && intentar();
    intentar();
    addEventListener('online', intentar);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      removeEventListener('online', intentar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);
}
