export async function adminInsert(section, data, env) {
  const map = {
    restauradores: () =>
      env.DB.prepare(
        `INSERT INTO restauradores
         (energis, zona, sector, subestacion, ubicacion, circuito, longitud, latitud, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data["Energis"] || "",
        data["Zona"] || "",
        data["Sector"] || "",
        data["Subestacion"] || "",
        data["Ubicación"] || "",
        data["Circuito"] || "",
        safeFloat(data["Longitud"]),
        safeFloat(data["Latitud"]),
        data["Estado"] || "ACTIVO"
      ),
 
    materiales: () =>
      env.DB.prepare(
        `INSERT INTO materiales (codigo, nombre, unidad, stock)
         VALUES (?, ?, ?, ?)`
      ).bind(
        data["CODIGO MATERIAL"] || "",
        data["NOMBRE MATERIAL"] || "",
        data["CODIGO UNIDAD"] || "",
        safeFloat(data["CANTIDAD ACTUAL"], 0)
      ),

    personal: () =>
      env.DB.prepare(
        `INSERT INTO personal (nombre, cargo, empleado_id, activo)
         VALUES (?, ?, ?, ?)`
      ).bind(
        data["Nombre"] || "",
        data["Cargo"] || "",
        data["ID Empleado"] || "",
        data["Activo"] === "TRUE" ? 1 : 0
      ),

    tipos: () =>
      env.DB.prepare(
        `INSERT INTO tipos (elemento, tipo)
         VALUES (?, ?)`
      ).bind(data["ELEMENTO"] || "", data["TIPO"] || ""),

    marcas: () =>
      env.DB.prepare(
        `INSERT INTO marcas (elemento, marca, modelo, tipo_control)
         VALUES (?, ?, ?, ?)`
      ).bind(
        data["ELEMENTO"] || "",
        data["MARCA"] || "",
        data["MODELO"] || "",
        data["TIPO CONTROL"] || ""
      ),

    tableros: () =>
      env.DB.prepare(
        `INSERT INTO tableros (marca, campo, orden, activo)
         VALUES (?, ?, ?, ?)`
      ).bind(
        data["Marca"] || "",
        data["Campo"] || "",
        safeInt(data["Orden"], 99),
        data["Activo"] === "TRUE" ? 1 : 0
      ),
  };

  if (!map[section]) {
    throw new Error("Sección no soportada: " + section);
  }

  await map[section]().run();
}

export async function adminUpdate(section, id, data, env) {
  const map = {
    restauradores: () =>
      env.DB.prepare(
        `UPDATE restauradores
         SET energis=?, zona=?, sector=?, subestacion=?, ubicacion=?, circuito=?, longitud=?, latitud=?, estado=?,
             updated_at=datetime('now')
         WHERE id=?`
      ).bind(
        data["Energis"] || "",
        data["Zona"] || "",
        data["Sector"] || "",
        data["Subestacion"] || "",
        data["Ubicación"] || "",
        data["Circuito"] || "",
        safeFloat(data["Longitud"]),
        safeFloat(data["Latitud"]),
        data["Estado"] || "ACTIVO",
        id
      ),

    materiales: () =>
      env.DB.prepare(
        `UPDATE materiales
         SET codigo=?, nombre=?, unidad=?, stock=?, updated_at=datetime('now')
         WHERE id=?`
      ).bind(
        data["CODIGO MATERIAL"] || "",
        data["NOMBRE MATERIAL"] || "",
        data["CODIGO UNIDAD"] || "",
        safeFloat(data["CANTIDAD ACTUAL"], 0),
        id
      ),

    personal: () =>
      env.DB.prepare(
        `UPDATE personal
         SET nombre=?, cargo=?, empleado_id=?, activo=?, updated_at=datetime('now')
         WHERE id=?`
      ).bind(
        data["Nombre"] || "",
        data["Cargo"] || "",
        data["ID Empleado"] || "",
        data["Activo"] === "TRUE" ? 1 : 0,
        id
      ),

    tipos: () =>
      env.DB.prepare(
        `UPDATE tipos
         SET elemento=?, tipo=?
         WHERE id=?`
      ).bind(data["ELEMENTO"] || "", data["TIPO"] || "", id),

    marcas: () =>
      env.DB.prepare(
        `UPDATE marcas
         SET elemento=?, marca=?, modelo=?, tipo_control=?
         WHERE id=?`
      ).bind(
        data["ELEMENTO"] || "",
        data["MARCA"] || "",
        data["MODELO"] || "",
        data["TIPO CONTROL"] || "",
        id
      ),

    tableros: () =>
      env.DB.prepare(
        `UPDATE tableros
         SET marca=?, campo=?, orden=?, activo=?
         WHERE id=?`
      ).bind(
        data["Marca"] || "",
        data["Campo"] || "",
        safeInt(data["Orden"], 99),
        data["Activo"] === "TRUE" ? 1 : 0,
        id
      ),
  };

  if (!map[section]) {
    throw new Error("Sección no soportada: " + section);
  }

  await map[section]().run();
}

export async function adminDelete(section, id, env) {
  const tables = {
    restauradores: "restauradores",
    materiales: "materiales",
    personal: "personal",
    tipos: "tipos",
    marcas: "marcas",
    tableros: "tableros",
  };

  const table = tables[section];
  if (!table) {
    throw new Error("Sección no soportada: " + section);
  }

  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
}

function safeFloat(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
}

function safeInt(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}
