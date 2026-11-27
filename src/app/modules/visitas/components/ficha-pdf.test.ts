/**
 * El PDF se genera al descargarlo (E3) para inspecciones de cualquier época: sin firma, sin fotos, con
 * campos de versiones anteriores vacíos o con fotos ilegibles. Ninguno de esos casos debe fallar.
 */
import { describe, expect, it } from 'vitest';
import { visitaEsquema } from '@shared/visitas';
import { generarFicha } from './ficha-pdf';
import { usaPdfArchivado } from './pdf-inspeccion';
import { FIRMA_PNG, visitaCompleta } from '../../../../../tests/datos';

const visita = (extra = {}) => visitaEsquema.parse(visitaCompleta(extra));

async function textoDe(pdf: Blob) {
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  return new TextDecoder('latin1').decode(bytes);
}

describe('ficha PDF generada al descargar (E3)', () => {
  it('con firma y fotos', async () => {
    const pdf = await generarFicha(visita({ firma_img: FIRMA_PNG }), [
      { base64: FIRMA_PNG, observacion: 'Placa' },
    ]);
    expect(pdf.size).toBeGreaterThan(1000);
    await textoDe(pdf);
  });

  it('sin firma: lo indica, sin error', async () => {
    const t = await textoDe(
      await generarFicha(visita({ firma_img: null }), []),
    );
    expect(t).toContain('Sin firma digital');
  });

  it('sin fotos y con campos de versiones anteriores vacíos', async () => {
    const v = visita();
    const vieja = Object.fromEntries(
      Object.entries(v).map(([k, x]) =>
        k === 'visita_num' || k === 'equipo'
          ? [k, x]
          : [k, Array.isArray(x) ? [] : null],
      ),
    ) as typeof v;
    await textoDe(await generarFicha(vieja, []));
  });

  it('foto ilegible o que no llegó: conserva su lugar con «Imagen no disponible»', async () => {
    const t = await textoDe(
      await generarFicha(visita(), [
        { base64: '', observacion: null },
        { base64: 'data:image/jpeg;base64,AAAA', observacion: 'Rota' },
      ]),
    );
    expect(t).toContain('Imagen no disponible');
    expect(t).toContain('Foto 2');
  });

  it('solo las inspecciones sin firma en la base y sin editar usan su PDF archivado', () => {
    const datos = visita({ firma_img: FIRMA_PNG });
    const sinFirma = { ...datos, firma_img: null };
    const caso = (
      tiene_pdf: boolean,
      d: typeof datos,
      editado_en: string | null,
    ) => usaPdfArchivado({ tiene_pdf, datos: d, editado_en });
    expect(caso(true, datos, null)).toBe(false);
    expect(caso(true, sinFirma, null)).toBe(true);
    expect(caso(false, sinFirma, null)).toBe(false);
    // Editada: el archivado quedó viejo, se genera de nuevo.
    expect(caso(true, sinFirma, '2026-11-28T10:00:00Z')).toBe(false);
  });

  it('editada sin firma en la base: indica que la firma está en el PDF original', async () => {
    const t = await textoDe(
      await generarFicha(
        visita({ firma_img: null }),
        [],
        'Firma en el PDF original',
      ),
    );
    expect(t).toContain('Firma en el PDF original');
  });
});
