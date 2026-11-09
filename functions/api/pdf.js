import {
  json,
  badRequest,
  methodNotAllowed,
  serverError,
} from "../_lib/response.js";
import { cleanVisitaNum, pdfKeyFor, registroExiste } from "../_lib/visita.js";

// Límite del PDF en base64 (~15 MB de texto ≈ 11 MB de PDF)
const MAX_BASE64_LENGTH = 15 * 1024 * 1024;

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return methodNotAllowed("POST");
  }

  try {
    const { request, env } = context;
    const body = await request.json();
    const visitaNum = cleanVisitaNum(body?.visitaNum);
    const pdfBase64 = body?.pdfBase64;

    if (!visitaNum) {
      return badRequest("visitaNum es requerido");
    }
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return json({ status: "ok", key: null });
    }

    const cleanBase64 = pdfBase64.includes(",")
      ? pdfBase64.split(",")[1]
      : pdfBase64;

    if (!cleanBase64) {
      return badRequest("pdfBase64 inválido");
    }
    if (cleanBase64.length > MAX_BASE64_LENGTH) {
      return json({ status: "error", message: "PDF demasiado grande" }, 413);
    }

    // Solo se aceptan PDFs de visitas que ya existen en D1
    if (!(await registroExiste(env, visitaNum))) {
      return json(
        { status: "error", message: "La visita " + visitaNum + " no existe todavía" },
        404
      );
    }

    let binary;
    try {
      binary = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
    } catch {
      return badRequest("pdfBase64 inválido");
    }

    // Verificar firma de archivo PDF ("%PDF")
    if (
      binary.length < 4 ||
      binary[0] !== 0x25 || binary[1] !== 0x50 ||
      binary[2] !== 0x44 || binary[3] !== 0x46
    ) {
      return badRequest("El archivo no es un PDF válido");
    }

    const key = pdfKeyFor(visitaNum);
    await env.PDF_BUCKET.put(key, binary, {
      httpMetadata: { contentType: "application/pdf" },
    });

    return json({ status: "ok", key });
  } catch (error) {
    return serverError(error);
  }
}
