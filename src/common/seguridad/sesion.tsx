import type { UsuarioSesion } from '@shared/tipos';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorApi, configurarExpiracion } from '@/common/http/api';
import { fijarZona } from '@/common/utils/fechas';
import { cerrarSesion, quienSoy } from '@/common/seguridad/api';

interface Sesion {
  usuario: UsuarioSesion | null;
  cargando: boolean;
  salir: (todas?: boolean) => Promise<void>;
}

// Avisa a las demás pestañas abiertas de la app que la sesión se cerró (o se abrió otra).
const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sesion') : null;

const Ctx = createContext<Sesion | null>(null);

/**
 * Excepción E1 (captura sin conexión): la última sesión confirmada por el servidor se recuerda en el
 * teléfono para poder abrir la app y capturar sin señal. No guarda ningún token (la cookie es HttpOnly);
 * el servidor valida la sesión y los permisos al enviar.
 */
const CLAVE_SESION = 'sesion-recordada';
type Yo = Awaited<ReturnType<typeof quienSoy>>;
function recordar(yo: Yo) {
  try {
    if (yo) localStorage.setItem(CLAVE_SESION, JSON.stringify(yo));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    /* almacenamiento no disponible */
  }
}
function recordada(): Yo {
  try {
    const v = localStorage.getItem(CLAVE_SESION);
    return v ? (JSON.parse(v) as Yo) : null;
  } catch {
    return null;
  }
}
async function consultarSesion(): Promise<Yo> {
  try {
    const yo = await quienSoy();
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
  const { data, isLoading } = useQuery({
    queryKey: ['yo'],
    queryFn: consultarSesion,
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (data?.zona_horaria) fijarZona(data.zona_horaria);

  // Deja la app «sin sesión»: primero se marca sin usuario (la pantalla pasa al ingreso) y luego se
  // descartan los datos en memoria. No se usa qc.clear(): desconecta la pantalla de la consulta de
  // sesión y no se actualizaría.
  const limpiar = useCallback(() => {
    recordar(null);
    qc.setQueryData(['yo'], null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'yo' });
    navegar('/', { replace: true });
  }, [qc, navegar]);

  useEffect(() => {
    configurarExpiracion(limpiar);
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

  const usuario = data?.usuario ?? null;
  const valor: Sesion = {
    usuario,
    cargando: isLoading,
    salir: async (todas = false) => {
      await cerrarSesion(todas).catch(() => {});
      try {
        sessionStorage.clear();
      } catch {
        /* almacenamiento no disponible */
      }
      limpiar();
      canal?.postMessage('salir');
    },
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSesion() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSesion fuera de ProveedorSesion');
  return s;
}
