/**
 * Estructura única de la ficha de inspección: secciones, bloques y campos en el orden aprobado. La usan
 * el PDF (ficha-pdf.ts) y el detalle en pantalla (ver-visita), así nunca se desalinean.
 *
 * Tipos de bloque:
 *  - datos: celdas con etiqueta y valor (en `cols` columnas);
 *  - estados: respuestas SI/NO, OK/NOK, ON/OFF en una línea («Gabinete ● OK»);
 *  - textos: observaciones (recuadros lado a lado si son cortas).
 * Materiales, fotografías, personal y firma tienen su propio dibujo en cada salida.
 */
import { esCooper, type Visita } from '@shared/visitas';

export interface CampoFicha {
  l: string;
  v: string;
  /** Columnas que ocupa (datos y estados). */
  s?: number;
}
export type BloqueFicha =
  | { tipo: 'datos' | 'estados'; subtitulo?: string; cols: number; campos: CampoFicha[] }
  | { tipo: 'textos'; subtitulo?: string; textos: [string, string][] };
export interface SeccionFicha {
  titulo: string;
  bloques: BloqueFicha[];
}

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
/** Respuesta de estado (SI/NO, OK/NOK, ON/OFF): se pinta en verde o rojo. */
export const tonoEstado = (v: string): 'bien' | 'mal' | null =>
  ['SI', 'OK', 'ON'].includes(v.toUpperCase()) ? 'bien' : ['NO', 'NOK', 'OFF'].includes(v.toUpperCase()) ? 'mal' : null;

const c = (l: string, v: unknown, s?: number): CampoFicha => ({ l, v: texto(v), ...(s ? { s } : {}) });
const si = <T>(cond: unknown, x: T): T | null => (cond ? x : null);
const solo = (lista: (CampoFicha | null)[]) => lista.filter((x): x is CampoFicha => !!x);
/** Los estados vacíos no se muestran (p. ej. una pregunta que no aplica). */
const conValor = (lista: (CampoFicha | null)[]) => solo(lista).filter((x) => x.v !== '');

/** Secciones de la página 1 del PDF (el equipo), en el orden aprobado. */
export function estructuraFicha(v: Visita): SeccionFicha[] {
  const cooper = esCooper(v);
  const coord = texto(v.latitud) || texto(v.longitud) ? `${texto(v.latitud) || '—'} , ${texto(v.longitud) || '—'}` : '';
  const modems: BloqueFicha[] = ([1, 2] as const).flatMap((n) => {
    if (v[`has_modem${n}`] !== 'SI') return [];
    const antena = texto(v[`antena_modem${n}`]);
    const tipoAntena = texto(v[`tipo_antena${n}`]);
    return [
      {
        tipo: 'datos' as const,
        subtitulo: `Módem ${n}`,
        cols: 6,
        campos: [
          c('Tipo', v[`tipo_modem${n}`]),
          c('Marca', v[`marca_modem${n}`]),
          c('Modelo', v[`modelo_modem${n}`]),
          c('Serie', v[`serie_modem${n}`]),
          c('Antena', antena ? antena + (tipoAntena ? ` · ${tipoAntena}` : '') : ''),
          c('Tecnología', v[`tec_modem${n}`]),
        ],
      },
    ];
  });
  const sinModem = conValor([si(v.has_modem1 !== 'SI', c('Módem 1', 'NO')), si(v.has_modem2 !== 'SI', c('Módem 2', 'NO'))]);
  const tablero = Object.entries(v.tablero_campos ?? {}).filter(([, x]) => x);
  const potSi = v.tiene_potencial === 'SI';

  const secciones: SeccionFicha[] = [
    {
      titulo: 'Datos del restaurador',
      bloques: [
        {
          tipo: 'datos',
          cols: 6,
          campos: [
            c('Ubicación', v.ubicacion, 2),
            c('Subestación', v.subestacion),
            c('Zona', v.zona),
            c('Sector', v.sector, 2),
            c('Coordenadas (lat , long)', coord, 2),
            c('Generación distribuida', v.gen_distribuida),
          ],
        },
      ],
    },
    {
      titulo: 'Reconectador',
      bloques: [
        {
          tipo: 'datos',
          cols: 6,
          campos: solo([
            c('Tipo', v.tipo_recon),
            c('Marca', v.marca_reconectador),
            c('Modelo', v.modelo_recon),
            c('Medio de extinción', v.medio_extincion),
            c('Serie reconectador', v.serie_recon, 2),
            c('Tipo de control', v.tipo_control),
            c('Serie control', v.serie_control, 2),
            si(cooper, c('Firmware / Proview', v.proview_control)),
          ]),
        },
        ...(cooper
          ? [
              {
                tipo: 'estados' as const,
                cols: 4,
                campos: conValor([
                  c('Terminal p/sensores V', v.term_sens_v),
                  c('Manguera sensores V', v.mangu_sens_v),
                  c('Terminal manguera aux', v.term_mangu_aux),
                  c('Manguera auxiliar', v.mangu_aux),
                ]),
              },
            ]
          : []),
      ],
    },
    {
      titulo: 'Módems y comunicaciones',
      bloques: [...modems, ...(sinModem.length ? [{ tipo: 'estados' as const, cols: 4, campos: sinModem }] : [])],
    },
    {
      titulo: 'Tablero y mediciones',
      bloques: [
        ...(tablero.length || v.ajuste_activo
          ? [
              {
                tipo: 'estados' as const,
                subtitulo: `Tablero de control${v.marca_reconectador ? ` · ${v.marca_reconectador.toUpperCase()}` : ''}`,
                cols: 4,
                campos: conValor([...tablero.map(([l, x]) => c(l, x)), c('Grupo activo', v.ajuste_activo)]),
              },
            ]
          : []),
        { tipo: 'estados', subtitulo: 'Alarma', cols: 4, campos: conValor([c('Alarma presente', v.alarma_presente)]) },
        { tipo: 'textos', textos: [['Descripción de la alarma', texto(v.desc_alarma)]] },
        {
          tipo: 'estados',
          subtitulo: 'Batería',
          cols: 3,
          campos: conValor([
            c('Battery test', v.battery_test),
            c('Cambio de baterías', v.cambio_baterias),
            si(v.cambio_baterias === 'SI', c('Batería instalada', v.tipo_bateria)),
          ]),
        },
        {
          tipo: 'datos',
          cols: 3,
          campos: [c('Voltaje AC (V)', v.medicion_ac), c('Voltaje baterías (V)', v.medicion_bat), c('Voltaje cargador (V)', v.medicion_cargador)],
        },
        {
          tipo: 'datos',
          subtitulo: 'Corrientes instantáneas (A)',
          cols: 4,
          campos: [c('IA', v.corr_ia), c('IB', v.corr_ib), c('IC', v.corr_ic), c('IN (neutro)', v.corr_in)],
        },
      ],
    },
    {
      titulo: 'Estado físico',
      bloques: [
        {
          tipo: 'estados',
          cols: 4,
          campos: conValor([
            c('Gabinete', v.gabinete),
            c('Borneras', v.borneras),
            c('Aterrizaje restaurador', v.ater_rest_state),
            c('Aterrizaje control', v.ater_ctrl_state),
            c('Cable de tierra', v.cable_tierra),
            c('Estado cuchillas', v.estado_cuchillas),
            c('Pararrayos', v.pararrayos),
            c('Tiene potencial', v.tiene_potencial),
            si(potSi, c('Pararrayos potencial', v.pot_pararrayos)),
            si(potSi, c('Cuchilla potencial', v.pot_cuchilla)),
            si(potSi, c('Aterrizaje potencial', v.ater_pot_state)),
            si(v.tiene_potencial === 'NO', c('Alimentado por acometida', v.alimentado_acometida)),
          ]),
        },
        {
          tipo: 'datos',
          cols: 6,
          campos: solo([
            c('Tipo de cuchilla', v.tipo_cuchilla, 3),
            c('N° cuchillas', v.num_cuchillas),
            c('N° pararrayos', v.num_pararrayos),
            c('N° varillas', v.num_varillas),
            si(potSi, c('Cantidad de potencial', v.pot_cantidad, 3)),
            si(potSi, c('Fase de conexión', v.fase_conexion, 3)),
          ]),
        },
        {
          tipo: 'datos',
          subtitulo: 'Resistencia de aterrizaje (ohm)',
          cols: 3,
          campos: [c('Control', v.ater_control), c('Restaurador', v.ater_restaurador), c('Otros', v.ater_otros)],
        },
        {
          tipo: 'textos',
          textos: [
            ['Observación del estado físico', texto(v.obs_estado_fisico)],
            ['Observación de la alimentación', texto(v.obs_potencial)],
          ],
        },
      ],
    },
  ];
  // Bloques sin contenido (p. ej. sin descripción de alarma) no se dibujan.
  return secciones.map((s) => ({
    ...s,
    bloques: s.bloques.filter((b) => (b.tipo === 'textos' ? b.textos.some(([, t]) => t) : b.campos.length > 0)),
  }));
}
