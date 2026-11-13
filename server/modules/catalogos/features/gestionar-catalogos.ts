import type { z } from 'zod';
import { ELEMENTOS_MODEM } from '../../../../shared/constantes';
import { ROLES_SISTEMA, nivelDePerfil } from '../../../../shared/permisos';
import type { marcaCatalogoEsquema, materialCatalogoEsquema, restauradorEsquema, tableroEsquema, tipoCatalogoEsquema } from '../../../../shared/esquemas';
import type { CatalogosVisita } from '../../../../shared/tipos';
import { type Ctx, sentenciaAuditoria } from '../../../plumbing/contexto';
import { ApiError, noEncontrado } from '../../../plumbing/http';

/**
 * Catálogos de la hoja de visita. Las tablas vienen del sistema original, así que cada una declara
 * sus columnas y cómo guarda «activo» (restauradores usa estado 'ACTIVO'/'INACTIVO'). Nada se borra:
 * se desactiva (lineamientos UTCD).
 */
interface Definicion {
  tabla: string;
  columnas: string[];
  /** Expresión SQL que da 1/0 para «activo». */
  activoSql: string;
  /** Columna y valor que se guardan para activo/inactivo. */
  activoColumna: string;
  activoValor: (activo: boolean) => string | number;
  /** Columna con la fecha de actualización (si la tabla la tiene). */
  actualizado?: string;
  orden: string;
  /** Columnas que no pueden repetirse entre registros activos. */
  unico?: string[];
}

export const CATALOGOS = {
  restauradores: {
    tabla: 'restauradores',
    columnas: ['energis', 'zona', 'sector', 'subestacion', 'ubicacion', 'circuito', 'latitud', 'longitud'],
    activoSql: "CASE WHEN upper(COALESCE(estado, 'ACTIVO')) = 'ACTIVO' THEN 1 ELSE 0 END",
    activoColumna: 'estado',
    activoValor: (a) => (a ? 'ACTIVO' : 'INACTIVO'),
    actualizado: 'updated_at',
    orden: 'circuito, energis',
    unico: ['energis'],
  },
  materiales: {
    tabla: 'materiales',
    columnas: ['codigo', 'nombre', 'unidad', 'stock'],
    activoSql: 'COALESCE(activo, 1)',
    activoColumna: 'activo',
    activoValor: (a) => (a ? 1 : 0),
    actualizado: 'updated_at',
    orden: 'nombre',
    unico: ['codigo'],
  },
  tipos: {
    tabla: 'tipos',
    columnas: ['elemento', 'tipo'],
    activoSql: 'COALESCE(activo, 1)',
    activoColumna: 'activo',
    activoValor: (a) => (a ? 1 : 0),
    orden: 'tipo',
    unico: ['tipo'],
  },
  marcas: {
    tabla: 'marcas',
    columnas: ['elemento', 'marca', 'modelo', 'tipo_control'],
    activoSql: 'COALESCE(activo, 1)',
    activoColumna: 'activo',
    activoValor: (a) => (a ? 1 : 0),
    orden: 'elemento, marca, modelo',
  },
} satisfies Record<string, Definicion>;
export type Catalogo = keyof typeof CATALOGOS;

type Entrada =
  | z.output<typeof restauradorEsquema>
  | z.output<typeof materialCatalogoEsquema>
  | z.output<typeof tipoCatalogoEsquema>
  | z.output<typeof marcaCatalogoEsquema>;

const fila = (r: Record<string, unknown>) => ({ ...r, activo: !!r.activo });

/** Todos los registros del catálogo (activos e inactivos) para la pantalla de administración. */
export async function listarCatalogo(ctx: Ctx, cat: Catalogo) {
  const d: Definicion = CATALOGOS[cat];
  const { results } = await ctx.env.DB.prepare(`SELECT id, ${d.columnas.join(', ')}, ${d.activoSql} AS activo FROM ${d.tabla} ORDER BY ${d.orden}`).all<
    Record<string, unknown>
  >();
  return results.map(fila);
}

async function cargar(ctx: Ctx, d: Definicion, id: number) {
  const r = await ctx.env.DB.prepare(`SELECT id, ${d.columnas.join(', ')}, ${d.activoSql} AS activo FROM ${d.tabla} WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  if (!r) throw noEncontrado('El registro');
  return fila(r);
}

/** Crea (id = null) o actualiza un registro; desactivar es actualizar con activo = false. */
export async function guardarCatalogo(ctx: Ctx, cat: Catalogo, id: number | null, datos: Entrada) {
  const d: Definicion = CATALOGOS[cat];
  const valores = datos as Record<string, unknown>;
  const activo = (valores.activo as boolean | undefined) ?? true;
  const db = ctx.env.DB;

  for (const col of d.unico ?? []) {
    const otro = await db
      .prepare(`SELECT id FROM ${d.tabla} WHERE lower(${col}) = lower(?) AND id <> ? AND ${d.activoSql} = 1`)
      .bind(valores[col] ?? null, id ?? 0)
      .first();
    if (otro && activo) throw new ApiError(409, `Ya existe un registro activo con ese ${col === 'energis' ? 'código Energis' : col}.`);
  }

  const cols = [...d.columnas, d.activoColumna, ...(d.actualizado ? [d.actualizado] : [])];
  const binds = [...d.columnas.map((c) => valores[c] ?? null), d.activoValor(activo), ...(d.actualizado ? [ctx.ahora] : [])];

  if (id === null) {
    const r = await db
      .prepare(`INSERT INTO ${d.tabla} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(',')}) RETURNING id`)
      .bind(...binds)
      .first<{ id: number }>();
    const nuevo = r!.id;
    await sentenciaAuditoria(ctx.env, ctx.usuario.id, 'crear', cat, nuevo, null, valores, ctx.ahora).run();
    return cargar(ctx, d, nuevo);
  }
  const antes = await cargar(ctx, d, id);
  await db.batch([
    db.prepare(`UPDATE ${d.tabla} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).bind(...binds, id),
    sentenciaAuditoria(ctx.env, ctx.usuario.id, 'editar', cat, id, antes, valores, ctx.ahora),
  ]);
  return cargar(ctx, d, id);
}

/** Campos del tablero de control por marca (todos, con su estado activo). */
export async function listarTableros(ctx: Ctx) {
  const { results } = await ctx.env.DB.prepare(
    'SELECT id, marca, campo, COALESCE(orden, 99) AS orden, COALESCE(activo, 1) AS activo FROM tableros ORDER BY marca, orden, id',
  ).all<Record<string, unknown>>();
  return results.map(fila);
}

/**
 * Guarda el tablero de una marca con la lista de campos en orden: los que siguen se reactivan y
 * reordenan, los nuevos se agregan y los que ya no están se desactivan (no se borran).
 */
export async function guardarTablero(ctx: Ctx, d: z.output<typeof tableroEsquema>) {
  const db = ctx.env.DB;
  const existentes = (
    await db.prepare('SELECT id, campo, COALESCE(activo, 1) AS activo, orden FROM tableros WHERE lower(marca) = lower(?)').bind(d.marca).all<{
      id: number;
      campo: string;
      activo: number;
      orden: number;
    }>()
  ).results;
  const porCampo = new Map(existentes.map((e) => [e.campo.toLowerCase(), e]));
  const vistos = new Set<string>();
  const sentencias: D1PreparedStatement[] = [];
  d.campos.forEach((campo, i) => {
    const clave = campo.toLowerCase();
    if (vistos.has(clave)) throw new ApiError(422, `El campo «${campo}» está repetido.`);
    vistos.add(clave);
    const e = porCampo.get(clave);
    if (e) sentencias.push(db.prepare('UPDATE tableros SET campo = ?, orden = ?, activo = 1 WHERE id = ?').bind(campo, i + 1, e.id));
    else sentencias.push(db.prepare('INSERT INTO tableros (marca, campo, orden, activo) VALUES (?,?,?,1)').bind(d.marca, campo, i + 1));
  });
  for (const e of existentes)
    if (!vistos.has(e.campo.toLowerCase()) && e.activo) sentencias.push(db.prepare('UPDATE tableros SET activo = 0 WHERE id = ?').bind(e.id));
  sentencias.push(sentenciaAuditoria(ctx.env, ctx.usuario.id, 'editar', 'tableros', null, existentes, d, ctx.ahora));
  await db.batch(sentencias);
  return { marca: d.marca, campos: d.campos };
}

/**
 * Todo lo que necesita el formulario de visita, solo con registros activos. La app lo guarda en el
 * dispositivo para poder capturar sin conexión (excepción E1).
 */
export async function catalogosVisita(ctx: Ctx): Promise<CatalogosVisita> {
  const db = ctx.env.DB;
  const [rest, mats, pers, tipos, marcas, tableros] = await db.batch<Record<string, unknown>>([
    db.prepare(
      `SELECT id, energis, zona, sector, subestacion, ubicacion, circuito, latitud, longitud, 1 AS activo FROM restauradores
       WHERE ${CATALOGOS.restauradores.activoSql} = 1 ORDER BY circuito, energis`,
    ),
    db.prepare('SELECT id, codigo, nombre, unidad, stock, 1 AS activo FROM materiales WHERE COALESCE(activo, 1) = 1 ORDER BY nombre'),
    // Personal de la inspección: cuentas activas del mismo nivel que quien inspecciona o menor.
    db
      .prepare(
        `SELECT id, nombre, cargo FROM usuarios WHERE estado = 'activa'
         AND (CASE rol ${ROLES_SISTEMA.map(() => 'WHEN ? THEN ?').join(' ')} ELSE 0 END) <= ? ORDER BY nombre`,
      )
      .bind(...ROLES_SISTEMA.flatMap((x) => [x.perfil, x.nivel]), nivelDePerfil(ctx.usuario.rol)),
    db.prepare('SELECT DISTINCT tipo FROM tipos WHERE COALESCE(activo, 1) = 1 AND tipo IS NOT NULL ORDER BY tipo'),
    db.prepare('SELECT elemento, marca, modelo, tipo_control FROM marcas WHERE COALESCE(activo, 1) = 1 ORDER BY marca, modelo'),
    db.prepare('SELECT marca, campo FROM tableros WHERE COALESCE(activo, 1) = 1 ORDER BY marca, COALESCE(orden, 99), id'),
  ]);

  const restMap = new Map<string, { marca: string; modelos: string[]; controles: string[] }>();
  const modemMap = new Map<string, { marca: string; elemento: string; modelos: string[] }>();
  const agregar = (lista: string[], v: unknown) => {
    if (v && !lista.includes(String(v))) lista.push(String(v));
  };
  for (const m of marcas!.results) {
    const elemento = String(m.elemento ?? '').toUpperCase();
    const marca = String(m.marca ?? '');
    if (!marca) continue;
    if (elemento === 'RESTAURADOR') {
      const e = restMap.get(marca) ?? { marca, modelos: [], controles: [] };
      agregar(e.modelos, m.modelo);
      agregar(e.controles, m.tipo_control);
      restMap.set(marca, e);
    } else if ((ELEMENTOS_MODEM as readonly string[]).includes(elemento)) {
      const e = modemMap.get(marca) ?? { marca, elemento, modelos: [] };
      agregar(e.modelos, m.modelo);
      modemMap.set(marca, e);
    }
  }
  const tabMap = new Map<string, string[]>();
  for (const t of tableros!.results) {
    const marca = String(t.marca ?? '');
    if (!marca || !t.campo) continue;
    tabMap.set(marca, [...(tabMap.get(marca) ?? []), String(t.campo)]);
  }

  return {
    restauradores: rest!.results.map(fila) as unknown as CatalogosVisita['restauradores'],
    materiales: mats!.results.map(fila) as unknown as CatalogosVisita['materiales'],
    personal: pers!.results as unknown as CatalogosVisita['personal'],
    tipos: tipos!.results.map((t) => String(t.tipo)),
    marcas: [...restMap.values()],
    modems: [...modemMap.values()],
    tableros: [...tabMap.entries()].map(([marca, campos]) => ({ marca, campos })),
    actualizado_en: ctx.ahora,
  };
}
