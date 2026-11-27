import {
  type Cambio,
  type ObservacionesFotos,
  cambiosVisita,
  seccionesConCambios,
} from '../../../../shared/edicion';
import type { EdicionVisita } from '../../../../shared/tipos';
import { type Visita, faltantes } from '../../../../shared/visitas';
import {
  type Ctx,
  detallarAviso,
  sentenciaAuditoria,
} from '../../../plumbing/contexto';
import { ApiError } from '../../../plumbing/http';
import { COLUMNAS_DATOS, detalleVisita } from '../comun';
import {
  rechazarIncompleta,
  requisitosServidor,
  valores,
} from './registrar-visita';

/** Lo que no se edita: folio, fotos (solo su observación), firma y momento de captura. */
const FIJOS = new Set(['visita_num', 'num_fotos']);
/** Requisitos que la edición no revisa: la firma y las fotos no se editan. */
const NO_SE_EDITAN = new Set(['firma_img', 'fotos']);

interface Edicion {
  datos: Visita;
  observaciones: { orden: number; observacion: string | null }[];
  motivo: string;
  version: string;
}

/**
 * Corrige una inspección registrada (permiso Editar). Una sola escritura con su auditoría: el motivo y
 * cada cambio (antes → después), que es lo que muestra el historial. Solo se exige completo lo que está
 * en las secciones que cambiaron (las inspecciones antiguas pueden no tener campos que hoy se piden).
 * Si otra persona editó después de abrirla, 409: no se pisan sus cambios.
 */
export async function editarVisita(ctx: Ctx, id: number, e: Edicion) {
  const actual = await detalleVisita(ctx, id);
  if (e.version !== actual.version)
    throw new ApiError(
      409,
      'La inspección cambió mientras la editaba. Recargue para ver la versión actual.',
    );

  const despues: Visita = {
    ...e.datos,
    visita_num: actual.datos.visita_num,
    num_fotos: actual.datos.num_fotos,
    firma_img: actual.datos.firma_img,
    capturado_en: actual.datos.capturado_en,
  };
  const obsAntes: ObservacionesFotos = Object.fromEntries(
    actual.fotos.map(f => [f.orden, f.observacion]),
  );
  // Solo las fotos que existen.
  const obsDespues: ObservacionesFotos = { ...obsAntes };
  for (const o of e.observaciones)
    if (o.orden in obsAntes) obsDespues[o.orden] = o.observacion;

  const cambios = cambiosVisita(actual.datos, despues, obsAntes, obsDespues);
  if (!cambios.length) throw new ApiError(400, 'No hay cambios que guardar.');

  const tocadas = seccionesConCambios(cambios);
  rechazarIncompleta(
    faltantes(await requisitosServidor(ctx, despues), true).filter(
      r => tocadas.has(r.seccion) && !NO_SE_EDITAN.has(r.campo),
    ),
  );

  const db = ctx.env.DB;
  const datos = valores(despues);
  const columnas = COLUMNAS_DATOS.filter(c => !FIJOS.has(c));
  const fotosCambiadas = cambios
    .filter(c => c.campo.startsWith('foto.'))
    .map(c => Number(c.campo.slice(5)));
  await db.batch([
    db
      .prepare(
        `UPDATE registros SET ${columnas.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      )
      .bind(...columnas.map(c => datos[c] ?? null), id),
    // Las inspecciones anteriores a la v3 no tienen fila en visitas_registro: se crea.
    db
      .prepare(
        `INSERT INTO visitas_registro (registro_id, editado_en, editado_por) VALUES (?,?,?)
         ON CONFLICT(registro_id) DO UPDATE SET editado_en = excluded.editado_en, editado_por = excluded.editado_por`,
      )
      .bind(id, ctx.ahora, ctx.usuario.id),
    ...fotosCambiadas.map(orden =>
      db
        .prepare(
          'UPDATE registros_fotos SET observacion = ? WHERE visita_num = ? AND orden = ?',
        )
        .bind(obsDespues[orden] ?? null, actual.visita_num, orden),
    ),
    sentenciaAuditoria(
      ctx.env,
      ctx.usuario.id,
      'editar',
      'visita',
      id,
      null,
      { motivo: e.motivo, cambios },
      ctx.ahora,
    ),
  ]);
  detallarAviso(ctx, 'Inspección actualizada', actual.visita_num);
  return detalleVisita(ctx, id);
}

/** Ediciones de la inspección, de la más reciente a la más antigua. */
export async function historialVisita(
  ctx: Ctx,
  id: number,
): Promise<EdicionVisita[]> {
  // Solo de una inspección que puede ver (404 si no).
  await detalleVisita(ctx, id);
  const { results } = await ctx.env.DB.prepare(
    `SELECT a.creado_en, a.despues, u.nombre FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.entidad = 'visita' AND a.entidad_id = ? AND a.accion = 'editar'
     ORDER BY a.creado_en DESC, a.id DESC LIMIT 100`,
  )
    .bind(id)
    .all<{
      creado_en: string;
      despues: string | null;
      nombre: string | null;
    }>();
  return results.map(x => {
    let d: { motivo?: string; cambios?: Cambio[] } = {};
    try {
      d = JSON.parse(x.despues ?? '{}');
    } catch {
      // Registro ilegible: se muestra sin detalle.
    }
    return {
      fecha: x.creado_en,
      usuario: x.nombre,
      motivo: d.motivo ?? '',
      cambios: d.cambios ?? [],
    };
  });
}
