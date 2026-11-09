/**
 * Build para Cloudflare Pages (sin dependencias).
 *
 *   Build command:          node build.mjs
 *   Build output directory: dist
 *
 * Copia solo los archivos públicos de la app a dist/ y escribe un BUILD_ID
 * único (commit + fecha) en sw.js e index.html. Como sw.js cambia en cada
 * deploy, todos los dispositivos detectan la actualización automáticamente.
 * Las Functions (/functions) las publica Cloudflare aparte, no van en dist/.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const PUBLICOS = [
  "index.html",
  "sw.js",
  "idb.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "logo.png",
];

const sha = (process.env.CF_PAGES_COMMIT_SHA || "local").slice(0, 7);
const fecha = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12); // AAAAMMDDhhmm
const BUILD_ID = `${sha}-${fecha}`;

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const f of PUBLICOS) cpSync(f, `dist/${f}`);

const PATRON = /const BUILD_ID\s*=\s*'[^']*';/;
for (const f of ["sw.js", "index.html"]) {
  const src = readFileSync(`dist/${f}`, "utf8");
  if (!PATRON.test(src)) {
    console.error(`✗ No se encontró "const BUILD_ID = '...';" en ${f}`);
    process.exit(1);
  }
  writeFileSync(`dist/${f}`, src.replace(PATRON, `const BUILD_ID = '${BUILD_ID}';`));
}

console.log(`✓ Build ${BUILD_ID} → dist/ (${PUBLICOS.length} archivos)`);
