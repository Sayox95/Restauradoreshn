import { type Visita, faltantes, requisitosVisita, resumenMateriales, resumenPersonal } from '../../../../shared/visitas';
import type { Ctx } from '../../../plumbing/contexto';
import { ApiError, esErrorUnico } from '../../../plumbing/http';
import { catalogosVisita } from '../../catalogos/features/gestionar-catalogos';
import { COLUMNAS_DATOS, SELECT_RESUMEN, resumen } from '../comun';

/** Datos de la visita → valores de cada columna de `registros`. */
function valores(v: Visita): Record<(typeof COLUMNAS_DATOS)[number], unknown> {
  const unoCero = (x: string | null) => (x === null ? null : x === 'SI' ? 1 : 0);
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
export async function registrarVisita(ctx: Ctx, v: Visita) {
  // Reglas de la hoja: las mismas del formulario. Lo que depende de catálogos que pueden cambiar
  // mientras el técnico captura sin conexión (modelos, campos del tablero) lo valida la app.
  const cat = await catalogosVisita(ctx);
  const requisitos = requisitosVisita(v, {
    camposTablero: Object.keys(v.tablero_campos),
    hayOpciones: (campo) => (campo === 'tipo_recon' ? cat.tipos.length > 0 : campo === 'marca_reconectador' ? cat.marcas.length > 0 : false),
    fotos: v.num_fotos ?? 0,
  });
  const falta = faltantes(requisitos, true);
  if (falta.length)
    throw new ApiError(
      422,
      `La visita está incompleta: ${falta
        .slice(0, 4)
        .map((x) => x.etiqueta)
        .join(', ')}${falta.length > 4 ? '…' : ''}.`,
      {
        faltantes: falta.map((x) => x.campo),
      },
    );

  const db = ctx.env.DB;
  const existente = async () => {
    const f = await db
      .prepare(
        `SELECT ${SELECT_RESUMEN}, r.registrado_por AS registrado_por_id FROM registros r LEFT JOIN usuarios u ON u.id = r.registrado_por WHERE r.visita_num = ?`,
      )
      .bind(v.visita_num)
      .first<Record<string, unknown>>();
    if (!f) return null;
    if (f.registrado_por_id !== ctx.usuario.id) throw new ApiError(409, `Ya existe otra visita con el número ${v.visita_num}.`);
    return { visita: resumen(f), creada: false };
  };
  const previa = await existente();
  if (previa) return previa;

  const datos = valores(v);
  const columnas = [...COLUMNAS_DATOS, 'estado', 'registrado_por', 'registrado_en'];
  const binds = [...COLUMNAS_DATOS.map((c) => datos[c] ?? null), 'registrada', ctx.usuario.id, ctx.ahora];
  // En la auditoría no va la imagen de la firma (solo si la hubo).
  const { firma_img, ...paraAuditoria } = v;
  try {
    await db.batch([
      db.prepare(`INSERT INTO registros (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(',')})`).bind(...binds),
      db
        .prepare(
          `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, antes, despues, creado_en)
           VALUES (?, 'registrar', 'visita', (SELECT id FROM registros WHERE visita_num = ?), NULL, ?, ?)`,
        )
        .bind(ctx.usuario.id, v.visita_num, JSON.stringify({ ...paraAuditoria, firma: !!firma_img }), ctx.ahora),
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
