import { z } from 'zod';
import { CARGOS_PERSONAL, DOMINIO_CORREO, ELEMENTOS_MARCA, PATRON_USUARIO, ROLES, usuarioDeCorreo } from './constantes';

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const numeroOpcional = (min: number, max: number) =>
  z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: 'Número no válido' });
        return z.NEVER;
      }
      return n;
    });

export const loginEsquema = z.object({
  usuario: z.string().trim().min(1, 'Ingrese su usuario o correo').max(100),
  password: z.string().min(1, 'Ingrese su contraseña').max(200),
});

// ── Cuentas ──────────────────────────────────────────────────────────────────────────────────
/** Correo institucional del que sale el nombre de usuario (ver usuarioDeCorreo). */
const correoInstitucional = z
  .string()
  .trim()
  .toLowerCase()
  .max(100)
  .regex(new RegExp(`^[a-z0-9._%+-]+@${DOMINIO_CORREO.replace('.', '\\.')}$`), `Use su correo institucional @${DOMINIO_CORREO}`)
  .refine(
    (c) => PATRON_USUARIO.test(usuarioDeCorreo(c)),
    'El usuario (lo que va antes de la @, o después del «+») debe tener al menos 3 letras o números, sin otros símbolos que punto o guion.',
  );

const nombrePersona = z.string().trim().min(3, 'Escriba el nombre completo').max(100);
const telefono = z
  .string()
  .trim()
  .max(20)
  .refine((v) => !v || /^[0-9+()\-\s]{7,20}$/.test(v), 'Número de celular no válido')
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
/** Celular obligatorio: se pide al solicitar la cuenta y al crearla (después solo lo corrige un administrador). */
const telefonoObligatorio = z
  .string({ required_error: 'Ingrese su número de celular' })
  .trim()
  .min(1, 'Ingrese su número de celular')
  .regex(/^[0-9+()\-\s]{7,20}$/, 'Número de celular no válido');
/** Cargo de la cuenta: uno de CARGOS_PERSONAL (pasa tal cual al personal de la inspección). */
const cargo = z
  .union([z.enum(CARGOS_PERSONAL), z.literal(''), z.null()])
  .optional()
  .transform((v) => v || null);
const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200);

/** Alta desde Administración: la contraseña la genera el sistema (temporal, se cambia al ingresar). */
export const usuarioCrearEsquema = z.object({
  correo: correoInstitucional,
  nombre: nombrePersona,
  telefono: telefonoObligatorio,
  rol: z.enum(ROLES),
  cargo,
});

/** Datos de la cuenta que corrige un administrador (el estado y la contraseña tienen sus propias acciones). */
export const usuarioEditarEsquema = z.object({
  nombre: nombrePersona.optional(),
  correo: correoInstitucional.optional(),
  telefono,
  rol: z.enum(ROLES).optional(),
  cargo,
});

export const aprobarCuentaEsquema = z.object({
  rol: z.enum(ROLES, { errorMap: () => ({ message: 'Elija el rol para aprobar la cuenta.' }) }),
});

export const motivoEsquema = z.object({ motivo: textoOpcional(300) });

/** Solicitud de cuenta desde la pantalla de ingreso: solo correos del dominio institucional. */
export const registroEsquema = z.object({
  nombre: nombrePersona,
  correo: correoInstitucional,
  telefono: telefonoObligatorio,
  password,
});

export const cambiarPasswordEsquema = z
  .object({
    actual: z.string().min(1, 'Escriba su contraseña actual').max(200),
    nueva: password,
  })
  .refine((d) => d.actual !== d.nueva, { message: 'La nueva contraseña debe ser distinta de la actual.', path: ['nueva'] });

export const configuracionEsquema = z.object({
  zona_horaria: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat('es', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Zona horaria inválida'),
});

// ── Catálogos de la hoja de visita (se desactivan, no se borran) ────────────────────────────
const activo = z.boolean().optional();
const obligatorio = (nombre: string, max = 120) => z.string().trim().min(1, `Ingrese ${nombre}`).max(max);

export const restauradorEsquema = z.object({
  energis: obligatorio('el código Energis', 40),
  zona: textoOpcional(80),
  sector: textoOpcional(80),
  subestacion: textoOpcional(80),
  ubicacion: textoOpcional(200),
  circuito: textoOpcional(80),
  latitud: numeroOpcional(-90, 90),
  longitud: numeroOpcional(-180, 180),
  activo,
});

export const materialCatalogoEsquema = z.object({
  codigo: obligatorio('el código', 40),
  nombre: obligatorio('el nombre', 200),
  unidad: textoOpcional(20),
  stock: numeroOpcional(0, 1e9),
  activo,
});

export const tipoCatalogoEsquema = z.object({
  elemento: textoOpcional(60),
  tipo: obligatorio('el tipo', 60),
  activo,
});

export const marcaCatalogoEsquema = z.object({
  elemento: z.enum(ELEMENTOS_MARCA, { errorMap: () => ({ message: 'Elija el elemento' }) }),
  marca: obligatorio('la marca', 60),
  modelo: textoOpcional(60),
  tipo_control: textoOpcional(60),
  activo,
});

/** Tablero de una marca: la lista completa de sus campos en orden (reemplaza la anterior). */
export const tableroEsquema = z.object({
  marca: obligatorio('la marca', 60),
  campos: z.array(z.string().trim().min(1).max(80)).max(40),
});
