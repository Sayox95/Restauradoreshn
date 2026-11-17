import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENTOS } from '../server/plumbing/eventos';
import { visitaCompleta } from './datos';
import { crearEntorno } from './entorno';

/** Archivos .ts del servidor. */
const archivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const ruta = join(dir, f);
    return statSync(ruta).isDirectory() ? archivos(ruta) : ruta.endsWith('.ts') ? [ruta] : [];
  });

describe('auditoría con nombre de evento (lineamientos §7)', () => {
  it('cada acción que el código audita tiene su nombre de evento', () => {
    const faltan: string[] = [];
    for (const f of archivos(join(import.meta.dirname, '..', 'server'))) {
      const texto = readFileSync(f, 'utf8');
      for (const m of texto.matchAll(/sentenciaAuditoria\([^,]+,[^,]+,\s*'([a-z_]+)',\s*'([a-z_]+)'/g))
        if (!EVENTOS[`${m[2]}.${m[1]}`]) faltan.push(`${m[2]}.${m[1]} (${f})`);
    }
    // Acciones que llegan por variable: cambios de estado de cuenta y catálogos.
    for (const a of ['aprobar', 'rechazar', 'desactivar', 'activar']) if (!EVENTOS[`usuario.${a}`]) faltan.push(`usuario.${a}`);
    for (const c of ['restauradores', 'materiales', 'tipos', 'marcas', 'cargos'])
      for (const a of ['crear', 'editar']) if (!EVENTOS[`${c}.${a}`]) faltan.push(`${c}.${a}`);
    expect(faltan).toEqual([]);
  });

  it('las escrituras guardan el evento en la misma fila de auditoría', async () => {
    const t = await crearEntorno();
    const tec = await t.crearUsuario('beto', 'tecnico');
    await t.pedir('POST', '/api/v1/visitas', { cookie: tec.cookie, cuerpo: visitaCompleta() });
    const filas = (await t.DB.prepare('SELECT accion, evento FROM auditoria').all()).results;
    expect(filas).toContainEqual({ accion: 'registrar', evento: 'InspeccionRegistrada' });
  });
});
