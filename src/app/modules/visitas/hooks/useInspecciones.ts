/**
 * Acceso a datos del módulo de inspecciones (lineamientos §11: TanStack Query solo en los hooks; las
 * páginas no lo llaman directo).
 */
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Filtros, eliminarVisita, listarVisitas, misVisitas, verVisita } from '../api';

/** Una página de inspecciones: las de todos (con Consultar) o las propias. Conserva la anterior mientras carga. */
export const useInspecciones = (filtros: Filtros, todas: boolean) =>
  useQuery({
    queryKey: ['visitas', todas ? 'todas' : 'mias', filtros],
    queryFn: () => (todas ? listarVisitas(filtros) : misVisitas(filtros)),
    placeholderData: keepPreviousData,
  });

/** Detalle de una inspección. */
export const useInspeccion = (id: number) => useQuery({ queryKey: ['visita', id], queryFn: () => verVisita(id), enabled: Number.isInteger(id) });

/** Elimina (oculta) una inspección y deja las listas al día. */
export function useEliminarInspeccion() {
  const qc = useQueryClient();
  return async (id: number, motivo: string) => {
    await eliminarVisita(id, motivo);
    qc.removeQueries({ queryKey: ['visita', id] });
    await qc.invalidateQueries({ queryKey: ['visitas'] });
  };
}
