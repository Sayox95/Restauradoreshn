import type { EstadoVisita, Rol } from './constantes';
import type { Visita } from './visitas';

export interface UsuarioSesion {
  id: number;
  usuario: string;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  /** Ingresó con una contraseña temporal: debe cambiarla antes de usar la app. */
  debe_cambiar_password: boolean;
  /** Perfil: la plantilla de sus permisos; el acceso se decide solo por `permisos`. */
  rol: Rol;
  /** Cargo (uno de CARGOS_PERSONAL): pasa al personal de la inspección. */
  cargo: string | null;
  /** Códigos utcd_restauradores_<modulo>_<accion> (los de su rol o los suyos a la medida; como los claims del SSO). */
  permisos: string[];
}

export interface Respuesta<T> {
  datos: T;
  servidor_ahora: string;
}

// ── Catálogos de la hoja de visita ─────────────────────────────────────────────────────────
export interface Restaurador {
  id: number;
  energis: string;
  zona: string | null;
  sector: string | null;
  subestacion: string | null;
  ubicacion: string | null;
  circuito: string | null;
  latitud: number | null;
  longitud: number | null;
  activo: boolean;
}
export interface Material {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string | null;
  stock: number | null;
  activo: boolean;
}
/** Cuenta que se puede agregar al personal de una inspección (mismo nivel o menor). */
export interface Persona {
  id: number;
  nombre: string;
  cargo: string | null;
}
export interface TipoRestaurador {
  id: number;
  elemento: string | null;
  tipo: string;
  activo: boolean;
}
export interface Marca {
  id: number;
  elemento: string;
  marca: string;
  modelo: string | null;
  tipo_control: string | null;
  activo: boolean;
}
export interface CampoTablero {
  id: number;
  marca: string;
  campo: string;
  orden: number;
  activo: boolean;
}

/** Todo lo que necesita el formulario para llenarse (también se guarda para usarlo sin conexión). */
export interface CatalogosVisita {
  restauradores: Restaurador[];
  materiales: Material[];
  personal: Persona[];
  tipos: string[];
  /** Marcas de restaurador con sus modelos y controles. */
  marcas: { marca: string; modelos: string[]; controles: string[] }[];
  /** Marcas de módem con su elemento (tipo sugerido) y modelos. */
  modems: { marca: string; elemento: string; modelos: string[] }[];
  /** Campos del tablero de control por marca, en orden. */
  tableros: { marca: string; campos: string[] }[];
  actualizado_en: string;
}

// ── Visitas ────────────────────────────────────────────────────────────────────────────────
export interface FotoVisita {
  orden: number;
  observacion: string | null;
  content_type: string;
  size: number;
  /** Cambia al reemplazar la foto (para no mostrar la anterior desde la caché). */
  v: string;
}

export interface VisitaResumen {
  id: number;
  visita_num: string;
  fecha_visita: string | null;
  tipo_visita: string | null;
  codigo_energis: string | null;
  circuito: string | null;
  ubicacion: string | null;
  zona: string | null;
  marca_reconectador: string | null;
  estado: EstadoVisita;
  registrado_por: string | null;
  registrado_en: string | null;
  num_fotos: number;
  tiene_pdf: boolean;
}

export interface VisitaDetalle extends VisitaResumen {
  datos: Visita;
  fotos: FotoVisita[];
}
