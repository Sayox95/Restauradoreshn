import { type Ctx, sentenciaAuditoria } from '../../../plumbing/contexto';
import { cargarVisita } from '../comun';

/**
 * Elimina una inspección. Como piden los lineamientos, no se borra: queda oculta en todas partes (listas,
 * detalle, fotos, PDF y CSV) y se guarda quién, cuándo y por qué. Datos, fotos y PDF se conservan en la
 * base y en R2. Las inspecciones anteriores a la v3 no tienen fila en visitas_registro: se crea.
 */
export async function eliminarVisita(ctx: Ctx, id: number, motivo: string) {
  const v = await cargarVisita(ctx, id);
  const db = ctx.env.DB;
  await db.batch([
    db
      .prepare(
        `INSERT INTO visitas_registro (registro_id, eliminada_en, eliminada_por, motivo_eliminacion) VALUES (?,?,?,?)
         ON CONFLICT(registro_id) DO UPDATE SET eliminada_en = excluded.eliminada_en, eliminada_por = excluded.eliminada_por,
           motivo_eliminacion = excluded.motivo_eliminacion`,
      )
      .bind(id, ctx.ahora, ctx.usuario.id, motivo),
    sentenciaAuditoria(ctx.env, ctx.usuario.id, 'eliminar', 'visita', id, { visita_num: v.visita_num }, { motivo }, ctx.ahora),
  ]);
  return { id, visita_num: String(v.visita_num) };
}
