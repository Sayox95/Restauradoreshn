/** Llamadas HTTP del módulo Catálogos (ruta base /api/v1/catalogos). Al migrar, los lee el servicio de Parámetros. */
import type { CampoTablero, CatalogosVisita, Marca, Material, Persona, Restaurador, TipoRestaurador } from '@shared/tipos';
import { get, patch, post, put } from '@/common/http/api';

const BASE = '/api/v1/catalogos';

/** Catálogos con alta y edición por registro (los tableros se guardan por marca). */
export interface Catalogos {
  restauradores: Restaurador;
  materiales: Material;
  personal: Persona;
  tipos: TipoRestaurador;
  marcas: Marca;
}
export type TipoCatalogo = keyof Catalogos;

export const listarCatalogo = <T extends TipoCatalogo>(tipo: T) => get<Catalogos[T][]>(`${BASE}/${tipo}`);
export const crearItemCatalogo = (tipo: TipoCatalogo, datos: unknown) => post(`${BASE}/${tipo}`, datos);
export const editarItemCatalogo = (tipo: TipoCatalogo, id: number, datos: unknown) => patch(`${BASE}/${tipo}/${id}`, datos);
export const listarTableros = () => get<CampoTablero[]>(`${BASE}/tableros`);
export const guardarTablero = (marca: string, campos: string[]) => put(`${BASE}/tableros`, { marca, campos });
export const guardarConfiguracion = (datos: { zona_horaria: string }) => put(`${BASE}/configuracion`, datos);
/** Lo que necesita el formulario de visita (solo activos). */
export const catalogosVisita = () => get<CatalogosVisita>(`${BASE}/visita`);
