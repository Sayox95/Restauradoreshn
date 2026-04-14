import { methodNotAllowed, serverError } from "../../_lib/response.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return methodNotAllowed("GET");
  }

  try {
    const { env, params } = context;
    const key = `pdfs/${params.key}`;

    const obj = await env.PDF_BUCKET.get(key);
    if (!obj) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(obj.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
