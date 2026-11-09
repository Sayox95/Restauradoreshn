/** Normaliza el número de visita y lo convierte en un nombre de archivo seguro para R2. */
export function cleanVisitaNum(value) {
  return String(value ?? "").trim();
}

export function pdfKeyFor(visitaNum) {
  const safe = cleanVisitaNum(visitaNum)
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 80);
  return `pdfs/${safe}.pdf`;
}

export async function registroExiste(env, visitaNum) {
  const row = await env.DB.prepare(
    `SELECT id FROM registros WHERE visita_num = ? LIMIT 1`
  )
    .bind(visitaNum)
    .first();
  return row ? row.id : null;
}
