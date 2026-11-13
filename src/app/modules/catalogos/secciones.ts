/** Los catálogos de la hoja de inspección y la configuración: título, descripción e ícono (única fuente). */
import { BriefcaseBusiness, Clock, Cpu, LayoutGrid, MapPin, Package, Tags } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const SECCIONES_CATALOGO = ['restauradores', 'materiales', 'tipos', 'marcas', 'tableros', 'cargos', 'zona'] as const;
export type SeccionCatalogo = (typeof SECCIONES_CATALOGO)[number];

export const SECCION: Record<SeccionCatalogo, { titulo: string; descripcion: string; icono: LucideIcon }> = {
  restauradores: { titulo: 'Restauradores', descripcion: 'Energis, circuito, ubicación y coordenadas', icono: MapPin },
  materiales: { titulo: 'Materiales', descripcion: 'Código, nombre y unidad', icono: Package },
  tipos: { titulo: 'Tipos de restaurador', descripcion: 'Tipos que se eligen en la hoja', icono: Tags },
  marcas: { titulo: 'Marcas y modelos', descripcion: 'Reconectadores, controles y módems', icono: Cpu },
  tableros: { titulo: 'Tableros de control', descripcion: 'Campos del tablero por marca', icono: LayoutGrid },
  cargos: { titulo: 'Cargos', descripcion: 'Cargos que se asignan a cada cuenta', icono: BriefcaseBusiness },
  zona: { titulo: 'Zona horaria', descripcion: 'Hora oficial de la app', icono: Clock },
};

export const esSeccionCatalogo = (v: string | undefined): v is SeccionCatalogo => SECCIONES_CATALOGO.includes(v as SeccionCatalogo);
