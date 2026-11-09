import { json, badRequest, methodNotAllowed, serverError } from "../_lib/response.js";
import { cleanVisitaNum, registroExiste, safeName } from "../_lib/visita.js";

// Tamaño máximo por foto original (sin comprimir)
const MAX_BYTES = 25 * 1024 * 1024;

const EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/**
 * POST /api/foto?visitaNum=HV-...&orden=1&obs=texto
 * Body: archivo de imagen ORIGINAL (binario, sin comprimir).
 * Guarda en R2: fotos/{visitaNum}/{orden}.{ext} y registra en registros_fotos.
 * Reenviar la misma foto (mismo orden) la reemplaza: es idempotente.
 */
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return methodNotAllowed("POST");

  try {
    const url = new URL(request.url);
    const visitaNum = cleanVisitaNum(url.searchParams.get("visitaNum"));
    const orden = parseInt(url.searchParams.get("orden"), 10);
    const observacion = (url.searchParams.get("obs") || "").slice(0, 500);
    const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();

    if (!visitaNum) return badRequest("visitaNum es requerido");
    if (!(orden >= 1 && orden <= 4)) return badRequest("orden debe estar entre 1 y 4");
    if (!contentType.startsWith("image/")) return badRequest("El archivo debe ser una imagen");

    const declared = parseInt(request.headers.get("Content-Length") || "0", 10);
    if (declared > MAX_BYTES) {
      return json({ status: "error", message: "La foto supera 25 MB" }, 413);
    }

    if (!(await registroExiste(env, visitaNum))) {
      return json({ status: "error", message: "La visita " + visitaNum + " no existe todavía" }, 404);
    }

    const body = await request.arrayBuffer();
    if (!body.byteLength) return badRequest("Foto vacía");
    if (body.byteLength > MAX_BYTES) {
      return json({ status: "error", message: "La foto supera 25 MB" }, 413);
    }

    const ext = EXT[contentType] || "jpg";
    const key = `fotos/${safeName(visitaNum)}/${orden}.${ext}`;

    await env.PDF_BUCKET.put(key, body, {
      httpMetadata: { contentType },
      customMetadata: { visitaNum, orden: String(orden) },
    });

    // Registrar la foto en D1 (tabla de migrations/0002). Si la tabla aún no
    // existe, la foto igual queda en R2.
    let registrada = true;
    try {
      await env.DB.prepare(
        `INSERT INTO registros_fotos (visita_num, orden, r2_key, observacion, content_type, size)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(visita_num, orden) DO UPDATE SET
           r2_key = excluded.r2_key,
           observacion = excluded.observacion,
           content_type = excluded.content_type,
           size = excluded.size,
           created_at = datetime('now')`
      )
        .bind(visitaNum, orden, key, observacion, contentType, body.byteLength)
        .run();
    } catch (err) {
      if (/no such table/i.test(String(err?.message))) {
        registrada = false;
        console.warn("Falta la tabla registros_fotos (ejecutar migración 0002)");
      } else {
        throw err;
      }
    }

    return json({ status: "ok", key, size: body.byteLength, registrada });
  } catch (error) {
    return serverError(error);
  }
}
