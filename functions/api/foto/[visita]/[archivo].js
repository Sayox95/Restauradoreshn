import { methodNotAllowed, serverError } from "../../../_lib/response.js";

// GET /api/foto/{visitaNum}/{orden}.{ext} → foto original desde R2
// (Ruta con dos segmentos fijos: NO coincide con POST /api/foto, que
//  atiende functions/api/foto.js. Un catch-all [[path]] sí coincidía.)
export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed("GET");
  try {
    const { env, params } = context;
    const visita = String(params.visita || "");
    const archivo = String(params.archivo || "");
    if (!/^[A-Za-z0-9_-]+$/.test(visita) || !/^[1-4]\.[a-z]{3,4}$/.test(archivo)) {
      return new Response("Not found", { status: 404 });
    }
    const obj = await env.PDF_BUCKET.get(`fotos/${visita}/${archivo}`);
    if (!obj) return new Response("Not found", { status: 404 });

    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
