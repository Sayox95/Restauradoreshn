/** Datos de prueba: una visita completa y válida, y catálogos mínimos. */
import type { VisitaEntrada } from '../shared/visitas';

/** PNG de 1×1 (firma). */
export const FIRMA_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
/** Inicio mínimo de un JPEG y de un PDF (el servidor valida el formato por sus primeros bytes). */
export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1]);
export const PDF = new TextEncoder().encode('%PDF-1.4\n%prueba\n');

export function visitaCompleta(extra: Partial<VisitaEntrada> = {}): VisitaEntrada {
  return {
    visita_num: 'HV-20261101-080000',
    fecha_visita: '2026-11-01',
    hora_llegada: '08:00',
    hora_salida: '10:30',
    tipo_visita: 'Visita 1',
    codigo_energis: '302496',
    circuito: 'BER-L207',
    ubicacion: 'Barandillas',
    zona: 'Noroccidente',
    sector: 'San Pedro Sula',
    subestacion: 'Bermejo',
    latitud: 15.5169,
    longitud: -88.0167,
    gen_distribuida: 'NO',
    serie_recon: 'SR-1',
    serie_control: 'SC-1',
    medio_extincion: 'Vacío',
    has_modem1: 'NO',
    has_modem2: 'NO',
    alarma_presente: 'NO',
    medicion_ac: 120,
    medicion_bat: 26.5,
    medicion_cargador: 27,
    battery_test: 'OK',
    cambio_baterias: 'NO',
    corr_ia: 40,
    corr_ib: 41,
    corr_ic: 39,
    corr_in: 2,
    gabinete: 'OK',
    borneras: 'OK',
    ater_rest_state: 'OK',
    ater_ctrl_state: 'OK',
    cable_tierra: 'OK',
    num_varillas: 2,
    ater_control: 4.5,
    ater_restaurador: 3.9,
    tipo_cuchilla: 'Cuchilla Monopolar',
    estado_cuchillas: 'OK',
    num_cuchillas: 3,
    pararrayos: 'OK',
    num_pararrayos: 3,
    tiene_potencial: 'NO',
    alimentado_acometida: 'SI',
    personal: [{ usuario_id: 1, nombre: 'Mauricio Cerros', cargo: 'Técnico SCADA' }],
    firma_responsable: 'Mauricio Cerros',
    firma_img: FIRMA_PNG,
    num_fotos: 1,
    capturado_en: '2026-11-01T16:30:00.000Z',
    ...extra,
  };
}
