import type { UsuarioSesion } from '@shared/tipos';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorApi, configurarExpiracion } from '@common/http/api';
import { fijarZona } from '@common/utils/fechas';
import { cerrarSesion, quienSoy } from '@common/seguridad/api';

interface Sesion {
  usuario: UsuarioSesion | null;
  cargando: boolean;
  salir: (todas?: boolean) => Promise<void>;
}

// Avisa a las demás pestañas abiertas de la app que la sesión se cerró (o se abrió otra).
const canal =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('sesion')
    : null;

const Ctx = createContext<Sesion | null>(null);

/**
 * Excepción E1 (captura sin conexión): la última sesión confirmada por el servidor se recuerda en el
 * teléfono para poder abrir la app y capturar sin señal. No guarda ningún token (la cookie es HttpOnly);
 * el servidor valida la sesión y los permisos al enviar.
 */
const CLAVE_SESION = 'sesion-recordada';
type Yo = Awaited<ReturnType<typeof quienSoy>>;
/** Lo guardado: la sesión y cuándo la confirmó el servidor por última vez. */
interface Recordada {
  yo: Yo;
  confirmada_en: number;
}
/**
 * El servidor renueva la sesión cuando le quedan menos de 15 días (RENOVAR_SI_RESTA_MS): tras cualquier
 * confirmación le quedan al menos 15. Dentro de 14 días la app se abre al instante con la sesión
 * recordada sin riesgo de que ya haya vencido por tiempo; pasado eso espera al servidor.
 */
const VIGENCIA_SEGURA_MS = 14 * 24 * 3600 * 1000;

function recordar(yo: Yo) {
  try {
    if (yo)
      localStorage.setItem(
        CLAVE_SESION,
        JSON.stringify({ yo, confirmada_en: Date.now() } satisfies Recordada),
      );
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    /* almacenamiento no disponible */
  }
}
function leerRecordada(): Recordada | null {
  try {
    const v = localStorage.getItem(CLAVE_SESION);
    if (!v) return null;
    const r = JSON.parse(v) as Recordada | Yo;
    // Formato anterior (solo la sesión, sin fecha): sirve sin señal, pero no para abrir al instante.
    return r && typeof r === 'object' && 'confirmada_en' in r
      ? r
      : { yo: r as Yo, confirmada_en: 0 };
  } catch {
    return null;
  }
}
/** Sin señal: la última sesión confirmada, sin importar su edad (excepción E1). */
const recordada = (): Yo => leerRecordada()?.yo ?? null;
/** Para abrir al instante: solo si se confirmó hace poco (no puede haber vencido por tiempo). */
function recordadaReciente(): Yo | undefined {
  const r = leerRecordada();
  return r && Date.now() - r.confirmada_en < VIGENCIA_SEGURA_MS
    ? r.yo
    : undefined;
}

/** Aviso para la pantalla de ingreso: la sesión terminó sola, o la persona la cerró. */
const CLAVE_AVISO = 'aviso-ingreso';
function avisarIngreso(texto: string) {
  try {
    sessionStorage.setItem(CLAVE_AVISO, texto);
  } catch {
    /* almacenamiento no disponible */
  }
}
const avisarSesionTerminada = () =>
  avisarIngreso('Su sesión terminó. Ingrese de nuevo para continuar.');

/**
 * Cierre sin señal: la cookie es HttpOnly y solo el servidor puede invalidarla. Se marca el cierre como
 * pendiente y, mientras lo esté, la app no usa la sesión; al volver la señal se cierra en el servidor
 * antes de cualquier otra cosa.
 */
const CLAVE_CIERRE = 'cierre-pendiente';
const cierrePendiente = () => {
  try {
    return localStorage.getItem(CLAVE_CIERRE);
  } catch {
    return null;
  }
};
function marcarCierre(todas: boolean | null) {
  try {
    if (todas === null) localStorage.removeItem(CLAVE_CIERRE);
    else localStorage.setItem(CLAVE_CIERRE, todas ? 'todas' : 'esta');
  } catch {
    /* almacenamiento no disponible */
  }
}
/** Cierra en el servidor; `false` si no hubo respuesta (sin señal o demasiado lento). */
async function cerrarEnServidor(todas: boolean) {
  try {
    await Promise.race([
      cerrarSesion(todas),
      new Promise((_, no) =>
        setTimeout(() => no(new ErrorApi(0, 'lento')), 8000),
      ),
    ]);
    return true;
  } catch (e) {
    // Sin respuesta: queda pendiente. Cualquier otra respuesta (p. ej. ya no había sesión) cuenta como cerrada.
    return !(e instanceof ErrorApi && e.status === 0);
  }
}
/** Lee el aviso una sola vez (lo usa la pantalla de ingreso). */
export function tomarAvisoIngreso(): string | null {
  try {
    const v = sessionStorage.getItem(CLAVE_AVISO);
    sessionStorage.removeItem(CLAVE_AVISO);
    return v;
  } catch {
    return null;
  }
}

async function consultarSesion(): Promise<Yo> {
  const pendiente = cierrePendiente();
  if (pendiente) {
    if (await cerrarEnServidor(pendiente === 'todas')) marcarCierre(null);
    return null;
  }
  try {
    const yo = await quienSoy();
    // Había una sesión recordada y el servidor ya no la reconoce: terminó (vencida o cerrada por otro).
    if (!yo && leerRecordada()) avisarSesionTerminada();
    recordar(yo);
    return yo;
  } catch (e) {
    // Sin señal: se usa la última sesión confirmada. Con cualquier otra respuesta, sin sesión.
    if (e instanceof ErrorApi && e.status === 0) return recordada();
    recordar(null);
    return null;
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navegar = useNavigate();
  // Con una sesión confirmada hace poco, la app se dibuja de inmediato y el servidor la confirma en
  // paralelo (las pantallas piden sus datos al mismo tiempo, no una tras otra). Si el servidor ya no la
  // reconoce, pasa al ingreso con el aviso «Su sesión terminó»; ningún dato se entrega sin cookie válida.
  const { data, isLoading } = useQuery({
    queryKey: ['yo'],
    queryFn: consultarSesion,
    staleTime: 5 * 60_000,
    retry: false,
    placeholderData: recordadaReciente,
  });
  if (data?.zona_horaria) fijarZona(data.zona_horaria);

  // Deja la app «sin sesión»: primero se marca sin usuario (la pantalla pasa al ingreso) y luego se
  // descartan los datos en memoria. No se usa qc.clear(): desconecta la pantalla de la consulta de
  // sesión y no se actualizaría.
  const limpiar = useCallback(() => {
    recordar(null);
    qc.setQueryData(['yo'], null);
    qc.removeQueries({ predicate: q => q.queryKey[0] !== 'yo' });
    navegar('/', { replace: true });
  }, [qc, navegar]);

  useEffect(() => {
    // La sesión venció o la cerró otro mientras se usaba la app (el servidor respondió 401).
    configurarExpiracion(() => {
      avisarSesionTerminada();
      limpiar();
    });
    if (!canal) return;
    const alMensaje = (e: MessageEvent) => {
      if (e.data === 'salir') limpiar();
      else if (e.data === 'entrar') qc.invalidateQueries({ queryKey: ['yo'] });
    };
    canal.addEventListener('message', alMensaje);
    return () => canal.removeEventListener('message', alMensaje);
  }, [qc, limpiar]);

  // Al iniciar sesión en esta pestaña, las otras también entran.
  const idUsuario = data?.usuario?.id;
  useEffect(() => {
    if (idUsuario) canal?.postMessage('entrar');
  }, [idUsuario]);

  const [cerrando, setCerrando] = useState(false);
  const usuario = data?.usuario ?? null;
  const valor: Sesion = {
    usuario,
    cargando: isLoading,
    /**
     * Cierre de sesión: pantalla «Cerrando sesión…» mientras se cierra en el servidor (que además pide
     * al navegador vaciar su caché HTTP del sitio), se borran los datos en memoria, la sesión recordada
     * y lo de esta pestaña, y se avisa a las demás. Lo guardado para enviar (inspecciones sin señal y el
     * borrador) se conserva. Sin señal, el cierre queda pendiente (ver cierrePendiente).
     */
    salir: async (todas = false) => {
      if (cerrando) return;
      setCerrando(true);
      const minimo = new Promise(ok => setTimeout(ok, 700)); // que se alcance a leer el aviso
      if (!(await cerrarEnServidor(todas))) marcarCierre(todas);
      await minimo;
      try {
        sessionStorage.clear();
      } catch {
        /* almacenamiento no disponible */
      }
      avisarIngreso(
        cierrePendiente()
          ? 'Sesión cerrada en este dispositivo. Se terminará de cerrar al volver la señal.'
          : 'Sesión cerrada.',
      );
      limpiar();
      canal?.postMessage('salir');
      setCerrando(false);
    },
  };
  return (
    <Ctx.Provider value={valor}>
      {children}
      {cerrando && (
        <div
          className="anim-fondo fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label="Cerrando sesión"
        >
          <div className="anim-dialogo flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-2xl">
            <Loader2
              className="h-5 w-5 animate-spin text-marca-600"
              aria-hidden
            />
            <span className="font-semibold text-slate-900">
              Cerrando sesión…
            </span>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Vuelve a pedir la sesión al servidor (al ingresar, tras cambiar la contraseña o si cambiaron los permisos). */
export function useRecargarSesion() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['yo'] });
}

export function useSesion() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSesion fuera de ProveedorSesion');
  return s;
}
