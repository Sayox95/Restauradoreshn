/** Resumen de cambios de una edición: lo que ve la persona al confirmar y lo que queda en el historial. */
import { describe, expect, it } from 'vitest';
import { cambiosVisita } from '../shared/edicion';
import { visitaEsquema } from '../shared/visitas';
import { visitaCompleta } from './datos';

const visita = (extra = {}) => visitaEsquema.parse(visitaCompleta(extra));
const bateria = {
  codigo: '70254',
  desc: 'BATERIA DE 12 V 4.5 AH',
  unidad: 'UN',
  cant: 1,
  motivo: null,
};
const cable = {
  codigo: '180005',
  desc: 'CABLE PARA RED UTP CAT 6m',
  unidad: 'M',
  cant: 1,
  motivo: null,
};

describe('cambios de una edición', () => {
  it('materiales elemento por elemento: quitado, agregado y cantidad', () => {
    const antes = visita({ materiales: [bateria, cable] });
    expect(
      cambiosVisita(antes, visita({ materiales: [bateria] })).map(c => [
        c.etiqueta,
        c.antes,
        c.despues,
      ]),
    ).toEqual([['Material quitado', 'CABLE PARA RED UTP CAT 6m · 1 M', '—']]);
    expect(
      cambiosVisita(
        antes,
        visita({
          materiales: [
            { ...bateria, cant: 2 },
            cable,
            {
              codigo: null,
              desc: 'Cinta aislante',
              unidad: 'UN',
              cant: 3,
              motivo: null,
            },
          ],
        }),
      ).map(c => [c.etiqueta, c.antes, c.despues]),
    ).toEqual([
      ['BATERIA DE 12 V 4.5 AH', '1 UN', '2 UN'],
      ['Material agregado', '—', 'Cinta aislante · 3 UN'],
    ]);
  });

  it('personal: técnico agregado o quitado', () => {
    const p1 = { usuario_id: 1, nombre: 'Ana', cargo: 'Técnico' };
    const p2 = { usuario_id: 2, nombre: 'Beto', cargo: null };
    expect(
      cambiosVisita(
        visita({ personal: [p1, p2] }),
        visita({ personal: [p1] }),
      ).map(c => [c.etiqueta, c.antes]),
    ).toEqual([['Técnico quitado', 'Beto']]);
  });

  it('cada cambio tiene su clave única (las listas se muestran en orden)', () => {
    const c = cambiosVisita(
      visita({ materiales: [bateria, cable] }),
      visita({ materiales: [] }),
    );
    expect(new Set(c.map(x => x.campo)).size).toBe(c.length);
  });
});
