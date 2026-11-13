/**
 * Inspección de restaurador: formulario por secciones (una columna; excepción E4 en mediciones), validación por
 * sección con las mismas reglas del servidor y avance real. Excepción E1: la visita se guarda primero en
 * el teléfono y se envía sola al haber señal; el borrador se conserva aunque se cierre la app.
 */
import { SECCIONES, avance, faltantes, visitaEsquema } from '@shared/visitas';
import { CheckCircle2, ChevronLeft, ChevronRight, CloudOff, FileDown, Loader2, Save, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Cargando } from '@/common/components/ui';
import { useSesion } from '@/common/seguridad/sesion';
import { TONO } from '@/common/tonos';
import { useConfirmar } from '@/common/components/ConfirmDialog';
import { useAvisos } from '@/common/components/Toast';
import { fijarModoCaptura } from '@/common/menu/modo-captura';
import { marcarTrabajo } from '@/common/pwa/trabajo';
import { mensajeError } from '@/common/http/api';
import { type FotoLocal, borrarBorrador, guardarBorrador, guardarEnCola, leerBorrador } from '../../components/almacen';
import { useCatalogosVisita } from '../../components/catalogos';
import { alCambiarPaso, cancelarEnvio, enviarPendientes } from '../../components/envio';
import { generarFicha } from '../../components/ficha-pdf';
import { type Borrador, type Cambios, aEntrada, borradorNuevo, requisitos, tieneDatos } from '../../components/formulario';
import { SECCIONES_FORMULARIO } from '../../components/secciones';
import { urlInspecciones, urlVisita } from '../../urls';

interface Resultado {
  visita_num: string;
  /** Id en el servidor si ya se envió; si no, quedó en el teléfono. */
  id: number | null;
  pdf: () => Promise<Blob>;
  /** Se cortó el envío por tiempo (señal débil). */
  senalDebil?: boolean;
}

/** Tiempo máximo con la pantalla bloqueada esperando el envío al guardar. */
const ESPERA_MAX_MS = 60_000;

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function RegistrarVisita() {
  const { data: cat } = useCatalogosVisita();
  const { usuario } = useSesion();
  // Quien inspecciona (técnico #1 y responsable por defecto); se lee una vez, al abrir el formulario.
  const yo = useRef(usuario ? { id: usuario.id, nombre: usuario.nombre, cargo: usuario.cargo } : null);
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const navegar = useNavigate();
  const [b, setB] = useState<Borrador | null>(null);
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [paso, setPaso] = useState(0);
  /** Secciones en las que ya se intentó avanzar: ahí se marcan los faltantes. */
  const [revisadas, setRevisadas] = useState<Set<number>>(new Set());
  const [alGuardar, setAlGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const arriba = useRef<HTMLDivElement>(null);

  // Recupera el borrador del teléfono (si el sistema cerró la app, p. ej. al abrir la cámara).
  useEffect(() => {
    leerBorrador()
      .then((g) => {
        if (g) {
          setB({ ...borradorNuevo(yo.current), ...(g.datos as Partial<Borrador>) } as Borrador);
          setFotos(g.fotos ?? []);
          setPaso(Math.min(Math.max(g.paso ?? 0, 0), SECCIONES.length - 1));
        } else setB(borradorNuevo(yo.current));
      })
      .catch(() => setB(borradorNuevo(yo.current)));
  }, []);

  const conDatos = !!b && tieneDatos(b, fotos.length);
  // Guarda el borrador poco después de cada cambio y avisa que hay una visita en curso.
  useEffect(() => {
    if (!b) return;
    // Ya guardada: la pantalla final (con su PDF) también cuenta como trabajo en curso; la versión nueva
    // se aplica al pasar a otra visita o a otra pantalla.
    marcarTrabajo('visita', conDatos || !!resultado);
    if (!conDatos || resultado) return;
    const t = setTimeout(() => void guardarBorrador({ datos: b, fotos, paso, guardado_en: new Date().toISOString() }).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [b, fotos, paso, conDatos, resultado]);
  // Al salir de la pantalla se guarda lo último (lo escrito en los 400 ms previos no se pierde).
  const descartada = useRef(false);
  const ultimoEstado = useRef({ b, fotos, paso, conDatos, resultado });
  ultimoEstado.current = { b, fotos, paso, conDatos, resultado };
  useEffect(
    () => () => {
      marcarTrabajo('visita', false);
      const u = ultimoEstado.current;
      // Descartada con «Salir»: no se vuelve a guardar.
      if (u.b && u.conDatos && !u.resultado && !descartada.current)
        void guardarBorrador({ datos: u.b, fotos: u.fotos, paso: u.paso, guardado_en: new Date().toISOString() }).catch(() => {});
    },
    [],
  );

  const reqs = useMemo(() => (b ? requisitos(b, cat, fotos.length) : []), [b, cat, fotos.length]);
  const pct = avance(reqs);
  const pendientesPorSeccion = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of faltantes(reqs, alGuardar)) m.set(r.seccion, (m.get(r.seccion) ?? 0) + 1);
    return m;
  }, [reqs, alGuardar]);
  const faltan = useMemo(
    () =>
      new Set(
        faltantes(reqs, alGuardar)
          .filter((r) => revisadas.has(r.seccion))
          .map((r) => r.campo),
      ),
    [reqs, alGuardar, revisadas],
  );

  // Modo captura (sin la barra del menú) mientras se llena; la pantalla final ya no lo es.
  useEffect(() => {
    fijarModoCaptura(!resultado);
    return () => fijarModoCaptura(false);
  }, [resultado]);

  if (!b) return <Cargando texto="Abriendo el formulario…" />;

  const set = (cambios: Cambios) => setB((prev) => ({ ...prev!, ...cambios }) as Borrador);

  const irA = (n: number) => {
    setPaso(n);
    requestAnimationFrame(() => arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const enfocarFaltante = (campo: string) =>
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-campo="${CSS.escape(campo)}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector<HTMLElement>('input, select, textarea, button')?.focus({ preventScroll: true });
    });

  const siguiente = () => {
    const f = faltantes(reqs, false).filter((r) => r.seccion === paso);
    setRevisadas((s) => new Set(s).add(paso));
    if (f.length) {
      avisar(f.length === 1 ? `Falta: ${f[0]!.etiqueta}` : `Faltan ${f.length} campos en esta sección`, { tipo: 'error' });
      enfocarFaltante(f[0]!.campo);
      return;
    }
    irA(paso + 1);
  };

  const guardar = async () => {
    setAlGuardar(true);
    setRevisadas(new Set(SECCIONES.map((_, i) => i)));
    const f = faltantes(reqs, true);
    if (f.length) {
      const primera = f[0]!;
      avisar(f.length === 1 ? `Falta: ${primera.etiqueta}` : `Faltan ${f.length} campos: ${primera.etiqueta} y otros`, { tipo: 'error' });
      if (primera.seccion !== paso) setPaso(primera.seccion);
      enfocarFaltante(primera.campo);
      return;
    }
    const entrada = { ...aEntrada(b, fotos.length), capturado_en: new Date().toISOString() };
    const forma = visitaEsquema.safeParse(entrada);
    if (!forma.success) {
      // Un valor con forma no válida (p. ej. un número mal escrito): se lleva a la persona a ese campo.
      const ruta = forma.error.issues[0]?.path ?? [];
      const campo =
        ruta.length > 1 && ruta[0] === 'materiales'
          ? `material.${ruta[1]}.${ruta[2]}`
          : ruta.length > 1
            ? `${ruta[0]}.${ruta[1]}.${ruta[2]}`
            : String(ruta[0] ?? '');
      const r = reqs.find((x) => x.campo === campo || x.campo === ruta[0]);
      avisar(`Revise «${r?.etiqueta ?? campo}»: valor no válido`, { tipo: 'error' });
      if (r && r.seccion !== paso) setPaso(r.seccion);
      enfocarFaltante(campo);
      return;
    }
    // Sin confirmación: «Guardar» guarda y envía (la pantalla de envío muestra el avance).
    setGuardando(true);
    try {
      const fotosVisita = fotos;
      await guardarEnCola({
        visita_num: entrada.visita_num,
        visita: entrada,
        fotos: fotosVisita,
        guardado_en: new Date().toISOString(),
        fotos_subidas: [],
        pdf_subido: false,
      });
      await borrarBorrador();
      const pdf = () =>
        generarFicha(
          forma.data,
          fotosVisita.filter((x) => x.copia).map((x) => ({ base64: x.copia!, observacion: x.observacion })),
        );
      let id: number | null = null;
      let senalDebil = false;
      if (navigator.onLine) {
        // Se espera el envío con la pantalla bloqueada, como máximo ESPERA_MAX_MS: si no terminó, se
        // corta (señal débil). La visita ya está en el teléfono y se retoma sola desde donde quedó.
        let vencido = false;
        const reloj = setTimeout(() => {
          vencido = true;
          cancelarEnvio();
        }, ESPERA_MAX_MS);
        const r = await enviarPendientes().catch(() => null);
        clearTimeout(reloj);
        id = r?.enviadas.find((e) => e.visita_num === entrada.visita_num)?.id ?? null;
        senalDebil = vencido && !id;
      }
      setResultado({ visita_num: entrada.visita_num, id, pdf, senalDebil });
      avisar(id ? 'Inspección registrada' : 'Inspección guardada en el teléfono', { tipo: id ? 'exito' : 'info' });
    } catch (e) {
      avisar(mensajeError(e), { tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  // «Salir»: sin datos, sale; con datos, pregunta si descarta lo escrito (cancelar = seguir llenando).
  const salir = async () => {
    if (conDatos) {
      const descartar = await confirmar({
        titulo: '¿Descartar la inspección?',
        mensaje: 'Tiene datos llenados. Si sale, se borra lo escrito en esta inspección.',
        confirmar: 'Descartar y salir',
        cancelar: 'Seguir llenando',
        peligro: true,
      });
      if (!descartar) return;
      descartada.current = true;
      await borrarBorrador().catch(() => {});
    }
    navegar(urlInspecciones);
  };

  if (resultado) return <Terminada r={resultado} />;

  const Seccion = SECCIONES_FORMULARIO[paso]!;
  const ultimo = paso === SECCIONES.length - 1;
  return (
    <div ref={arriba} className="mx-auto max-w-2xl scroll-mt-20">
      {guardando && <EnvioEnCurso />}
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900">Inspección de restaurador</h1>
          <p className="truncate text-xs text-slate-500">{b.visita_num}</p>
        </div>
        {/* Modo captura: sin el menú inferior; «Salir» (a la derecha, en rojo suave) vuelve a Inspecciones. */}
        <button
          type="button"
          onClick={salir}
          className={`flex h-10 shrink-0 items-center gap-1 rounded-xl border px-3 text-sm font-semibold hover:bg-rose-100 ${TONO.mal.caja}`}
        >
          <X className="h-4 w-4" aria-hidden /> Salir
        </button>
      </div>

      {/* Indicador de secciones: fijo, sin desplazamiento; un segmento por sección (se puede tocar para ir). */}
      <div className="mb-4">
        <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-600">
          <span>
            Sección {paso + 1} de {SECCIONES.length}
          </span>
          <span>{pct}% completo</span>
        </div>
        <nav className="grid gap-1" style={{ gridTemplateColumns: `repeat(${SECCIONES.length}, minmax(0, 1fr))` }} aria-label="Secciones">
          {SECCIONES.map((s, i) => {
            const pend = revisadas.has(i) ? (pendientesPorSeccion.get(i) ?? 0) : 0;
            const pasada = i < paso || revisadas.has(i);
            const color = i === paso ? 'bg-marca-600' : pend ? 'bg-rose-300' : pasada && !pendientesPorSeccion.get(i) ? 'bg-marca-300' : 'bg-slate-200';
            return (
              <button
                key={s}
                type="button"
                onClick={() => irA(i)}
                aria-current={i === paso ? 'step' : undefined}
                aria-label={`${i + 1}. ${s}${pend ? `, faltan ${pend}` : ''}`}
                title={`${i + 1}. ${s}`}
                className="py-2"
              >
                <span className={`block h-2 rounded-full transition-colors ${color}`} />
              </button>
            );
          })}
        </nav>
      </div>

      <div className="tarjeta p-4">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          {paso + 1}. {SECCIONES[paso]}
        </h2>
        <Seccion b={b} set={set} faltan={faltan} cat={cat} fotos={fotos} setFotos={setFotos} />
      </div>

      {/* Botones fijos al pie del formulario (en modo captura no está la barra del menú). */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:mx-0 lg:rounded-t-2xl">
        <div className="flex gap-3">
          <button type="button" className="btn-secundario flex-1" disabled={paso === 0} onClick={() => irA(paso - 1)}>
            <ChevronLeft className="h-5 w-5" /> Anterior
          </button>
          {ultimo ? (
            <button type="button" className="btn-primario flex-1" disabled={guardando} onClick={guardar}>
              <Save className="h-5 w-5" /> Guardar
            </button>
          ) : (
            <button type="button" className="btn-primario flex-1" onClick={siguiente}>
              Siguiente <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Pantalla bloqueante mientras se guarda y envía la visita, con el paso en curso. Se quita sola al
 * terminar o al vencer el tiempo máximo (ESPERA_MAX_MS).
 */
function EnvioEnCurso() {
  const [paso, setPaso] = useState('Guardando la inspección');
  useEffect(() => alCambiarPaso(setPaso), []);
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Enviando inspección"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl" role="status" aria-live="polite">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-marca-600" aria-hidden />
        <p className="mt-4 text-lg font-bold text-slate-900">Enviando inspección</p>
        <p className="mt-1 text-sm text-slate-600">{paso}…</p>
        <p className="mt-3 text-xs text-slate-500">No cierre la app. La inspección ya quedó guardada en el teléfono.</p>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Pantalla final. «Listo» (o la ✕) lleva a «Inspecciones y registros», donde la inspección aparece
 * resaltada (o en «Sin enviar» si quedó en el teléfono). Nada se pierde al cerrar: el PDF se puede
 * descargar después desde el detalle.
 */
function Terminada({ r }: { r: Resultado }) {
  const [generando, setGenerando] = useState(false);
  const avisar = useAvisos();
  const navegar = useNavigate();
  const cerrar = () => navegar(urlInspecciones, { state: { resaltar: r.visita_num } });
  const pdf = async () => {
    setGenerando(true);
    try {
      descargar(await r.pdf(), `${r.visita_num}.pdf`);
    } catch (e) {
      avisar(mensajeError(e), { tipo: 'error' });
    } finally {
      setGenerando(false);
    }
  };
  return (
    <div className="mx-auto max-w-md">
      <button
        type="button"
        onClick={cerrar}
        className="-ml-2 flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" aria-hidden /> Cerrar
      </button>
      <div className="pb-8 pt-2 text-center">
        {r.id ? (
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" aria-hidden />
        ) : (
          <CloudOff className="mx-auto h-14 w-14 text-amber-500" aria-hidden />
        )}
        <h1 className="mt-3 text-xl font-bold text-slate-900">{r.id ? 'Inspección registrada' : 'Inspección guardada en el teléfono'}</h1>
        <p className="mt-1 text-sm text-slate-600">{r.visita_num}</p>
        {!r.id && (
          <p className="mt-2 text-sm text-slate-600">
            {r.senalDebil ? 'La señal es débil y no se pudo enviar ahora. ' : ''}
            Quedó guardada en el teléfono y se enviará sola cuando haya señal.
          </p>
        )}
        <div className="mt-6 space-y-3">
          <button type="button" className="btn-primario w-full" onClick={cerrar}>
            Listo
          </button>
          <button type="button" className="btn-secundario w-full" disabled={generando} onClick={pdf}>
            {generando ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />} Descargar PDF
          </button>
          {r.id && (
            <Link to={urlVisita(r.id)} className="btn-secundario w-full">
              Ver inspección
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
