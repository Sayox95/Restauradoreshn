import { methodNotAllowed, serverError } from "../../_lib/response.js";

// GET /api/foto/{visitaNum}/{orden}.{ext} → foto original desde R2
export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed("GET");
  try {
    const { env, params } = context;
    const parts = [].concat(params.path || []);
    if (parts.length !== 2 || parts.some((p) => !/^[A-Za-z0-9_.-]+$/.test(p))) {
      return new Response("Not found", { status: 404 });
    }
    const obj = await env.PDF_BUCKET.get(`fotos/${parts.join("/")}`);
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
