import { json, badRequest, methodNotAllowed, serverError } from "../_lib/response.js";
import { createSession } from "../_lib/auth.js";

// POST /api/admin-login  { password } → { status:"ok", token, exp }
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return methodNotAllowed("POST");

  try {
    let body;
    try { body = await request.json(); } catch { return badRequest("JSON inválido"); }

    const result = await createSession(body?.password, env);
    if (result.error) return result.error; // ADMIN_TOKEN no configurado

    if (!result.token) {
      // Pequeña espera ante clave incorrecta para frenar intentos repetidos
      await new Promise((r) => setTimeout(r, 1000));
      return json(
        { status: "error", code: "unauthorized", message: "La clave no es correcta" },
        401
      );
    }

    return json({ status: "ok", token: result.token, exp: result.exp });
  } catch (error) {
    return serverError(error);
  }
}
