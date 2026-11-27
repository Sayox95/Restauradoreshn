/**
 * Acceso a datos del módulo de inspecciones (lineamientos §11: TanStack Query solo en los hooks; las
 * páginas no lo llaman directo).
 */
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { VisitaDetalle } from '@shared/tipos';
import {
  type EdicionEntrada,
  type Filtros,
  editarVisita,
  eliminarVisita,
  historialVisita,
  listarVisitas,
  misVisitas,
  verVisita,
} from '../api';

/** Una página de inspecciones: las de todos (con Consultar) o las propias. Conserva la anterior mientras carga. */
export const useInspecciones = (filtros: Filtros, todas: boolean) =>
  useQuery({
    queryKey: ['visitas', todas ? 'todas' : 'mias', filtros],
    queryFn: () => (todas ? listarVisitas(filtros) : misVisitas(filtros)),
    placeholderData: keepPreviousData,
  });

/** Detalle de una inspección. */
export const useInspeccion = (id: number) =>
  useQuery({
    queryKey: ['visita', id],
    queryFn: () => verVisita(id),
    enabled: Number.isInteger(id),
  });

/** Elimina (oculta) una inspección y deja las listas al día. */
export function useEliminarInspeccion() {
  const qc = useQueryClient();
  return async (id: number, motivo: string) => {
    await eliminarVisita(id, motivo);
    qc.removeQueries({ queryKey: ['visita', id] });
    await qc.invalidateQueries({ queryKey: ['visitas'] });
  };
}

/** Guarda una edición: el detalle queda con lo nuevo y las listas y el historial se refrescan. */
export function useEditarInspeccion() {
  const qc = useQueryClient();
  return async (id: number, e: EdicionEntrada, clave: string) => {
    const d: VisitaDetalle = await editarVisita(id, e, clave);
    qc.setQueryData(['visita', id], d);
    await qc.invalidateQueries({ queryKey: ['visitas'] });
    await qc.invalidateQueries({ queryKey: ['visita-historial', id] });
    return d;
  };
}

/** Historial de ediciones (solo se pide con el permiso Editar y al abrirlo). */
export const useHistorialInspeccion = (id: number, activo: boolean) =>
  useQuery({
    queryKey: ['visita-historial', id],
    queryFn: () => historialVisita(id),
    enabled: activo && Number.isInteger(id),
  });
