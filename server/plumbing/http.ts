import { ZodError, type ZodTypeAny, type z } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    mensaje: string,
    public extra?: Record<string, unknown>,
  ) {
    super(mensaje);
  }
}

export const noAutenticado = () =>
  new ApiError(401, 'Su sesión expiró. Inicie sesión nuevamente.');
export const prohibido = () =>
  new ApiError(403, 'No tiene permiso para realizar esta acción.');
export const noEncontrado = (que = 'El registro') =>
  new ApiError(404, `${que} no existe o no tiene acceso.`);

export function json(
  datos: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

/** Un error en el contrato de TI (lineamientos §8): una lista de `{ message }`. */
export interface ErrorDeApi {
  message: string;
  /** Campo del formulario al que se refiere (errores de validación). */
  campo?: string;
}

/**
 * Respuesta de error con el contrato de TI: validación y reglas de negocio → 400 con
 * `[{ message }]`; los demás códigos (401, 403, 404, 409, 413, 415, 429…) se conservan.
 */
export function respuestaError(e: unknown): Response {
  if (e instanceof ApiError)
    return json(
      [{ message: e.message, ...e.extra }],
      e.status === 422 ? 400 : e.status,
    );
  if (e instanceof ZodError) {
    const errores: ErrorDeApi[] = e.issues.map(i => ({
      message: i.message,
      ...(i.path.length ? { campo: i.path.join('.') } : {}),
    }));
    return json(
      errores.length ? errores : [{ message: 'Datos inválidos' }],
      400,
    );
  }
  console.error(e);
  return json(
    [{ message: 'Ocurrió un error inesperado. Intente nuevamente.' }],
    500,
  );
}

export async function leerJson<S extends ZodTypeAny>(
  req: Request,
  esquema: S,
): Promise<z.output<S>> {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    throw new ApiError(400, 'El cuerpo de la solicitud no es JSON válido.');
  }
  return esquema.parse(cuerpo);
}

/** Página pedida (`page`, `pageSize`, como en TI); 25 por defecto, 100 como máximo. */
export function paginacion(url: URL, porDefecto = 25) {
  const pagina = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const porPagina = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('pageSize')) || porDefecto),
  );
  return { pagina, porPagina, offset: (pagina - 1) * porPagina };
}

/** Lista con la forma paginada de TI (lineamientos §8). */
export interface Pagina<T> {
  data: T[];
  currentPage: number;
  lastPage: number;
  pageSize: number;
  total: number;
}
export const pagina = <T>(
  data: T[],
  total: number,
  actual: number,
  porPagina: number,
): Pagina<T> => ({
  data,
  currentPage: actual,
  lastPage: Math.max(1, Math.ceil(total / porPagina)),
  pageSize: porPagina,
  total,
});
/** Lista completa (catálogos, cuentas) en la misma forma: una sola página con todo. */
export const listaCompleta = <T>(data: T[]): Pagina<T> =>
  pagina(data, data.length, 1, Math.max(1, data.length));

export function idParam(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0)
    throw new ApiError(400, 'Identificador inválido.');
  return n;
}

export function esErrorUnico(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}
