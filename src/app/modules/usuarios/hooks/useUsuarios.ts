/**
 * Acceso a datos del módulo Usuarios (lineamientos §11: TanStack Query vive solo en los hooks; las
 * páginas no lo llaman directo). Al migrar a TI solo cambian estos hooks.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listarCargos, listarUsuarios, verUsuario } from '../api';

/** Todas las cuentas (solicitudes, activas e inactivas). */
export const useUsuarios = (habilitado = true) =>
  useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
    enabled: habilitado,
  });

/** Ficha de una cuenta con su historial. */
export const useUsuario = (id: number) =>
  useQuery({ queryKey: ['usuario', id], queryFn: () => verUsuario(id) });

/** Cargos activos del catálogo para elegir en la cuenta. */
export const useCargos = () =>
  useQuery({ queryKey: ['usuarios', 'cargos'], queryFn: listarCargos });

/** Vuelve a pedir la lista de cuentas y, si se indica, la ficha de una (después de un cambio). */
export function useRecargarUsuarios() {
  const qc = useQueryClient();
  return (id?: number) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['usuarios'] }),
      id !== undefined
        ? qc.invalidateQueries({ queryKey: ['usuario', id] })
        : null,
    ]);
}
