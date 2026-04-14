export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function methodNotAllowed(allowed = "GET") {
  return json(
    { status: "error", message: `Method not allowed. Use ${allowed}` },
    405,
    { Allow: allowed }
  );
}

export function badRequest(message) {
  return json({ status: "error", message }, 400);
}

export function serverError(error) {
  console.error(error);
  return json(
    { status: "error", message: error?.message || "Internal server error" },
    500
  );
}
