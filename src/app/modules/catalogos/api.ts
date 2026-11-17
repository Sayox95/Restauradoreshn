/** Llamadas HTTP del módulo Catálogos (ruta base /api/v1/catalogos). Al migrar, los lee el servicio de Parámetros. */
import type {
  CampoTablero,
  Cargo,
  CatalogosVisita,
  Pagina,
  Marca,
  Material,
  Restaurador,
  TipoRestaurador,
} from '@shared/tipos';
import { get, patch, post, put } from '@common/http/api';
import { cabeceraIntento } from '@common/http/clave-intento';

const BASE = '/api/v1/catalogos';

/** Catálogos con alta y edición por registro (los tableros se guardan por marca). */
export interface Catalogos {
  restauradores: Restaurador;
  materiales: Material;
  tipos: TipoRestaurador;
  marcas: Marca;
  cargos: Cargo;
}
export type TipoCatalogo = keyof Catalogos;

export const listarCatalogo = <T extends TipoCatalogo>(tipo: T) =>
  get<Pagina<Catalogos[T]>>(`${BASE}/${tipo}`).then(p => p.data);
/** Alta de un registro de catálogo; `clave` evita crearlo dos veces (Idempotency-Key). */
export const crearItemCatalogo = (
  tipo: TipoCatalogo,
  datos: unknown,
  clave: string,
) => post(`${BASE}/${tipo}`, datos, cabeceraIntento(clave));
export const editarItemCatalogo = (
  tipo: TipoCatalogo,
  id: number,
  datos: unknown,
) => patch(`${BASE}/${tipo}/${id}`, datos);
export const listarTableros = () =>
  get<Pagina<CampoTablero>>(`${BASE}/tableros`).then(p => p.data);
export const guardarTablero = (marca: string, campos: string[]) =>
  put(`${BASE}/tableros`, { marca, campos });
export const guardarConfiguracion = (datos: { zona_horaria: string }) =>
  put(`${BASE}/configuracion`, datos);
/** Lo que necesita el formulario de visita (solo activos). */
export const catalogosVisita = () => get<CatalogosVisita>(`${BASE}/visita`);
