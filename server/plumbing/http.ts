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

export const noAutenticado = () => new ApiError(401, 'Su sesión expiró. Inicie sesión nuevamente.');
export const prohibido = () => new ApiError(403, 'No tiene permiso para realizar esta acción.');
export const noEncontrado = (que = 'El registro') => new ApiError(404, `${que} no existe o no tiene acceso.`);

export function json(datos: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function respuestaError(e: unknown): Response {
  if (e instanceof ApiError) return json({ error: e.message, ...e.extra }, e.status);
  if (e instanceof ZodError) {
    const issue = e.issues[0];
    return json(
      {
        error: issue?.message ?? 'Datos inválidos',
        campo: issue?.path.join('.'),
      },
      422,
    );
  }
  console.error(e);
  return json({ error: 'Ocurrió un error inesperado. Intente nuevamente.' }, 500);
}

export async function leerJson<S extends ZodTypeAny>(req: Request, esquema: S): Promise<z.output<S>> {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    throw new ApiError(400, 'El cuerpo de la solicitud no es JSON válido.');
  }
  return esquema.parse(cuerpo);
}

export function paginacion(url: URL, porDefecto = 25) {
  const pagina = Math.max(1, Number(url.searchParams.get('pagina')) || 1);
  const porPagina = Math.min(100, Math.max(1, Number(url.searchParams.get('por_pagina')) || porDefecto));
  return { pagina, porPagina, offset: (pagina - 1) * porPagina };
}

export function idParam(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, 'Identificador inválido.');
  return n;
}

export function esErrorUnico(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}
