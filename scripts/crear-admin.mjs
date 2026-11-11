#!/usr/bin/env node
/**
 * Crea (o restablece la contraseña de) un usuario administrador.
 *
 *   npm run crear-admin -- --usuario admin --nombre "Administrador" --sql
 *
 * Con --sql imprime la sentencia para pegarla en la consola de D1 (panel de Cloudflare → D1 → la base
 * → Console), después de abrir la app una vez (al arrancar se crean las tablas). Sin --sql la ejecuta
 * con wrangler en la base local de desarrollo (.wrangler).
 *
 * La contraseña se pide por teclado (o en la variable ADMIN_PASSWORD) y nunca se guarda en el repositorio.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { webcrypto as crypto } from 'node:crypto';

const args = process.argv.slice(2);
const arg = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const usuario = arg('usuario') ?? 'admin';
const nombre = arg('nombre') ?? 'Administrador';
const soloSql = args.includes('--sql');

if (!/^[a-zA-Z0-9._-]{3,60}$/.test(usuario)) {
  console.error('Usuario inválido: use 3-60 letras, números, punto, guion o guion bajo.');
  process.exit(1);
}

let password = process.env.ADMIN_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question('Contraseña (mínimo 8 caracteres): ');
  rl.close();
}
if (!password || password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}

const ITER = 100_000;
const sal = crypto.getRandomValues(new Uint8Array(16));
const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: ITER }, clave, 256);
const hash = `pbkdf2$${ITER}$${Buffer.from(sal).toString('base64')}$${Buffer.from(bits).toString('base64')}`;

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ahora = new Date().toISOString();
const sql = `INSERT INTO usuarios (usuario, nombre, hash_password, rol, activo, creado_en, actualizado_en)
VALUES (${q(usuario)}, ${q(nombre)}, ${q(hash)}, 'admin', 1, ${q(ahora)}, ${q(ahora)})
ON CONFLICT(usuario) DO UPDATE SET hash_password = excluded.hash_password, rol = 'admin', activo = 1, estado = 'activa', solicitud_pendiente = 0, debe_cambiar_password = 0, actualizado_en = excluded.actualizado_en;
DELETE FROM usuario_roles WHERE usuario_id = (SELECT id FROM usuarios WHERE usuario = ${q(usuario)});
INSERT INTO usuario_roles (usuario_id, rol_codigo) SELECT id, 'utcd_restauradores_administrador' FROM usuarios WHERE usuario = ${q(usuario)};`;

if (soloSql) {
  console.log('\n-- Pegue esto en la consola de D1 (contiene el hash, no la contraseña):\n');
  console.log(sql);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'crear-admin-'));
const archivo = join(dir, 'admin.sql');
writeFileSync(archivo, sql);
try {
  // En Windows npx es un .cmd y necesita ejecutarse a través del shell; la ruta va entre comillas por si tiene espacios.
  const windows = process.platform === 'win32';
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'restauradores-local', '--local', '--persist-to', '.wrangler/state', '--file', windows ? `"${archivo}"` : archivo], {
    stdio: 'inherit',
    shell: windows,
  });
  console.log(`\nAdministrador "${usuario}" listo (base local).`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
