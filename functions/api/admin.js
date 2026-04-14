import {
  json,
  badRequest,
  methodNotAllowed,
  serverError,
} from "../_lib/response.js";
import { adminInsert, adminUpdate, adminDelete } from "../_lib/admin.js";

export async function onRequest(context) {
  const { request, env } = context;

  try {
    if (request.method === "GET") {
      return await handleGet(request, env);
    }

    if (request.method === "POST") {
      return await handlePost(request, env);
    }

    return methodNotAllowed("GET, POST");
  } catch (error) {
    return serverError(error);
  }
}

async function handleGet(request, env) {
  const url = new URL(request.url);
  const section = url.searchParams.get("section") || url.searchParams.get("action");

  const queries = {
    restauradores: `SELECT id as _rowNum, energis as "Energis", zona as "Zona",
                    sector as "Sector", subestacion as "Subestacion",
                    ubicacion as "Ubicación", circuito as "Circuito",
                    longitud as "Longitud", latitud as "Latitud",
                    estado as "Estado"
                    FROM restauradores
                    ORDER BY circuito`,

    materiales: `SELECT id as _rowNum, codigo as "CODIGO MATERIAL",
                 nombre as "NOMBRE MATERIAL", unidad as "CODIGO UNIDAD",
                 stock as "CANTIDAD ACTUAL"
                 FROM materiales
                 ORDER BY nombre`,

    personal: `SELECT id as _rowNum, nombre as "Nombre", cargo as "Cargo",
               empleado_id as "ID Empleado",
               CASE activo WHEN 1 THEN 'TRUE' ELSE 'FALSE' END as "Activo"
               FROM personal
               ORDER BY nombre`,

    tipos: `SELECT id as _rowNum, elemento as "ELEMENTO", tipo as "TIPO"
            FROM tipos
            ORDER BY tipo`,

    marcas: `SELECT id as _rowNum, elemento as "ELEMENTO", marca as "MARCA",
             modelo as "MODELO", tipo_control as "TIPO CONTROL"
             FROM marcas
             ORDER BY marca, modelo`,

    tableros: `SELECT id as _rowNum, marca as "Marca", campo as "Campo",
               orden as "Orden",
               CASE activo WHEN 1 THEN 'TRUE' ELSE 'FALSE' END as "Activo"
               FROM tableros
               ORDER BY marca, orden`,
  };

  const query = queries[section];
  if (!query) {
    return badRequest("Sección no encontrada: " + section);
  }

  const rows = await env.DB.prepare(query).all();
  return json({ status: "ok", rows: rows.results || [] });
}

async function handlePost(request, env) {
  const body = await request.json();
  const { action, section, id, data } = body || {};

  if (!action || !section) {
    return badRequest("Faltan action o section");
  }

  if (action === "insert") {
    await adminInsert(section, data || {}, env);
    return json({ status: "ok" });
  }

  if (action === "update") {
    if (!id) return badRequest("Falta id para update");
    await adminUpdate(section, id, data || {}, env);
    return json({ status: "ok" });
  }

  if (action === "delete") {
    if (!id) return badRequest("Falta id para delete");
    await adminDelete(section, id, env);
    return json({ status: "ok" });
  }

  return badRequest("Acción no reconocida");
}
