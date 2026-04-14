import {
  json,
  badRequest,
  methodNotAllowed,
  serverError,
} from "../_lib/response.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return methodNotAllowed("POST");
  }

  try {
    const { request, env } = context;
    const body = await request.json();
    const { visitaNum, firmaR2Key } = body || {};

    if (!visitaNum || !firmaR2Key) {
      return badRequest("visitaNum y firmaR2Key son requeridos");
    }

    const result = await env.DB.prepare(
      `UPDATE registros
       SET pdf_r2_key = ?
       WHERE visita_num = ?`
    )
      .bind(firmaR2Key, visitaNum)
      .run();

    return json({
      status: "ok",
      visitaNum,
      firmaR2Key,
      changes: result.meta?.changes || 0,
    });
  } catch (error) {
    return serverError(error);
  }
}
