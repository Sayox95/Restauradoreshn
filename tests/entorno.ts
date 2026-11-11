/**
 * Entorno de pruebas: D1 y R2 simulados sobre node:sqlite y memoria,
 * aplicando las mismas migraciones SQL que producción.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../server/plumbing/sesion';
import { reiniciarEsquemaParaPruebas } from '../server/plumbing/esquema';
import { rolDePerfil } from '../shared/permisos';
import { manejarApi } from '../server/app';
import type { Env } from '../server/plumbing/contexto';

type Valor = string | number | null | bigint | Uint8Array;

function normalizar(v: unknown): Valor {
  if (v === undefined) throw new Error('D1_TYPE_ERROR: undefined no es un valor válido');
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v as Valor;
}

class Sentencia {
  constructor(
    private db: DatabaseSync,
    readonly sql: string,
    readonly params: Valor[] = [],
  ) {}
  bind(...p: unknown[]) {
    return new Sentencia(this.db, this.sql, p.map(normalizar));
  }
  ejecutar() {
    const consulta = this.db.prepare(this.sql);
    // D1 rechaza resultados de más de 100 columnas («too many columns in result set»); SQLite local no.
    const columnas = consulta.columns().length;
    if (columnas > 100) throw new Error(`D1_ERROR: too many columns in result set (${columnas})`);
    const filas = consulta.all(...this.params) as Record<string, unknown>[];
    const changes = Number((this.db.prepare('SELECT changes() AS c').get() as { c: number }).c);
    return { results: filas, success: true, meta: { changes } };
  }
  async all() {
    return this.ejecutar();
  }
  async run() {
    return this.ejecutar();
  }
  async first(col?: string) {
    const f = this.ejecutar().results[0] ?? null;
    return f && col ? (f[col] ?? null) : f;
  }
}

export function crearD1(hastaMigracion = Infinity): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const dir = join(import.meta.dirname, '..', 'migrations');
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith('.sql'))
    .sort()
    .filter((x) => Number(x.slice(0, 4)) <= hastaMigracion))
    db.exec(readFileSync(join(dir, f), 'utf8'));
  const d1 = {
    prepare: (sql: string) => new Sentencia(db, sql),
    async batch(sentencias: Sentencia[]) {
      db.exec('BEGIN');
      try {
        const res = sentencias.map((s) => s.ejecutar());
        db.exec('COMMIT');
        return res;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
    },
  };
  return d1 as unknown as D1Database;
}

export function crearR2() {
  const objetos = new Map<string, { datos: Uint8Array; tipo?: string }>();
  const r2 = {
    objetos,
    async put(clave: string, datos: Uint8Array, opts?: { httpMetadata?: { contentType?: string } }) {
      objetos.set(clave, { datos: new Uint8Array(datos), tipo: opts?.httpMetadata?.contentType });
      return {};
    },
    async get(clave: string) {
      const o = objetos.get(clave);
      if (!o) return null;
      return { body: new Blob([o.datos]).stream(), httpMetadata: { contentType: o.tipo } };
    },
    async delete(clave: string) {
      objetos.delete(clave);
    },
  };
  return r2;
}

const ORIGEN = 'https://restauradores.test';

export async function crearEntorno(hastaMigracion = Infinity) {
  reiniciarEsquemaParaPruebas();
  const DB = crearD1(hastaMigracion);
  const ARCHIVOS = crearR2();
  const env = { DB, ARCHIVOS } as unknown as Env;
  const reloj = { ahora: '2026-10-01T12:00:00.000Z' };

  const avanzar = (ms: number) => {
    reloj.ahora = new Date(Date.parse(reloj.ahora) + ms).toISOString();
  };

  async function pedir(
    metodo: string,
    camino: string,
    opciones: { cuerpo?: unknown; cookie?: string; headers?: Record<string, string>; binario?: Uint8Array } = {},
  ) {
    const headers: Record<string, string> = { Origin: ORIGEN, ...opciones.headers };
    if (opciones.cookie) headers.Cookie = opciones.cookie;
    let body: BodyInit | undefined;
    if (opciones.binario) body = opciones.binario;
    else if (opciones.cuerpo !== undefined) {
      body = JSON.stringify(opciones.cuerpo);
      headers['Content-Type'] = 'application/json';
    }
    const res = await manejarApi(new Request(ORIGEN + camino, { method: metodo, headers, body }), env, reloj.ahora);
    const tipo = res.headers.get('Content-Type') ?? '';
    const datos = tipo.includes('json') ? ((await res.json()) as any) : await res.text();
    return { status: res.status, datos, headers: res.headers };
  }

  async function crearUsuario(usuario: string, rol: 'admin' | 'supervisor' | 'tecnico') {
    const r = await DB.prepare(`INSERT INTO usuarios (usuario, nombre, hash_password, rol, creado_en, actualizado_en) VALUES (?,?,?,?,?,?) RETURNING id`)
      .bind(usuario, `Nombre ${usuario}`, await hashPassword('clave-segura-1'), rol, reloj.ahora, reloj.ahora)
      .first<{ id: number }>();
    const login = await pedir('POST', '/api/v1/sesion/login', { cuerpo: { usuario, password: 'clave-segura-1' } });
    const cookie = login.headers.get('Set-Cookie')!.split(';')[0]!;
    // Como el alta desde Administración: el perfil define el rol del sistema (los roles ya están sembrados tras el primer ingreso).
    await DB.prepare('INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_codigo) VALUES (?,?)').bind(r!.id, rolDePerfil(rol)).run();
    return { id: r!.id, cookie };
  }

  return { env, DB, ARCHIVOS, reloj, avanzar, pedir, crearUsuario };
}

export const HORA = 3600_000;
export const DIA = 24 * HORA;
