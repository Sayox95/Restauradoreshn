import { json } from "./response.js";

/**
 * Autenticación del panel de administración.
 *
 * 1. El usuario ingresa la clave → POST /api/admin-login la compara con el
 *    secret ADMIN_TOKEN y devuelve una SESIÓN firmada (HMAC-SHA256) que vence
 *    en SESSION_HOURS. El dispositivo guarda solo la sesión, nunca la clave.
 * 2. Cada llamada a /api/admin envía `Authorization: Bearer <sesión>`.
 *
 * La firma usa ADMIN_TOKEN como llave: si se cambia la clave en Cloudflare,
 * todas las sesiones abiertas quedan invalidadas.
 */
export const SESSION_HOURS = 8;

function notConfigured() {
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

function unauthorized(message = "Sesión de administrador inválida o vencida") {
  return json({ status: "error", code: "unauthorized", message }, 401);
}

/** Crea una sesión firmada si la clave es correcta; si no, devuelve null. */
export async function createSession(password, env) {
  if (!env.ADMIN_TOKEN) return { error: notConfigured() };
  if (!timingSafeEqual(String(password || ""), env.ADMIN_TOKEN)) return { error: null };

  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ exp })));
  const sig = await sign(payload, env.ADMIN_TOKEN);
  return { token: `${payload}.${sig}`, exp };
}

/** Devuelve null si la petición trae una sesión válida, o una Response de error. */
export async function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return notConfigured();

  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return unauthorized();

  const expected = await sign(payload, env.ADMIN_TOKEN);
  if (!timingSafeEqual(sig, expected)) return unauthorized();

  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  } catch {
    return unauthorized();
  }
  if (!data || typeof data.exp !== "number" || Date.now() > data.exp) {
    return unauthorized("La sesión de administrador venció");
  }
  return null;
}

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(mac));
}

function b64url(bytes) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function timingSafeEqual(a, b) {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}
