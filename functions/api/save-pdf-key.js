import {
  json,
  badRequest,
  methodNotAllowed,
  serverError,
} from "../_lib/response.js";
import { cleanVisitaNum, pdfKeyFor } from "../_lib/visita.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return methodNotAllowed("POST");
  }

  try {
    const { request, env } = context;
    const body = await request.json();
    const visitaNum = cleanVisitaNum(body?.visitaNum);
    const pdfR2Key = body?.pdfR2Key;

    if (!visitaNum || !pdfR2Key) {
      return badRequest("visitaNum y pdfR2Key son requeridos");
    }

    // La clave debe corresponder exactamente a la visita (evita asociar
    // el PDF de otra visita o una clave arbitraria)
    if (pdfR2Key !== pdfKeyFor(visitaNum)) {
      return badRequest("pdfR2Key no corresponde a la visita");
    }

    const result = await env.DB.prepare(
      `UPDATE registros
       SET pdf_r2_key = ?
       WHERE visita_num = ?`
    )
      .bind(pdfR2Key, visitaNum)
      .run();

    return json({
      status: "ok",
      visitaNum,
      pdfR2Key,
      changes: result.meta?.changes || 0,
    });
  } catch (error) {
    return serverError(error);
  }
}
