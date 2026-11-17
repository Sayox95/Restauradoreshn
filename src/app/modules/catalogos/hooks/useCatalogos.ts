/**
 * Acceso a datos del módulo Catálogos (lineamientos §11: TanStack Query solo en los hooks).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Catalogos,
  type TipoCatalogo,
  listarCatalogo,
  listarTableros,
} from '../api';

/** Todos los registros de un catálogo (activos e inactivos), para su pantalla de administración. */
export const useCatalogo = <T extends TipoCatalogo>(tipo: T) =>
  useQuery({
    queryKey: ['catalogo', tipo],
    queryFn: () => listarCatalogo(tipo) as Promise<Catalogos[T][]>,
  });

/** Campos del tablero de control de cada marca. */
export const useTableros = () =>
  useQuery({ queryKey: ['tableros'], queryFn: listarTableros });

/** Vuelve a pedir un catálogo, los tableros o, sin indicar nada, todos los datos (p. ej. zona horaria). */
export function useRecargarCatalogos() {
  const qc = useQueryClient();
  return (que?: TipoCatalogo | 'tableros') =>
    que === undefined
      ? qc.invalidateQueries()
      : qc.invalidateQueries({
          queryKey: que === 'tableros' ? ['tableros'] : ['catalogo', que],
        });
}
