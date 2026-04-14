import {
  json,
  badRequest,
  methodNotAllowed,
  serverError,
} from "../_lib/response.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return methodNotAllowed("POST");
  }

  try {
    const { request, env } = context;
    const v = await request.json();

    if (!v || !v.visitaNum) {
      return badRequest("visitaNum es requerido");
    }

    const matsResumen = (v.materialesUtilizados || [])
      .filter((m) => m.desc)
      .map((m) => `[${m.codigo}] ${m.desc} x${m.cant} ${m.unidad}`)
      .join(" | ");

    const persResumen = (v.personal || [])
      .filter((p) => p.nombre)
      .map((p) => `${p.nombre} (${p.cargo || ""})`)
      .join(", ");

    const tableroJson = JSON.stringify(v.tableroCampos || {});

    const stmt = env.DB.prepare(`
      INSERT INTO registros (
        visita_num, fecha_visita, hora_llegada, hora_salida, tipo_visita,
        codigo_energis, circuito, ubicacion, zona, sector, subestacion,
        latitud, longitud, gen_distribuida,
        tipo_recon, marca_reconectador, modelo_recon, serie_recon,
        medio_extincion, tipo_control, serie_control, proview_control,
        has_modem1, tipo_modem1, marca_modem1, modelo_modem1, serie_modem1,
        antena_modem1, tipo_antena1, tec_modem1,
        has_modem2, tipo_modem2, marca_modem2, modelo_modem2, serie_modem2,
        antena_modem2, tipo_antena2, tec_modem2,
        tablero_marca, tablero_campos,
        alarma_presente, reset_alarma, desc_alarma,
        battery_test, battery_test_med, cambio_baterias,
        medicion_ac, medicion_bat, medicion_cargador,
        corr_ia, corr_ib, corr_ic, corr_in,
        ajuste_activo, c_apert_fase, c_apert_neutro,
        gabinete, borneras, obs_estado_fisico,
        ater_rest_state, ater_ctrl_state, ater_pot_state,
        cable_tierra, num_varillas,
        ater_control, ater_restaurador, ater_otros,
        tipo_cuchilla, estado_cuchillas, num_cuchillas,
        pararrayos, num_pararrayos,
        pot_cantidad, pot_pararrayos, pot_cuchilla, fase_conexion,
        materiales_json, materiales_resumen, obs_materiales,
        obs_generales,
        personal_json, personal_resumen,
        firma_responsable, obs_responsable, firma_r2_key
      ) VALUES (
        ?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,
        ?,?,?,?,?, ?,?,?,
        ?,?,?,?,?, ?,?,?,
        ?,?,?,?,?, ?,?,?,
        ?,?,
        ?,?,?,
        ?,?,?, ?,?,?,
        ?,?,?,?,
        ?,?,?,
        ?,?,?, ?,?,?, ?,?,?,
        ?,?,?,?,?,
        ?,?,?,
        ?,?,?,?,?,
        ?,?,?,
        ?,?,
        ?,?,?
      )
    `);

    const r = await stmt
      .bind(
        s(v.visitaNum),
        s(v.fechaVisita),
        s(v.horaLlegada),
        s(v.horaSalida),
        s(v.tipoVisita),

        s(v.codigoEnergis),
        s(v.codigoCircuito),
        s(v.nombreUbicacion),
        s(v.zona),
        s(v.sector),
        s(v.subestacion),

        s(v.latitud),
        s(v.longitud),
        s(v.genDistribuida),

        s(v.tipoRecon),
        s(v.marcaReconectador),
        s(v.modeloRecon),
        s(v.serieRecon),

        s(v.medioExtincion),
        s(v.tipoControl),
        s(v.serieControl),
        s(v.proviewControl),

        v.hasModem1 ? 1 : 0,
        s(v.tipoModem1),
        s(v.marcaModem1),
        s(v.modeloModem1),
        s(v.serieModem1),
        s(v.antenaModem1),
        s(v.tipoAntena1),
        s(v.tecModem1),

        v.hasModem2 ? 1 : 0,
        s(v.tipoModem2),
        s(v.marcaModem2),
        s(v.modeloModem2),
        s(v.serieModem2),
        s(v.antenaModem2),
        s(v.tipoAntena2),
        s(v.tecModem2),

        s(v.tableroMarca),
        tableroJson,

        s(v.alarmaPresente),
        s(v.resetAlarma),
        s(v.descAlarma),

        s(v.batteryTest),
        f(v.batteryTestMedicion),
        s(v.cambioBaterias),

        f(v.medicionAC),
        f(v.medicionBat),
        f(v.medicionCargador),

        f(v.corrIA),
        f(v.corrIB),
        f(v.corrIC),
        f(v.corrIN),

        s(v.ajusteActivo),
        f(v.cApertFase),
        f(v.cApertNeutro),

        s(v.gabinete),
        s(v.borneras),
        s(v.obsEstadoFisico),

        s(v.aterRestState),
        s(v.aterCtrlState),
        s(v.aterPotState),

        s(v.cableTierra),
        i(v.numVarillas),

        f(v.aterControl),
        f(v.aterRestaurador),
        f(v.aterOtros),

        s(v.tipoCuchilla),
        s(v.estadoCuchillas),
        i(v.numCuchillas),

        s(v.pararrayos),
        i(v.numPararrayos),

        i(v.potCantidad),
        s(v.potPararrayos),
        s(v.potCuchilla),
        s(v.faseConexion),

        JSON.stringify(v.materialesUtilizados || []),
        matsResumen,
        s(v.obsMateriales),

        s(v.obsGenerales),

        JSON.stringify(v.personal || []),
        persResumen,

        s(v.firmaResponsable),
        s(v.obsResponsable),
        s(v.firmaR2Key || v.pdfR2Key)
      )
      .run();

    return json({
      status: "ok",
      id: r.meta?.last_row_id || null,
      visitaNum: v.visitaNum,
    });
  } catch (error) {
    return serverError(error);
  }
}

function s(value) {
  return value ?? "";
}

function f(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

function i(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}
