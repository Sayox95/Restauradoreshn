import {
  type Visita,
  faltantes,
  requisitosVisita,
  resumenMateriales,
  resumenPersonal,
} from '../../../../shared/visitas';
import type { Ctx } from '../../../plumbing/contexto';
import { ApiError, esErrorUnico } from '../../../plumbing/http';
import { catalogosVisita } from '../../catalogos/features/gestionar-catalogos';
import {
  COLUMNAS_DATOS,
  DESDE_VISITAS,
  SELECT_RESUMEN,
  resumen,
} from '../comun';
import { eventoDe } from '../../../plumbing/eventos';

/** Datos de la visita → valores de cada columna de `registros`. */
export function valores(
  v: Visita,
): Record<(typeof COLUMNAS_DATOS)[number], unknown> {
  const unoCero = (x: string | null) =>
    x === null ? null : x === 'SI' ? 1 : 0;
  return {
    ...(v as unknown as Record<string, unknown>),
    has_modem1: unoCero(v.has_modem1),
    has_modem2: unoCero(v.has_modem2),
    tablero_marca: v.marca_reconectador,
    tablero_campos: JSON.stringify(v.tablero_campos),
    materiales_json: JSON.stringify(v.materiales),
    materiales_resumen: resumenMateriales(v.materiales),
    personal_json: JSON.stringify(v.personal),
    personal_resumen: resumenPersonal(v.personal),
  } as Record<(typeof COLUMNAS_DATOS)[number], unknown>;
}

/**
 * Registra una visita completa. Es idempotente por número de visita (excepción E1): si quien la
 * registró la reenvía (reintento al reconectar), responde con la ya guardada; si el número es de
 * otra persona, 409. La escritura y su auditoría van en un solo batch.
 */
/**
 * Requisitos de la hoja con las mismas reglas del formulario. Lo que depende de catálogos que pueden
 * cambiar mientras el técnico captura sin conexión (modelos, campos del tablero) lo valida la app.
 */
export async function requisitosServidor(ctx: Ctx, v: Visita) {
  const cat = await catalogosVisita(ctx);
  return requisitosVisita(v, {
    camposTablero: Object.keys(v.tablero_campos),
    hayOpciones: campo =>
      campo === 'tipo_recon'
        ? cat.tipos.length > 0
        : campo === 'marca_reconectador'
          ? cat.marcas.length > 0
          : false,
    fotos: v.num_fotos ?? 0,
  });
}

/** 422 con los campos que faltan (los marca la app). */
export function rechazarIncompleta(
  falta: { campo: string; etiqueta: string }[],
) {
  if (falta.length)
    throw new ApiError(
      422,
      `La inspección está incompleta: ${falta
        .slice(0, 4)
        .map(x => x.etiqueta)
        .join(', ')}${falta.length > 4 ? '…' : ''}.`,
      {
        faltantes: falta.map(x => x.campo),
      },
    );
}

export async function registrarVisita(ctx: Ctx, v: Visita) {
  rechazarIncompleta(faltantes(await requisitosServidor(ctx, v), true));

  const db = ctx.env.DB;
  const existente = async () => {
    const f = await db
      .prepare(
        `SELECT ${SELECT_RESUMEN}, v.registrado_por AS registrado_por_id FROM ${DESDE_VISITAS} WHERE r.visita_num = ?`,
      )
      .bind(v.visita_num)
      .first<Record<string, unknown>>();
    if (!f) return null;
    if (f.registrado_por_id !== ctx.usuario.id)
      throw new ApiError(
        409,
        `Ya existe otra inspección con el folio ${v.visita_num}.`,
      );
    return { visita: resumen(f), creada: false };
  };
  const previa = await existente();
  if (previa) return previa;

  const datos = valores(v);
  const columnas = [...COLUMNAS_DATOS];
  const binds = COLUMNAS_DATOS.map(c => datos[c] ?? null);
  // En la auditoría no va la imagen de la firma (solo si la hubo).
  const { firma_img, ...paraAuditoria } = v;
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO registros (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(',')})`,
        )
        .bind(...binds),
      // Estado, quién, cuándo y la firma van aparte: `registros` está en el límite de columnas de D1.
      db
        .prepare(
          `INSERT INTO visitas_registro (registro_id, estado, equipo, registrado_por, registrado_en, capturado_en, firma_img)
           VALUES ((SELECT id FROM registros WHERE visita_num = ?), 'registrada', 'restaurador', ?, ?, ?, ?)`,
        )
        .bind(
          v.visita_num,
          ctx.usuario.id,
          ctx.ahora,
          v.capturado_en,
          firma_img,
        ),
      db
        .prepare(
          `INSERT INTO auditoria (usuario_id, accion, evento, entidad, entidad_id, antes, despues, creado_en)
           VALUES (?, 'registrar', ?, 'visita', (SELECT id FROM registros WHERE visita_num = ?), NULL, ?, ?)`,
        )
        .bind(
          ctx.usuario.id,
          eventoDe('registrar', 'visita'),
          v.visita_num,
          JSON.stringify({ ...paraAuditoria, firma: !!firma_img }),
          ctx.ahora,
        ),
    ]);
  } catch (e) {
    // Dos envíos simultáneos de la misma visita: el índice único deja pasar solo uno.
    if (esErrorUnico(e)) {
      const otra = await existente();
      if (otra) return otra;
    }
    throw e;
  }
  const nueva = await existente();
  return { visita: nueva!.visita, creada: true };
}
