import { json, methodNotAllowed, serverError } from "../_lib/response.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "all";
    const result = { status: "ok", updated: new Date().toISOString() };

    if (action === "restauradores" || action === "all") {
      const rows = await env.DB.prepare(
        `SELECT energis, zona, sector, subestacion, ubicacion,
                circuito, longitud, latitud, estado
         FROM restauradores
         WHERE estado = 'ACTIVO'
         ORDER BY circuito`
      ).all();
      result.restauradores = rows.results || [];
    }

    if (action === "materiales" || action === "all") {
      const rows = await env.DB.prepare(
        `SELECT codigo, nombre, unidad, stock
         FROM materiales
         ORDER BY nombre`
      ).all();
      result.materiales = rows.results || [];
    }

    if (action === "personal" || action === "all") {
      const rows = await env.DB.prepare(
        `SELECT nombre, cargo, empleado_id as id
         FROM personal
         WHERE activo = 1
         ORDER BY nombre`
      ).all();
      result.personal = rows.results || [];
    }

    if (action === "tipos" || action === "all") {
      const rows = await env.DB.prepare(
        `SELECT elemento, tipo
         FROM tipos
         ORDER BY tipo`
      ).all();
      result.tipos = (rows.results || []).map((r) => r.tipo);
    }

    if (action === "marcas" || action === "all") {
      const rows = await env.DB.prepare(
        `SELECT elemento, marca, modelo, tipo_control
         FROM marcas
         ORDER BY marca, modelo`
      ).all();

      const restMap = {};
      const modemMap = {};

      (rows.results || []).forEach((r) => {
        const elem = (r.elemento || "").toUpperCase();

        if (elem === "RESTAURADOR") {
          if (!restMap[r.marca]) {
            restMap[r.marca] = { marca: r.marca, modelos: [], controles: [] };
          }
          if (r.modelo && !restMap[r.marca].modelos.includes(r.modelo)) {
            restMap[r.marca].modelos.push(r.modelo);
          }
          if (
            r.tipo_control &&
            !restMap[r.marca].controles.includes(r.tipo_control)
          ) {
            restMap[r.marca].controles.push(r.tipo_control);
          }
        } else if (
          ["MODEM DATOS", "MODEM TELEMETRIA", "RADIO MODEM"].includes(elem)
        ) {
          if (!modemMap[r.marca]) {
            modemMap[r.marca] = {
              marca: r.marca,
              elemento: elem,
              modelos: [],
            };
          }
          if (r.modelo && !modemMap[r.marca].modelos.includes(r.modelo)) {
            modemMap[r.marca].modelos.push(r.modelo);
          }
        }
      });

      result.marcas = Object.values(restMap);
      result.modems = Object.values(modemMap);
    }

    if (action === "tableros" || action === "all") {
      const rows = await env.DB.prepare(
        `SELECT marca, campo, orden, activo
         FROM tableros
         WHERE activo = 1
         ORDER BY marca, orden`
      ).all();

      const map = {};
      (rows.results || []).forEach((r) => {
        if (!map[r.marca]) {
          map[r.marca] = { marca: r.marca, campos: [] };
        }
        map[r.marca].campos.push({
          campo: r.campo,
          orden: r.orden,
          activo: r.activo ? "TRUE" : "FALSE",
        });
      });

      result.tableros = Object.values(map);
    }

    return json(result);
  } catch (error) {
    return serverError(error);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return methodNotAllowed("GET");
  }
  return onRequestGet(context);
}
