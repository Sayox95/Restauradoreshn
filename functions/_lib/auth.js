import { json } from "./response.js";

/**
 * Verifica el token de administración enviado en el header X-Admin-Token
 * contra la variable/secret ADMIN_TOKEN del proyecto en Cloudflare Pages.
 *
 * Devuelve null si está autorizado, o una Response de error si no.
 * Si ADMIN_TOKEN no está configurado se bloquea el acceso (fail closed).
 */
export function requireAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  if (!expected) {
    return json(
      {
        status: "error",
        code: "admin_token_not_configured",
        message:
          "ADMIN_TOKEN no está configurado en Cloudflare Pages (Settings → Variables and Secrets).",
      },
      503
    );
  }

  const provided = request.headers.get("X-Admin-Token") || "";
  if (!timingSafeEqual(provided, expected)) {
    return json(
      { status: "error", code: "unauthorized", message: "Clave de administrador inválida" },
      401
    );
  }
  return null;
}

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] || 0) ^ (bb[i] || 0);
  }
  return diff === 0;
}
