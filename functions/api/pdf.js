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
    const { visitaNum, pdfBase64 } = body || {};

    if (!pdfBase64) {
      return json({ status: "ok", key: null });
    }

    const cleanBase64 = pdfBase64.includes(",")
      ? pdfBase64.split(",")[1]
      : pdfBase64;

    if (!cleanBase64) {
      return badRequest("pdfBase64 inválido");
    }

    const binary = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
    const key = `pdfs/${visitaNum || Date.now()}.pdf`;

    await env.PDF_BUCKET.put(key, binary, {
      httpMetadata: {
        contentType: "application/pdf",
      },
    });

    return json({ status: "ok", key });
  } catch (error) {
    return serverError(error);
  }
} 
