/** Normaliza el número de visita y lo convierte en un nombre de archivo seguro para R2. */
export function cleanVisitaNum(value) {
  return String(value ?? "").trim();
}

/** Nombre seguro para usar en claves de R2 */
export function safeName(visitaNum) {
  return cleanVisitaNum(visitaNum).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
}

export function pdfKeyFor(visitaNum) {
  return `pdfs/${safeName(visitaNum)}.pdf`;
}

export async function registroExiste(env, visitaNum) {
  const row = await env.DB.prepare(
    `SELECT id FROM registros WHERE visita_num = ? LIMIT 1`
  )
    .bind(visitaNum)
    .first();
  return row ? row.id : null;
}
