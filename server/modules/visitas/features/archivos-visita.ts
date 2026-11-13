import { MAX_FOTOS, MAX_PDF_BYTES } from '../../../../shared/constantes';
import { type Ctx, sentenciaAuditoria } from '../../../plumbing/contexto';
import { EXT, leerFoto, noModificada, respuestaArchivo } from '../../../plumbing/fotos';
import { ApiError, noEncontrado, prohibido } from '../../../plumbing/http';
import { cargarVisita, nombreSeguro } from '../comun';

/** Solo quien registró la visita le agrega fotos o su PDF. */
async function visitaPropia(ctx: Ctx, id: number) {
  const f = await cargarVisita(ctx, id);
  // Fotos y PDF los sube solo quien la registró (el personal de la inspección solo la ve).
  if (f.registrado_por_id !== ctx.usuario.id) throw prohibido();
  return f;
}

function ordenValido(v: string | undefined) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > MAX_FOTOS) throw new ApiError(400, `La foto debe ser de la 1 a la ${MAX_FOTOS}.`);
  return n;
}

/**
 * Guarda una foto ORIGINAL (excepción E2) en R2: fotos/<folio>/<orden>.<ext>, con su fila en
 * registros_fotos. Reenviar la misma foto la reemplaza (idempotente para la sincronización).
 */
export async function subirFoto(ctx: Ctx, id: number, ordenTexto: string | undefined) {
  const orden = ordenValido(ordenTexto);
  const v = await visitaPropia(ctx, id);
  const observacion = (ctx.url.searchParams.get('obs') ?? '').trim().slice(0, 500) || null;
  const { buf, mime } = await leerFoto(ctx.req);
  const folio = String(v.visita_num);
  const clave = `fotos/${nombreSeguro(folio)}/${orden}.${EXT[mime]}`;
  const db = ctx.env.DB;
  const anterior = await db.prepare('SELECT r2_key FROM registros_fotos WHERE visita_num = ? AND orden = ?').bind(folio, orden).first<{ r2_key: string }>();

  await ctx.env.ARCHIVOS.put(clave, buf, { httpMetadata: { contentType: mime }, customMetadata: { visita: folio, orden: String(orden) } });
  await db.batch([
    db
      .prepare(
        `INSERT INTO registros_fotos (visita_num, orden, r2_key, observacion, content_type, size, created_at, subido_por)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(visita_num, orden) DO UPDATE SET r2_key = excluded.r2_key, observacion = excluded.observacion,
           content_type = excluded.content_type, size = excluded.size, created_at = excluded.created_at, subido_por = excluded.subido_por`,
      )
      .bind(folio, orden, clave, observacion, mime, buf.byteLength, ctx.ahora, ctx.usuario.id),
    sentenciaAuditoria(ctx.env, ctx.usuario.id, 'subir_foto', 'visita', id, anterior, { orden, mime, bytes: buf.byteLength, observacion }, ctx.ahora),
  ]);
  // Si la foto cambió de formato, la anterior queda con otro nombre: se retira de R2.
  if (anterior && anterior.r2_key !== clave) await ctx.env.ARCHIVOS.delete(anterior.r2_key);
  return { orden, bytes: buf.byteLength, mime };
}

/** Sirve la foto original a quien puede ver la visita (nunca es pública). */
export async function descargarFoto(ctx: Ctx, id: number, ordenTexto: string | undefined) {
  const orden = ordenValido(ordenTexto);
  const v = await cargarVisita(ctx, id);
  const f = await ctx.env.DB.prepare('SELECT r2_key, content_type, size, created_at FROM registros_fotos WHERE visita_num = ? AND orden = ?')
    .bind(v.visita_num, orden)
    .first<{ r2_key: string; content_type: string | null; size: number | null; created_at: string | null }>();
  if (!f) throw noEncontrado('La foto');
  const version = `${f.r2_key}-${f.size ?? 0}-${f.created_at ?? ''}`;
  const igual = noModificada(ctx, version);
  if (igual) return igual;
  const obj = await ctx.env.ARCHIVOS.get(f.r2_key);
  if (!obj) throw noEncontrado('La foto');
  return respuestaArchivo(obj, f.content_type ?? 'image/jpeg', version);
}

/**
 * Archiva el PDF de la ficha (excepción E3: se genera en la app porque no hay formato oficial
 * seriado). La base sigue siendo la fuente oficial; el PDF se puede volver a generar.
 */
export async function subirPdf(ctx: Ctx, id: number) {
  const v = await visitaPropia(ctx, id);
  const largo = Number(ctx.req.headers.get('Content-Length') || 0);
  if (largo > MAX_PDF_BYTES) throw new ApiError(413, 'El PDF es demasiado grande.');
  const buf = new Uint8Array(await ctx.req.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_PDF_BYTES) throw new ApiError(413, 'El PDF está vacío o es demasiado grande.');
  if (String.fromCharCode(...buf.slice(0, 4)) !== '%PDF') throw new ApiError(415, 'El archivo no es un PDF.');
  const clave = `pdfs/${nombreSeguro(String(v.visita_num))}.pdf`;
  await ctx.env.ARCHIVOS.put(clave, buf, { httpMetadata: { contentType: 'application/pdf' } });
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE registros SET pdf_r2_key = ? WHERE id = ?').bind(clave, id),
    sentenciaAuditoria(ctx.env, ctx.usuario.id, 'archivar_pdf', 'visita', id, null, { bytes: buf.byteLength }, ctx.ahora),
  ]);
  return { bytes: buf.byteLength };
}

export async function descargarPdf(ctx: Ctx, id: number) {
  const v = await cargarVisita(ctx, id);
  const clave = v.pdf_r2_key as string | null;
  if (!clave) throw noEncontrado('El PDF de la inspección');
  const obj = await ctx.env.ARCHIVOS.get(clave);
  if (!obj) throw noEncontrado('El PDF de la inspección');
  return respuestaArchivo(obj, 'application/pdf', `${clave}-${obj.size ?? ''}`, `Ficha_${nombreSeguro(String(v.visita_num))}.pdf`);
}
