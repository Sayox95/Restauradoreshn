/** Rutas de pantalla del módulo Catálogos. */
import type { SeccionCatalogo } from './secciones';

/** Lista de catálogos (se entra desde Administración). */
export const urlCatalogos = '/admin/catalogos';
/** Un catálogo: ahí se crea y edita. */
export const urlCatalogo = (clave: SeccionCatalogo) => `/admin/catalogos/${clave}`;
