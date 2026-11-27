/**
 * Editar una inspección registrada (permiso Editar). Todo entra bloqueado y en resumen; el lápiz de cada
 * sección la abre con los mismos campos del registro. Una sección a la vez: «Aplicar» la valida con las
 * reglas compartidas y la vuelve a bloquear marcada «Modificada»; «Cancelar» la deja como estaba. Al final
 * «Guardar cambios» muestra lo que cambió (antes → después), pide el motivo y guarda todo de una vez.
 * Pide conexión: la edición no se guarda en el teléfono.
 */
import { EQUIPO_ETIQUETA } from '@shared/constantes';
import {
  CAMPOS_EDITABLES,
  type Cambio,
  type ObservacionesFotos,
  cambiosVisita,
  seccionesConCambios,
} from '@shared/edicion';
import { editarVisitaEsquema } from '@shared/esquemas';
import type { FotoVisita, VisitaDetalle } from '@shared/tipos';
import {
  SECCIONES,
  type Visita,
  faltantes,
  resumenMateriales,
  resumenPersonal,
  visitaEsquema,
} from '@shared/visitas';
import {
  Check,
  ChevronLeft,
  ImageOff,
  Loader2,
  Lock,
  Pencil,
  Save,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CajaError, Cargando, Vacio } from '@components/ui';
import { useConfirmar } from '@components/confirm-dialog';
import {
  ErrorCampo,
  ErrorServidor,
  useFormulario,
} from '@components/formulario';
import { Hoja } from '@components/hoja';
import { useAvisos } from '@components/toast';
import { mensajeError } from '@common/http/api';
import { fecha } from '@common/utils/fechas';
import { useClaveIntento } from '@common/http/clave-intento';
import { fijarModoCaptura } from '@common/menu/modo-captura';
import { marcarTrabajo } from '@common/pwa/trabajo';
import { ValoresAnteriores } from '../../components/campos';
import { ListaCambios } from '../../components/cambios';
import {
  type Borrador,
  type Cambios,
  aEntrada,
  aVisita,
  borradorDeVisita,
  requisitos,
} from '../../components/formulario';
import { FirmaFija, SECCIONES_FORMULARIO } from '../../components/secciones';
import { useCatalogosVisita } from '../../hooks/useCatalogosVisita';
import { useFotoPantalla } from '../../hooks/useFotoPantalla';
import {
  useEditarInspeccion,
  useInspeccion,
} from '../../hooks/useInspecciones';
import { urlVisita } from '../../urls';

const FOTOGRAFIAS = SECCIONES.indexOf('Fotografías');
const PERSONAL = SECCIONES.indexOf('Personal');
const TABLERO = SECCIONES.indexOf('Tablero y mediciones');
/** Requisitos que la edición no revisa: la firma y las fotos no se editan. */
const NO_SE_EDITAN = new Set(['firma_img', 'fotos']);

const motivoEsquema = editarVisitaEsquema.pick({ motivo: true });

export function EditarVisita() {
  const id = Number(useParams().id);
  const consulta = useInspeccion(id);
  if (!navigator.onLine || consulta.fetchStatus === 'paused')
    return <Vacio texto="Para editar una inspección se necesita conexión." />;
  if (consulta.isPending) return <Cargando texto="Abriendo la inspección…" />;
  if (consulta.isError || !consulta.data)
    return (
      <CajaError
        error={consulta.error ?? new Error('Inspección no encontrada')}
        reintentar={() => void consulta.refetch()}
      />
    );
  // Se edita la versión que se abrió: si alguien la cambia mientras tanto, el servidor lo avisa (409).
  return <Editor key={consulta.data.version} d={consulta.data} />;
}

const obsDe = (fotos: FotoVisita[]): ObservacionesFotos =>
  Object.fromEntries(fotos.map(f => [f.orden, f.observacion]));

function Editor({ d }: { d: VisitaDetalle }) {
  const { data: cat } = useCatalogosVisita();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const navegar = useNavigate();
  const numFotos = d.datos.num_fotos ?? d.fotos.length;
  const obsOriginal = useMemo(() => obsDe(d.fotos), [d.fotos]);

  /** Lo aplicado (más lo que se escribe en la sección abierta). */
  const [b, setB] = useState<Borrador>(() => borradorDeVisita(d.datos));
  const [obs, setObs] = useState<ObservacionesFotos>(obsOriginal);
  /** Sección abierta y cómo estaba al abrirla (para «Cancelar»). */
  const [abierta, setAbierta] = useState<number | null>(null);
  const [respaldo, setRespaldo] = useState<{
    b: Borrador;
    obs: ObservacionesFotos;
  } | null>(null);
  const [faltan, setFaltan] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);

  const actual = useMemo(() => aVisita(aEntrada(b, numFotos)), [b, numFotos]);
  const cambios = useMemo(
    () => cambiosVisita(d.datos, actual, obsOriginal, obs),
    [d.datos, actual, obsOriginal, obs],
  );
  const modificadas = seccionesConCambios(cambios);
  const anteriores = useMemo(
    () =>
      new Map(cambios.map(c => [c.campo.replace(/^tablero\./, ''), c.antes])),
    [cambios],
  );

  // Sin el menú inferior (la barra de guardar va fija abajo); con cambios, la versión nueva de la app
  // espera a que termine (nunca se recarga encima de lo editado).
  useEffect(() => {
    fijarModoCaptura(true);
    return () => fijarModoCaptura(false);
  }, []);
  useEffect(() => {
    marcarTrabajo('edicion', cambios.length > 0 || abierta !== null);
    return () => marcarTrabajo('edicion', false);
  }, [cambios.length, abierta]);

  const enfocar = (selector: string) =>
    requestAnimationFrame(() => {
      const el = document.querySelector(selector);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector<HTMLElement>('input, select, textarea, button')?.focus({
        preventScroll: true,
      });
    });

  const abrir = (i: number) => {
    if (abierta !== null) {
      avisar('Aplique o cancele la sección abierta primero', {
        tipo: 'error',
      });
      enfocar(`[data-seccion="${abierta}"]`);
      return;
    }
    setRespaldo({ b, obs });
    setFaltan(new Set());
    setAbierta(i);
    enfocar(`[data-seccion="${i}"]`);
  };

  const cancelar = () => {
    if (respaldo) {
      setB(respaldo.b);
      setObs(respaldo.obs);
    }
    setRespaldo(null);
    setFaltan(new Set());
    setAbierta(null);
  };

  const aplicar = (i: number) => {
    // Sin cambios en la sección: solo se cierra (las inspecciones antiguas pueden tener datos que hoy
    // se piden y no se tocaron).
    if (!modificadas.has(i)) return cancelar();
    // Forma de los valores (p. ej. un número mal escrito) en esta sección.
    const forma = visitaEsquema.safeParse(aEntrada(b, numFotos));
    if (!forma.success) {
      for (const issue of forma.error.issues) {
        const [campo, indice, sub] = issue.path;
        const clave =
          campo === 'materiales'
            ? `material.${indice}.${sub}`
            : typeof indice === 'number'
              ? `${String(campo)}.${indice}.${String(sub)}`
              : String(campo);
        const enSeccion =
          (CAMPOS_EDITABLES[campo as keyof Visita]?.[0] &&
            SECCIONES.indexOf(CAMPOS_EDITABLES[campo as keyof Visita]![0]) ===
              i) ||
          (campo === 'tablero_campos' && i === TABLERO);
        if (!enSeccion) continue;
        setFaltan(new Set([clave]));
        avisar(
          `Revise «${CAMPOS_EDITABLES[campo as keyof Visita]?.[1] ?? clave}»: valor no válido`,
          { tipo: 'error' },
        );
        enfocar(`[data-campo="${CSS.escape(clave)}"]`);
        return;
      }
    }
    const f = faltantes(requisitos(b, cat, numFotos), true).filter(
      r => r.seccion === i && !NO_SE_EDITAN.has(r.campo),
    );
    if (f.length) {
      setFaltan(new Set(f.map(r => r.campo)));
      avisar(
        f.length === 1
          ? `Falta: ${f[0]!.etiqueta}`
          : `Faltan ${f.length} campos en esta sección`,
        { tipo: 'error' },
      );
      enfocar(`[data-campo="${CSS.escape(f[0]!.campo)}"]`);
      return;
    }
    setRespaldo(null);
    setFaltan(new Set());
    setAbierta(null);
  };

  const salir = async () => {
    if (cambios.length || abierta !== null) {
      const si = await confirmar({
        titulo: '¿Descartar los cambios?',
        mensaje: 'Lo que cambió en esta edición no se guardará.',
        confirmar: 'Descartar',
        cancelar: 'Seguir editando',
        peligro: true,
      });
      if (!si) return;
    }
    marcarTrabajo('edicion', false);
    navegar(urlVisita(d.id), { replace: true });
  };

  const set = (c: Cambios) => setB(prev => ({ ...prev, ...c }) as Borrador);
  const titulo = `${EQUIPO_ETIQUETA[d.equipo] ?? d.equipo}${d.datos.codigo_energis ? ` ${d.datos.codigo_energis}` : ''}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-start gap-2">
        <button
          type="button"
          onClick={salir}
          className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-200"
          aria-label="Volver al detalle"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-slate-900">
            Editar · {titulo}
          </h1>
          <p className="truncate font-mono text-xs text-slate-500">
            {d.visita_num}
          </p>
        </div>
      </div>
      <p className="mb-4 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        Toque <Pencil className="inline h-4 w-4" aria-label="el lápiz" /> en la
        sección que quiere corregir.
      </p>

      <ValoresAnteriores.Provider value={anteriores}>
        {SECCIONES.map((nombre, i) => {
          const abiertaAqui = abierta === i;
          const Seccion = SECCIONES_FORMULARIO[i]!;
          return (
            <section
              key={nombre}
              data-seccion={i}
              className={`tarjeta mb-3 scroll-mt-4 overflow-hidden ${abiertaAqui ? 'ring-2 ring-marca-400' : ''}`}
            >
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                <h2 className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-marca-900">
                  {i + 1}. {nombre}
                </h2>
                {modificadas.has(i) && !abiertaAqui && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    Modificada
                  </span>
                )}
                {!abiertaAqui && (
                  <button
                    type="button"
                    onClick={() => abrir(i)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-marca-700 hover:bg-marca-100"
                    aria-label={`Editar ${nombre}`}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="p-4">
                {abiertaAqui ? (
                  <>
                    {i === FOTOGRAFIAS ? (
                      <EditorObservaciones
                        idVisita={d.id}
                        fotos={d.fotos}
                        obs={obs}
                        setObs={setObs}
                      />
                    ) : (
                      <Seccion
                        b={b}
                        set={set}
                        faltan={faltan}
                        cat={cat}
                        fotos={[]}
                        setFotos={() => {}}
                        edicion
                      />
                    )}
                  </>
                ) : (
                  <Resumen
                    i={i}
                    v={actual}
                    idVisita={d.id}
                    fotos={d.fotos}
                    obs={obs}
                  />
                )}
              </div>
            </section>
          );
        })}
      </ValoresAnteriores.Provider>

      {/* Barra fija que cambia con lo que se hace: con una sección abierta, sus botones (Cancelar /
          Aplicar) siempre a la vista aunque la sección sea larga; sin sección abierta, guardar todo. */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:mx-0 lg:rounded-t-2xl">
        {abierta !== null ? (
          <>
            <p
              className="mb-2 truncate text-center text-xs font-semibold text-marca-800"
              role="status"
            >
              Editando: {abierta + 1}. {SECCIONES[abierta]}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-secundario flex-1"
                onClick={cancelar}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primario flex-1"
                onClick={() => aplicar(abierta)}
              >
                <Check className="h-5 w-5" /> Aplicar
              </button>
            </div>
          </>
        ) : (
          <>
            <p
              className="mb-2 text-center text-xs text-slate-500"
              role="status"
            >
              {modificadas.size
                ? `${modificadas.size} ${modificadas.size === 1 ? 'sección modificada' : 'secciones modificadas'}`
                : 'Sin cambios'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-secundario flex-1 px-3"
                onClick={salir}
              >
                Descartar
              </button>
              <button
                type="button"
                className="btn-primario flex-1 whitespace-nowrap px-3"
                disabled={!cambios.length}
                onClick={() => setConfirmando(true)}
              >
                <Save className="h-5 w-5" /> Guardar cambios
              </button>
            </div>
          </>
        )}
      </div>

      {confirmando && (
        <Confirmar
          d={d}
          cambios={cambios}
          datos={aEntrada(b, numFotos)}
          obs={obs}
          onCerrar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}

const texto = (v: unknown) =>
  v === null || v === undefined ? '' : String(v).trim();

/** Sección bloqueada: sus datos en resumen (solo lo que tiene valor). */
function Resumen({
  i,
  v,
  idVisita,
  fotos,
  obs,
}: {
  i: number;
  v: Visita;
  idVisita: number;
  fotos: FotoVisita[];
  obs: ObservacionesFotos;
}) {
  if (i === FOTOGRAFIAS)
    return fotos.length ? (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fotos.map(f => (
          <figure key={f.orden}>
            <Miniatura idVisita={idVisita} foto={f} />
            <figcaption className="mt-1 text-xs text-slate-600">
              <span className="font-semibold">Foto {f.orden}</span>
              {texto(obs[f.orden]) ? ` · ${texto(obs[f.orden])}` : ''}
            </figcaption>
          </figure>
        ))}
      </div>
    ) : (
      <p className="text-sm text-slate-500">Sin fotografías.</p>
    );

  const nombre = SECCIONES[i]!;
  const filas: [string, string][] = [];
  for (const [campo, [sec, etiqueta]] of Object.entries(CAMPOS_EDITABLES) as [
    keyof Visita,
    [string, string],
  ][]) {
    if (sec !== nombre) continue;
    const valor =
      campo === 'materiales'
        ? resumenMateriales(v.materiales)
        : campo === 'personal'
          ? resumenPersonal(v.personal)
          : campo === 'fecha_visita' && v.fecha_visita
            ? fecha(`${v.fecha_visita}T12:00:00`)
            : texto(v[campo]);
    if (valor) filas.push([etiqueta, valor]);
  }
  if (i === TABLERO)
    for (const [k, x] of Object.entries(v.tablero_campos ?? {}))
      filas.push([`Tablero: ${k}`, x]);

  return (
    <>
      {filas.length ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-3">
          {filas.map(([e, valor]) => (
            <div key={e} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {e}
              </dt>
              <dd className="break-words text-sm text-slate-900">{valor}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-slate-500">Sin datos.</p>
      )}
      {i === PERSONAL && (
        <div className="mt-3">
          <FirmaFija firma={v.firma_img} />
        </div>
      )}
    </>
  );
}

function Miniatura({ idVisita, foto }: { idVisita: number; foto: FotoVisita }) {
  const { src, fallo, marcarFallo } = useFotoPantalla(idVisita, foto);
  return (
    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100">
      {fallo ? (
        <ImageOff className="h-6 w-6 text-slate-400" aria-hidden />
      ) : src ? (
        <img
          src={src}
          alt={`Foto ${foto.orden}`}
          className="h-full w-full object-cover"
          onError={marcarFallo}
        />
      ) : (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
      )}
    </div>
  );
}

/** Fotos: solo se edita la observación de cada una (cambiar fotos no es parte de la edición). */
function EditorObservaciones({
  idVisita,
  fotos,
  obs,
  setObs,
}: {
  idVisita: number;
  fotos: FotoVisita[];
  obs: ObservacionesFotos;
  setObs: (o: ObservacionesFotos) => void;
}) {
  if (!fotos.length)
    return <p className="text-sm text-slate-500">Sin fotografías.</p>;
  return (
    <div className="space-y-4">
      {fotos.map(f => (
        <div
          key={f.orden}
          data-campo={`foto.${f.orden}`}
          className="flex gap-3"
        >
          <div className="w-24 shrink-0">
            <Miniatura idVisita={idVisita} foto={f} />
          </div>
          <div className="min-w-0 flex-1">
            <label className="etiqueta" htmlFor={`v-foto.${f.orden}`}>
              Observación de la foto {f.orden}
            </label>
            <textarea
              id={`v-foto.${f.orden}`}
              className="campo min-h-[72px]"
              maxLength={500}
              value={obs[f.orden] ?? ''}
              onChange={e => setObs({ ...obs, [f.orden]: e.target.value })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Confirmación: lo que cambió (antes → después) y el motivo, que quedan en el historial. */
function Confirmar({
  d,
  cambios,
  datos,
  obs,
  onCerrar,
}: {
  d: VisitaDetalle;
  cambios: Cambio[];
  datos: ReturnType<typeof aEntrada>;
  obs: ObservacionesFotos;
  onCerrar: () => void;
}) {
  const form = useFormulario(motivoEsquema, { motivo: '' });
  const [error, setError] = useState<string | null>(null);
  const editar = useEditarInspeccion();
  const intento = useClaveIntento();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const motivo = form.watch('motivo') ?? '';
  const guardar = form.handleSubmit(async ({ motivo }) => {
    setError(null);
    try {
      await editar(
        d.id,
        {
          datos: { ...datos, capturado_en: d.datos.capturado_en },
          observaciones: d.fotos.map(f => ({
            orden: f.orden,
            observacion: texto(obs[f.orden]) || null,
          })),
          motivo,
          version: d.version,
        },
        intento.clave(),
      );
      intento.renovar();
      marcarTrabajo('edicion', false);
      avisar('Inspección actualizada');
      navegar(urlVisita(d.id), { replace: true });
    } catch (e) {
      setError(mensajeError(e));
    }
  });
  const porSeccion = SECCIONES.map((nombre, i) => ({
    nombre,
    lista: cambios.filter(c => c.seccion === i),
  })).filter(s => s.lista.length);
  return (
    <Hoja
      abierta
      titulo="Confirmar cambios"
      onCerrar={onCerrar}
      pie={
        <div className="space-y-2">
          <ErrorServidor mensaje={error} />
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-secundario flex-1"
              onClick={onCerrar}
            >
              Revisar
            </button>
            <button
              type="button"
              className="btn-primario flex-1"
              onClick={guardar}
              disabled={form.formState.isSubmitting || !motivo.trim()}
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}{' '}
              Guardar
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {porSeccion.map(s => (
          <div key={s.nombre}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-marca-900">
              {s.nombre}
            </p>
            <ListaCambios cambios={s.lista} />
          </div>
        ))}
        <div>
          <label className="etiqueta" htmlFor="motivo-edicion">
            Motivo del cambio <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="motivo-edicion"
            className="campo min-h-[88px]"
            maxLength={300}
            placeholder="P. ej. lectura mal digitada"
            {...form.register('motivo')}
          />
          <ErrorCampo form={form} nombre="motivo" />
        </div>
      </div>
    </Hoja>
  );
}
