/** Perfiles de usuario (cada uno corresponde a un rol en ROLES_SISTEMA, la plantilla de sus permisos). */
export const ROLES = ['admin', 'supervisor', 'tecnico'] as const;
export type Rol = (typeof ROLES)[number];

export const ROL_ETIQUETA: Record<Rol, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  tecnico: 'Técnico',
};

/**
 * Estados de una visita. Por ahora el proceso solo tiene «registrada» (acordado con el dueño del
 * proyecto); otros estados se definen con el área usuaria antes de agregarlos.
 */
export const ESTADOS_VISITA = ['registrada'] as const;
export type EstadoVisita = (typeof ESTADOS_VISITA)[number];
export const ESTADO_VISITA_ETIQUETA: Record<EstadoVisita, string> = { registrada: 'Registrada' };

/** Solo se pueden crear cuentas con correo de este dominio. */
export const DOMINIO_CORREO = 'eneeutcd.hn';

export const ZONA_HORARIA_DEFECTO = 'America/Tegucigalpa';

/** Estados de una cuenta de usuario. */
export const ESTADOS_CUENTA = ['pendiente', 'activa', 'inactiva', 'rechazada'] as const;
export type EstadoCuenta = (typeof ESTADOS_CUENTA)[number];
export const ESTADO_CUENTA_ETIQUETA: Record<EstadoCuenta, string> = {
  pendiente: 'Pendiente',
  activa: 'Activa',
  inactiva: 'Inactiva',
  rechazada: 'Rechazada',
};

/** Formato del nombre de usuario: minúsculas, números, punto, guion y guion bajo. */
export const PATRON_USUARIO = /^[a-z0-9._-]{3,60}$/;

/**
 * El nombre de usuario sale del correo institucional: lo que va antes de la @, o lo que va después
 * del «+» si el correo es una variante (said.calderon+tecnico1@… → tecnico1).
 */
export function usuarioDeCorreo(correo: string): string {
  const local = correo.trim().toLowerCase().split('@')[0] ?? '';
  const mas = local.indexOf('+');
  return mas >= 0 ? local.slice(mas + 1) : local;
}

// ── Fotos (excepción E2: resolución original) ─────────────────────────────────────────────
export const MAX_FOTOS = 4;
export const MAX_FOTO_BYTES = 25 * 1024 * 1024;
export const MIMES_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
export type MimeFoto = (typeof MIMES_FOTO)[number];
export const EXTENSION_FOTO: Record<MimeFoto, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** PDF de la ficha (excepción E3). */
export const MAX_PDF_BYTES = 15 * 1024 * 1024;

// ── Opciones del formulario (tomadas de la hoja de visita en uso) ─────────────────────────
export const TIPOS_VISITA = ['Visita 1', 'Visita 2', 'Visita 3'] as const;
export const MEDIOS_EXTINCION = ['Vacío', 'Aceite (VWE)', 'SF6'] as const;
export const TIPOS_MODEM = ['Modem Datos', 'Modem Telemetria', 'Radio Modem'] as const;
export const ANTENAS = ['INTERNA', 'EXTERNA'] as const;
export const TIPOS_ANTENA = ['Cónica', 'Imantada', 'Yagi'] as const;
export const TECNOLOGIAS_MODEM = ['2G', '3G', 'LTE'] as const;
export const TIPOS_BATERIA = ['12V/ 12AH', '12V/ 17AH', '12V/ 26AH'] as const;
export const TIPOS_CUCHILLA = ['Cortacircuito Rompearco', 'Cortacircuito Sencillo', 'Cuchilla Monopolar', 'Cuchilla Tripolar'] as const;
export const FASES_CONEXION = ['Fase A', 'Fase B', 'Fase C', 'Trifásica'] as const;
export const CARGOS_PERSONAL = ['Técnico SCADA', 'Ingeniero de Campo', 'Jefe de Cuadrilla', 'Supervisor', 'Auxiliar Técnico', 'Contratista'] as const;
export const MOTIVOS_MATERIAL = ['Reemplazo preventivo', 'Falla / Daño', 'Instalación nueva', 'Actualización', 'Otro'] as const;

/** Elementos de la tabla «marcas» que son módems (los demás son restauradores). */
export const ELEMENTOS_MODEM = ['MODEM DATOS', 'MODEM TELEMETRIA', 'RADIO MODEM'] as const;
export const ELEMENTOS_MARCA = ['RESTAURADOR', ...ELEMENTOS_MODEM] as const;

/** Respuestas de los botones de dos opciones. */
export const SI_NO = ['SI', 'NO'] as const;
export const OK_NOK = ['OK', 'NOK'] as const;
export const ON_OFF = ['ON', 'OFF'] as const;
export const GRUPOS_AJUSTE = ['G1', 'G2', 'G3'] as const;

/** Rango de coordenadas válido para Honduras (detecta latitud y longitud intercambiadas). */
export const RANGO_LATITUD = [12, 17] as const;
export const RANGO_LONGITUD = [-90, -83] as const;
