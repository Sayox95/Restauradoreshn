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

/** Paso del envío en curso, para mostrarlo en la pantalla que espera (p. ej. «Subiendo foto 1 de 2»). */
const oyentesPaso = new Set<(paso: string) => void>();
const avisarPaso = (paso: string) => oyentesPaso.forEach((f) => f(paso));
export function alCambiarPaso(fn: (paso: string) => void) {
  oyentesPaso.add(fn);
  return () => void oyentesPaso.delete(fn);
}

async function enviarUna(p: Pendiente, signal: AbortSignal): Promise<number> {
  if (!p.id) {
    avisarPaso('Registrando la inspección');
    const r = await registrarVisita(p.visita, signal);
    p.id = r.visita.id;
    p.error = undefined;
    await guardarEnCola(p);
  }
  for (let i = 0; i < p.fotos.length; i++) {
    const orden = i + 1;
    if (p.fotos_subidas.includes(orden)) continue;
    const f = p.fotos[i]!;
    avisarPaso(`Subiendo foto ${orden} de ${p.fotos.length}`);
    await subirFoto(p.id, orden, f.original, f.observacion, signal);
    p.fotos_subidas = [...p.fotos_subidas, orden];
    await guardarEnCola(p);
  }
  if (!p.pdf_subido) {
    avisarPaso('Generando y archivando el PDF');
    if (signal.aborted) throw new ErrorApi(0, 'Envío cancelado');
    const pdf = await generarFicha(
      visitaEsquema.parse(p.visita),
      p.fotos.filter((f) => f.copia).map((f) => ({ base64: f.copia!, observacion: f.observacion })),
    );
    await subirPdf(p.id, pdf, signal);
    p.pdf_subido = true;
    await guardarEnCola(p);
  }
  await quitarDeCola(p.visita_num);
  return p.id;
}

async function procesar(signal: AbortSignal): Promise<ResultadoEnvio> {
  const res: ResultadoEnvio = { enviadas: [], detenido: null, rechazadas: 0 };
  // Se vuelve a leer la cola al terminar una tanda: lo que se guardó mientras tanto también se envía.
  const intentadas = new Set<string>();
  for (;;) {
    const lista = (await listarCola()).filter((p) => !intentadas.has(p.visita_num));
    if (!lista.length || res.detenido) break;
    for (const p of lista) {
      intentadas.add(p.visita_num);
      if (await enviarConControl(p, signal, res)) break;
    }
  }
  return res;
}

/** Envía una visita y anota el resultado; devuelve true si hay que detener todo (sin señal o sesión). */
async function enviarConControl(p: Pendiente, signal: AbortSignal, res: ResultadoEnvio): Promise<boolean> {
  try {
    res.enviadas.push({ visita_num: p.visita_num, id: await enviarUna(p, signal) });
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 0) {
      res.detenido = 'sin_conexion';
      return true;
    }
    if (e instanceof ErrorApi && e.status === 401) {
      res.detenido = 'sin_sesion';
      return true;
    }
    // El servidor rechazó la visita: se conserva con su mensaje para corregirla o consultarla.
    p.error = mensajeError(e);
    await guardarEnCola(p);
    res.rechazadas++;
  }
  return false;
}

let enCurso: Promise<ResultadoEnvio> | null = null;
/** Pantallas que muestran si hay un envío en curso (p. ej. «Enviando…» en el encabezado). */
const oyentesEnvio = new Set<(enviando: boolean) => void>();
const avisarEnvio = (enviando: boolean) => oyentesEnvio.forEach((f) => f(enviando));

let controlador: AbortController | null = null;

/**
 * Corta el envío en curso (p. ej. al vencer el tiempo de espera con la pantalla bloqueada). Lo que no
 * terminó queda en la cola y se retoma en el siguiente intento, desde el paso donde quedó.
 */
export const cancelarEnvio = () => controlador?.abort();

/** Envía todo lo pendiente. Si ya hay un envío en curso (en esta u otra pestaña), espera a ese. */
export function enviarPendientes(): Promise<ResultadoEnvio> {
  if (enCurso) return enCurso;
  const control = new AbortController();
  controlador = control;
  const tarea = () => procesar(control.signal);
  avisarEnvio(true);
  const envio = (navigator.locks ? navigator.locks.request('cola-visitas', tarea) : tarea()) as Promise<ResultadoEnvio>;
  enCurso = envio.finally(() => {
    enCurso = null;
    if (controlador === control) controlador = null;
    avisarEnvio(false);
  });
  return enCurso as Promise<ResultadoEnvio>;
}

/** Lista de pendientes (se actualiza sola) y si hay un envío en curso. */
export function useCola() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [enviando, setEnviando] = useState(enCurso !== null);
  useEffect(() => {
    oyentesEnvio.add(setEnviando);
    return () => void oyentesEnvio.delete(setEnviando);
  }, []);
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
  const enviar = () => enviarPendientes();
  /** Lista y si hay un envío en curso (de cualquier origen: al guardar, automático o a pedido). */
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
