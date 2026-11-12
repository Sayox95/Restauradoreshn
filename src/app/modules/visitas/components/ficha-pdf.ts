/**
^ * PDF de la ficha de inspección (excepción E3: se genera en la app porque no hay formato oficial seriado;
 * la base es la fuente oficial). Diseño compacto en 2 páginas: página 1 el equipo, página 2 materiales,
 * fotos (2 × 2), observaciones, personal y firma. Títulos que no quedan solos al final de una página,
 * fotos sin deformar y firma en su recuadro.
 *
 * El dibujo es el de la ficha validada con el área usuaria; `adaptar` traduce los datos de la visita
 * a los nombres que usa.
 */
import type { Visita } from '@shared/visitas';

export interface FotoFicha {
  /** Copia reducida (data URL JPEG) generada en el navegador; el original va a R2 aparte (E2). */
  base64: string;
  observacion: string | null;
}

const CAMBIOS_NOMBRE: Record<string, string> = {
  circuito: 'codigoCircuito',
  ubicacion: 'nombreUbicacion',
  marca_reconectador: 'marcaReconectador',
  ajuste_activo: 'grupoActivo',
  medicion_ac: 'medicionAC',
  corr_ia: 'corrIA',
  corr_ib: 'corrIB',
  corr_ic: 'corrIC',
  corr_in: 'corrIN',
  materiales: 'materialesUtilizados',
};
const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** Datos de la visita → nombres de la ficha. */
function adaptar(v: Visita, fotos: FotoFicha[]): Record<string, any> {
  const d: Record<string, any> = {};
  for (const [k, valor] of Object.entries(v)) d[CAMBIOS_NOMBRE[k] ?? camel(k)] = valor ?? '';
  d.hasModem1 = v.has_modem1 === 'SI';
  d.hasModem2 = v.has_modem2 === 'SI';
  d.tableroMarca = v.marca_reconectador ?? '';
  d.firmaImg = v.firma_img ?? '';
  d.fotografias = fotos;
  return d;
}

/** Logo de la empresa en blanco (para la franja azul del encabezado). */
let logoCache: string | null = null;
async function logoBlanco(): Promise<string | null> {
  if (logoCache) return logoCache;
  try {
    const r = await fetch('/logo.png');
    if (!r.ok) return null;
    const url = URL.createObjectURL(await r.blob());
    logoCache = await new Promise<string | null>((ok) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext('2d')!;
        ctx.filter = 'brightness(0) invert(1)';
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        ok(cv.toDataURL('image/png'));
      };
      img.onerror = () => ok(null);
      img.src = url;
    });
    return logoCache;
  } catch {
    return null;
  }
}

/** Genera la ficha en PDF. */
export async function generarFicha(v: Visita, fotosFicha: FotoFicha[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const d = adaptar(v, fotosFicha);
  const logoBase64 = await logoBlanco();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const PW = 215.9,
    PH = 279.4;
  const ML = 12,
    MR = 12,
    MT = 12;
  let y = MT;

  // ── Paleta de colores ──
  type Color = [number, number, number];
  interface Celda {
    l: string;
    v: unknown;
    s?: number;
  }
  const NAVY: Color = [11, 31, 58];
  const BLUE: Color = [21, 101, 192];
  const ACCENT: Color = [245, 158, 11];
  const OK: Color = [22, 163, 74];
  const NOK: Color = [220, 38, 38];
  const MUTED: Color = [100, 116, 139];
  const BGROW: Color = [241, 245, 249];
  const WHITE: Color = [255, 255, 255];
  const BORDER: Color = [209, 217, 230];
  const CW = PW - ML - MR; // ancho útil

  // ── Auxiliares de dibujo ──
  const setFont = (size: number, style = 'normal', color: Color | null = null) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    if (color) doc.setTextColor(...color);
    else doc.setTextColor(30, 41, 59);
  };
  const rect = (x: number, yy: number, w: number, h: number, fill: Color | null, stroke: Color | null = null, r = 0) => {
    if (fill) doc.setFillColor(...fill);
    if (stroke) {
      doc.setDrawColor(...stroke);
      doc.setLineWidth(0.3);
    } else {
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0);
    }
    const estilo = fill && stroke ? 'FD' : fill ? 'F' : 'D';
    if (r > 0) doc.roundedRect(x, yy, w, h, r, r, estilo);
    else doc.rect(x, yy, w, h, estilo);
  };
  const line = (x1: number, yy1: number, x2: number, yy2: number, color: Color = BORDER, lw = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw);
    doc.line(x1, yy1, x2, yy2);
  };
  const txt = (t: unknown, x: number, yy: number, opts: { align?: 'left' | 'center' | 'right' } = {}) => {
    doc.text(String(t || '—'), x, yy, opts);
  };
  const checkPage = (needed = 10) => {
    if (y + needed > PH - 14) {
      doc.addPage();
      y = MT;
    }
  };
  // Numeración automática: las secciones vacías (p. ej. sin materiales) no dejan saltos
  let numSeccion = 0;

  // ══════════════════════════════════════════════════════
  //  SISTEMA DE MAQUETACIÓN (compacto: la ficha cabe en 2 páginas)
  //  · grid: datos en celdas de hasta 6 columnas (etiqueta pequeña arriba, valor abajo).
  //  · estados: respuestas SI/NO, OK/NOK, ON/OFF en una sola línea («Gabinete ● OK»).
  //  Página 1: el equipo. Página 2: materiales, fotos, observaciones, personal y firma.
  // ══════════════════════════════════════════════════════
  const TXT: Color = [30, 41, 59];
  const SUBBG: Color = [232, 240, 254];
  const CELL_H = 9;
  const ESTADO_H = 6;
  const vacio = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
  const ajustar = (t: unknown, w: number): string => doc.splitTextToSize(String(t), w)[0] || '';
  const tono = (v: unknown): Color => {
    const t = String(v || '').toUpperCase();
    return ['SI', 'ON', 'OK'].includes(t) ? OK : ['NO', 'OFF', 'NOK'].includes(t) ? NOK : BLUE;
  };

  // Títulos de sección y subtítulos quedan "pendientes" y se dibujan junto
  // con el bloque que los sigue: nunca quedan solos al final de una página.
  let _secPendiente: string | null = null,
    _subPendiente: string | null = null;
  const seccion = (titulo: string) => {
    _secPendiente = titulo;
  };
  const subtitulo = (t: string) => {
    _subPendiente = t;
  };
  const altoPendiente = () => (_secPendiente ? 7 : 0) + (_subPendiente ? 4.2 : 0);
  const dibujarSubtitulo = () => {
    if (_secPendiente) {
      rect(ML, y, CW, 5.6, NAVY, null, 1);
      rect(ML, y, 1.4, 5.6, ACCENT);
      setFont(7.6, 'bold', WHITE);
      txt(++numSeccion + '  ·  ' + _secPendiente, ML + 4, y + 3.9);
      y += 7;
      _secPendiente = null;
    }
    if (_subPendiente) {
      rect(ML, y, CW, 4.2, SUBBG);
      setFont(6.2, 'bold', BLUE);
      txt(_subPendiente.toUpperCase(), ML + 2.5, y + 3);
      y += 4.2;
      _subPendiente = null;
    }
  };
  // Para bloques propios (tablas, fotos, firma): reservar espacio y dibujar títulos
  const abrir = (alto: number) => {
    checkPage(altoPendiente() + alto);
    dibujarSubtitulo();
  };

  /** Reparte celdas en filas de `cols` columnas; la última celda de cada fila se estira. */
  const enFilas = (items: Celda[], cols: number) => {
    const filas: Celda[][] = [];
    let fila: Celda[] = [],
      usadas = 0;
    items.forEach((it) => {
      const s = Math.min(it.s || 1, cols);
      if (usadas + s > cols) {
        filas.push(fila);
        fila = [];
        usadas = 0;
      }
      fila.push({ ...it, s });
      usadas += s;
    });
    if (fila.length) filas.push(fila);
    filas.forEach((f) => {
      const total = f.reduce((a, it) => a + (it.s ?? 1), 0);
      f[f.length - 1]!.s = (f[f.length - 1]!.s ?? 1) + cols - total;
    });
    return filas;
  };

  // Datos: etiqueta pequeña arriba y valor abajo.
  const grid = (lista: (Celda | null)[], cols = 6) => {
    const items = lista.filter((x): x is Celda => !!x);
    if (!items.length) return;
    const cw = CW / cols;
    const filas = enFilas(items, cols);
    checkPage(altoPendiente() + Math.min(filas.length, 3) * CELL_H);
    dibujarSubtitulo();
    filas.forEach((f, fi) => {
      checkPage(CELL_H);
      let x = ML;
      f.forEach((it) => {
        const w = cw * (it.s ?? 1);
        rect(x, y, w, CELL_H, fi % 2 === 0 ? BGROW : WHITE);
        if (x > ML) line(x, y + 1.2, x, y + CELL_H - 1.2, BORDER, 0.2);
        setFont(5.6, 'normal', MUTED);
        txt(ajustar(String(it.l).toUpperCase(), w - 3.5), x + 2, y + 3.2);
        if (vacio(it.v)) {
          setFont(8, 'normal', [148, 163, 184]);
          txt('—', x + 2, y + 7.4);
        } else {
          setFont(8, 'bold', TXT);
          txt(ajustar(it.v, w - 4), x + 2, y + 7.4);
        }
        x += w;
      });
      line(ML, y + CELL_H, ML + CW, y + CELL_H, BORDER, 0.2);
      y += CELL_H;
    });
    y += 1.8;
  };

  // Estados: «Etiqueta ● VALOR» en una línea; punto y valor en verde (SI/OK/ON) o rojo (NO/NOK/OFF).
  const estados = (lista: (Celda | null)[], cols = 4) => {
    const items = lista.filter((x): x is Celda => !!x && !vacio(x.v));
    if (!items.length) return;
    const cw = CW / cols;
    const filas = enFilas(items, cols);
    checkPage(altoPendiente() + Math.min(filas.length, 3) * ESTADO_H);
    dibujarSubtitulo();
    filas.forEach((f, fi) => {
      checkPage(ESTADO_H);
      let x = ML;
      f.forEach((it) => {
        const w = cw * (it.s ?? 1);
        rect(x, y, w, ESTADO_H, fi % 2 === 0 ? BGROW : WHITE);
        if (x > ML) line(x, y + 1, x, y + ESTADO_H - 1, BORDER, 0.2);
        // «Etiqueta  ● VALOR»: el valor va junto a su campo. Solo SI/NO, OK/NOK y ON/OFF llevan punto de color.
        const valor = String(it.v);
        const esEstado = ['SI', 'NO', 'OK', 'NOK', 'ON', 'OFF'].includes(valor.toUpperCase());
        setFont(7, 'normal', TXT);
        const etiqueta = ajustar(it.l, w * 0.62);
        txt(etiqueta, x + 2, y + 4.1);
        let vx = x + 2 + doc.getTextWidth(etiqueta) + 2.5;
        if (esEstado) {
          const c = tono(valor);
          doc.setFillColor(...c);
          doc.circle(vx + 0.9, y + 3.05, 0.9, 'F');
          vx += 2.8;
          setFont(7.6, 'bold', c);
          txt(valor.toUpperCase(), vx, y + 4.1);
        } else {
          setFont(7.6, 'bold', TXT);
          txt(ajustar(valor, x + w - vx - 2), vx, y + 4.1);
        }
        x += w;
      });
      line(ML, y + ESTADO_H, ML + CW, y + ESTADO_H, BORDER, 0.2);
      y += ESTADO_H;
    });
    y += 1.8;
  };

  // Recuadro de texto largo (observaciones, descripción de alarma, etc.)
  const textoLargo = (etiqueta: string, texto: unknown, tono2 = 'normal') => {
    if (vacio(texto)) return;
    setFont(7.6, 'normal');
    const lineas = doc.splitTextToSize(String(texto), CW - 6);
    let i = 0,
      primera = true;
    checkPage(altoPendiente() + 10);
    dibujarSubtitulo();
    while (i < lineas.length) {
      checkPage(10);
      const cabe = Math.max(1, Math.floor((PH - 14 - y - 6) / 3.6));
      const trozo = lineas.slice(i, i + cabe);
      const h = 5 + trozo.length * 3.6 + 1;
      const fondo: Color = tono2 === 'aviso' ? [255, 251, 235] : BGROW;
      const borde = tono2 === 'aviso' ? ACCENT : BORDER;
      rect(ML, y, CW, h, fondo, borde, 1);
      setFont(5.6, 'normal', tono2 === 'aviso' ? [146, 64, 14] : MUTED);
      txt((etiqueta + (primera ? '' : ' (cont.)')).toUpperCase(), ML + 2.5, y + 3.4);
      setFont(7.6, 'normal', TXT);
      doc.text(trozo, ML + 2.5, y + 7.2);
      y += h + 1.8;
      i += trozo.length;
      primera = false;
    }
  };

  // Varias observaciones cortas lado a lado (si alguna es larga, cada una va en su propio recuadro).
  const observacionesJuntas = (lista: [string, unknown][]) => {
    const con = lista.filter(([, t]) => !vacio(t));
    if (con.length < 2) return con.forEach(([e, t]) => textoLargo(e, t));
    const gap = 3,
      w = (CW - gap * (con.length - 1)) / con.length;
    setFont(7.6, 'normal');
    const lineas = con.map(([, t]) => doc.splitTextToSize(String(t), w - 5) as string[]);
    if (lineas.some((l) => l.length > 6)) return con.forEach(([e, t]) => textoLargo(e, t));
    const h = 5 + Math.max(...lineas.map((l) => l.length)) * 3.6 + 1;
    checkPage(altoPendiente() + h);
    dibujarSubtitulo();
    con.forEach(([e], i) => {
      const x = ML + i * (w + gap);
      rect(x, y, w, h, BGROW, BORDER, 1);
      setFont(5.6, 'normal', MUTED);
      txt(e.toUpperCase(), x + 2.5, y + 3.4);
      setFont(7.6, 'normal', TXT);
      doc.text(lineas[i]!, x + 2.5, y + 7.2);
    });
    y += h + 1.8;
  };

  const esCooperPdf = String(d.marcaReconectador || '')
    .toUpperCase()
    .includes('COOPER');

  // ══════════════════════════════════════════════════════
  //  ENCABEZADO
  // ══════════════════════════════════════════════════════
  rect(0, 0, PW, 22, NAVY);
  rect(0, 0, 3, 22, ACCENT);
  if (logoBase64) {
    try {
      const pr = doc.getImageProperties(logoBase64);
      const lh = 10,
        lw = Math.min(32, (lh * pr.width) / pr.height);
      doc.addImage(logoBase64, 'PNG', 8, (22 - lh) / 2, lw, lh, '', 'FAST');
    } catch {
      // sin logo: el encabezado sigue legible
    }
  }
  line(44, 5, 44, 17, [60, 85, 120], 0.3);
  setFont(13, 'bold', WHITE);
  txt('HOJA DE INSPECCIÓN', 48, 10.5);
  setFont(7.2, 'normal', ACCENT);
  txt('Inspección de Restauradores · SCADA Distribución', 48, 15.5);
  const nvW = 54,
    nvX = PW - MR - nvW;
  rect(nvX, 4.5, nvW, 13, WHITE, null, 1.5);
  setFont(5.8, 'bold', MUTED);
  txt('FOLIO', nvX + nvW / 2, 8.4, { align: 'center' });
  setFont(10, 'bold', NAVY);
  txt(d.visitaNum || '—', nvX + nvW / 2, 14.4, { align: 'center' });
  y = 25;

  // Franja de datos de la inspección
  const rapidos = [
    ['Fecha', d.fechaVisita],
    ['Tipo de visita', d.tipoVisita],
    ['Llegada', d.horaLlegada],
    ['Salida', d.horaSalida],
    ['Energis', d.codigoEnergis],
    ['Circuito', d.codigoCircuito],
  ];
  const qw = CW / rapidos.length;
  rect(ML, y, CW, 10, WHITE, BORDER, 1.2);
  rapidos.forEach(([l, v], i) => {
    const cx = ML + qw * i + qw / 2;
    if (i > 0) line(ML + qw * i, y + 2, ML + qw * i, y + 8, BORDER, 0.2);
    setFont(5.6, 'normal', MUTED);
    txt(l.toUpperCase(), cx, y + 3.6, { align: 'center' });
    setFont(8.4, 'bold', NAVY);
    txt(ajustar(vacio(v) ? '—' : v, qw - 3), cx, y + 8.2, { align: 'center' });
  });
  y += 13;

  // ══════════════════════════════════════════════════════
  //  PÁGINA 1 · EL EQUIPO
  // ══════════════════════════════════════════════════════
  seccion('DATOS DEL RESTAURADOR');
  const coord = !vacio(d.latitud) || !vacio(d.longitud) ? `${d.latitud || '—'} , ${d.longitud || '—'}` : '';
  grid([
    { l: 'Ubicación', v: d.nombreUbicacion, s: 2 },
    { l: 'Subestación', v: d.subestacion },
    { l: 'Zona', v: d.zona },
    { l: 'Sector', v: d.sector, s: 2 },
    { l: 'Coordenadas (lat , long)', v: coord, s: 2 },
    { l: 'Generación distribuida', v: d.genDistribuida },
  ]);

  seccion('RECONECTADOR');
  grid([
    { l: 'Tipo', v: d.tipoRecon },
    { l: 'Marca', v: d.marcaReconectador },
    { l: 'Modelo', v: d.modeloRecon },
    { l: 'Medio de extinción', v: d.medioExtincion },
    { l: 'Serie reconectador', v: d.serieRecon, s: 2 },
    { l: 'Tipo de control', v: d.tipoControl },
    { l: 'Serie control', v: d.serieControl, s: 2 },
    esCooperPdf ? { l: 'Firmware / Proview', v: d.proviewControl } : null,
  ]);
  if (esCooperPdf)
    estados([
      { l: 'Terminal p/sensores V', v: d.termSensV },
      { l: 'Manguera sensores V', v: d.manguSensV },
      { l: 'Terminal manguera aux', v: d.termManguAux },
      { l: 'Manguera auxiliar', v: d.manguAux },
    ]);

  seccion('MÓDEMS Y COMUNICACIONES');
  [1, 2].forEach((n) => {
    if (!d['hasModem' + n]) return;
    subtitulo('Módem ' + n);
    const ant = d['antenaModem' + n],
      tAnt = d['tipoAntena' + n];
    grid([
      { l: 'Tipo', v: d['tipoModem' + n] },
      { l: 'Marca', v: d['marcaModem' + n] },
      { l: 'Modelo', v: d['modeloModem' + n] },
      { l: 'Serie', v: d['serieModem' + n] },
      { l: 'Antena', v: ant ? ant + (tAnt ? ' · ' + tAnt : '') : '' },
      { l: 'Tecnología', v: d['tecModem' + n] },
    ]);
  });
  if (!d.hasModem1 || !d.hasModem2) estados([!d.hasModem1 ? { l: 'Módem 1', v: 'NO' } : null, !d.hasModem2 ? { l: 'Módem 2', v: 'NO' } : null]);

  // Tablero, alarma, batería y corrientes: una sola sección, como en la app
  seccion('TABLERO Y MEDICIONES');
  const tablero = Object.entries(d.tableroCampos || {}).filter(([, v]) => v);
  if (tablero.length || d.grupoActivo) {
    subtitulo('Tablero de control' + (d.tableroMarca ? ' · ' + String(d.tableroMarca).toUpperCase() : ''));
    estados([...tablero.map(([l, v]) => ({ l, v })), d.grupoActivo ? { l: 'Grupo activo', v: d.grupoActivo } : null]);
  }
  subtitulo('Alarma');
  estados([{ l: 'Alarma presente', v: d.alarmaPresente }]);
  textoLargo('Descripción de la alarma', d.descAlarma);
  subtitulo('Batería');
  estados(
    [
      { l: 'Battery test', v: d.batteryTest },
      { l: 'Cambio de baterías', v: d.cambioBaterias },
      d.cambioBaterias === 'SI' ? { l: 'Batería instalada', v: d.tipoBateria } : null,
    ],
    3,
  );
  grid(
    [
      { l: 'Voltaje AC (V)', v: d.medicionAC },
      { l: 'Voltaje baterías (V)', v: d.medicionBat },
      { l: 'Voltaje cargador (V)', v: d.medicionCargador },
    ],
    3,
  );
  subtitulo('Corrientes instantáneas (A)');
  grid(
    [
      { l: 'IA', v: d.corrIA },
      { l: 'IB', v: d.corrIB },
      { l: 'IC', v: d.corrIC },
      { l: 'IN (neutro)', v: d.corrIN },
    ],
    4,
  );

  seccion('ESTADO FÍSICO');
  const potSi = d.tienePotencial === 'SI';
  estados([
    { l: 'Gabinete', v: d.gabinete },
    { l: 'Borneras', v: d.borneras },
    { l: 'Aterrizaje restaurador', v: d.aterRestState },
    { l: 'Aterrizaje control', v: d.aterCtrlState },
    { l: 'Cable de tierra', v: d.cableTierra },
    { l: 'Estado cuchillas', v: d.estadoCuchillas },
    { l: 'Pararrayos', v: d.pararrayos },
    { l: 'Tiene potencial', v: d.tienePotencial },
    potSi ? { l: 'Pararrayos potencial', v: d.potPararrayos } : null,
    potSi ? { l: 'Cuchilla potencial', v: d.potCuchilla } : null,
    potSi ? { l: 'Aterrizaje potencial', v: d.aterPotState } : null,
    d.tienePotencial === 'NO' ? { l: 'Alimentado por acometida', v: d.alimentadoAcometida } : null,
  ]);
  grid([
    { l: 'Tipo de cuchilla', v: d.tipoCuchilla, s: 3 },
    { l: 'N° cuchillas', v: d.numCuchillas },
    { l: 'N° pararrayos', v: d.numPararrayos },
    { l: 'N° varillas', v: d.numVarillas },
    potSi ? { l: 'Cantidad de potencial', v: d.potCantidad, s: 3 } : null,
    potSi ? { l: 'Fase de conexión', v: d.faseConexion, s: 3 } : null,
  ]);
  // Sin «Ω»: la fuente del PDF no lo tiene (se veía desarmado).
  subtitulo('Resistencia de aterrizaje (ohm)');
  grid(
    [
      { l: 'Control', v: d.aterControl },
      { l: 'Restaurador', v: d.aterRestaurador },
      { l: 'Otros', v: d.aterOtros },
    ],
    3,
  );
  observacionesJuntas([
    ['Observación del estado físico', d.obsEstadoFisico],
    ['Observación de la alimentación', d.obsPotencial],
  ]);

  // ══════════════════════════════════════════════════════
  //  PÁGINA 2 · LO QUE SE HIZO Y QUIÉN
  // ══════════════════════════════════════════════════════
  if (doc.getNumberOfPages() === 1) {
    doc.addPage();
    y = MT;
  }

  const mats = d.materialesUtilizados || [];
  if (mats.length > 0) {
    seccion('MATERIALES UTILIZADOS');
    abrir(5.5 + 6 * Math.min(mats.length, 3));
    const cols = [
      { l: 'Código', w: 0.13 },
      { l: 'Descripción', w: 0.43 },
      { l: 'Unidad', w: 0.09, c: 1 },
      { l: 'Cantidad', w: 0.11, c: 1 },
      { l: 'Motivo', w: 0.24 },
    ];
    const encabezado = () => {
      rect(ML, y, CW, 5.5, BLUE, null, 1);
      let mx = ML;
      cols.forEach((c) => {
        setFont(6.2, 'bold', WHITE);
        txt(c.l.toUpperCase(), c.c ? mx + (CW * c.w) / 2 : mx + 2.5, y + 3.8, c.c ? { align: 'center' } : {});
        mx += CW * c.w;
      });
      y += 5.5;
    };
    encabezado();
    mats.forEach((m: any, idx: number) => {
      if (y + 6.5 > PH - 14) {
        checkPage(20);
        encabezado();
      }
      rect(ML, y, CW, 6, idx % 2 === 0 ? BGROW : WHITE);
      line(ML, y + 6, ML + CW, y + 6, BORDER, 0.2);
      let mx = ML;
      [m.codigo, m.desc, m.unidad, m.cant, m.motivo].forEach((v, ci) => {
        const c = cols[ci]!;
        setFont(7.4, ci === 1 ? 'bold' : 'normal', ci === 0 ? BLUE : TXT);
        const t = ajustar(vacio(v) ? '—' : v, CW * c.w - 4);
        txt(t, c.c ? mx + (CW * c.w) / 2 : mx + 2.5, y + 4.1, c.c ? { align: 'center' } : {});
        mx += CW * c.w;
      });
      y += 6;
    });
    y += 1.8;
    textoLargo('Observación de materiales', d.obsMateriales, 'aviso');
  }

  // Fotografías: cuadrícula de 2 × 2 (las 4 caben en media página); con 1 o 2 fotos van más grandes
  // y una sola queda centrada
  const fotos = (d.fotografias || []).filter((f: FotoFicha) => f && f.base64);
  if (fotos.length > 0) {
    const FW = (CW - 4) / 2,
      FH = fotos.length <= 2 ? 80 : 50,
      CAP = 5.5;
    seccion('REGISTRO FOTOGRÁFICO');
    abrir(FH + CAP + 2);
    for (let i = 0; i < fotos.length; i += 2) {
      checkPage(FH + CAP + 2);
      const enFila = fotos.slice(i, i + 2);
      const x0 = enFila.length === 1 && fotos.length === 1 ? ML + (CW - FW) / 2 : ML;
      enFila.forEach((foto: FotoFicha, j: number) => {
        const x = x0 + j * (FW + 4);
        rect(x, y, FW, FH + CAP, WHITE, BORDER, 1.2);
        try {
          const pr = doc.getImageProperties(foto.base64);
          const k = Math.min((FW - 2.4) / pr.width, (FH - 2.4) / pr.height);
          const iw = pr.width * k,
            ih = pr.height * k;
          doc.addImage(foto.base64, 'JPEG', x + (FW - iw) / 2, y + 1.2 + (FH - 2.4 - ih) / 2, iw, ih, '', 'FAST');
        } catch {
          setFont(7.6, 'normal', MUTED);
          txt('Imagen no disponible', x + FW / 2, y + FH / 2, { align: 'center' });
        }
        line(x, y + FH, x + FW, y + FH, BORDER, 0.2);
        setFont(6.8, 'bold', NAVY);
        txt('Foto ' + (i + j + 1), x + 2.2, y + FH + 3.8);
        if (foto.observacion) {
          setFont(6.8, 'normal', MUTED);
          txt(ajustar(foto.observacion, FW - 16), x + 13, y + FH + 3.8);
        }
      });
      y += FH + CAP + 3;
    }
  }

  // Observaciones generales, personal y firma: al final, lado a lado con la firma
  const personal = d.personal || [];
  const filaP = 6.2,
    cabP = 5.5;
  setFont(7.6, 'normal');
  const gap = 4,
    persW = CW * 0.6 - gap / 2,
    firmaW = CW - persW - gap,
    firmaX = ML + persW + gap;
  const lineasObs = vacio(d.obsGenerales) ? [] : (doc.splitTextToSize(String(d.obsGenerales), persW - 5) as string[]);
  const altoObs = lineasObs.length ? 5 + lineasObs.length * 3.6 + 2 : 0;
  const altoTabla = cabP + Math.max(1, personal.length) * filaP;
  const altoBloque = Math.max(36, altoObs + altoTabla);
  seccion('OBSERVACIONES, PERSONAL Y FIRMA');
  abrir(altoBloque);
  const y0 = y;
  let yy = y0;
  if (lineasObs.length) {
    rect(ML, yy, persW, altoObs - 2, BGROW, BORDER, 1);
    setFont(5.6, 'normal', MUTED);
    txt('OBSERVACIONES GENERALES', ML + 2.5, yy + 3.4);
    setFont(7.6, 'normal', TXT);
    doc.text(lineasObs, ML + 2.5, yy + 7.2);
    yy += altoObs;
  }
  rect(ML, yy, persW, y0 + altoBloque - yy, WHITE, BORDER, 1.2);
  rect(ML, yy, persW, cabP, BLUE, null, 1.2);
  setFont(6.2, 'bold', WHITE);
  txt('NOMBRE', ML + 2.5, yy + 3.8);
  txt('CARGO', ML + persW * 0.56, yy + 3.8);
  txt('N° EMP.', ML + persW * 0.84, yy + 3.8);
  personal.forEach((p: any, i: number) => {
    const ry = yy + cabP + i * filaP;
    if (i % 2 === 0) rect(ML + 0.3, ry, persW - 0.6, filaP, BGROW);
    setFont(7.6, 'bold', TXT);
    txt(ajustar(p.nombre || '—', persW * 0.54 - 3), ML + 2.5, ry + 4.2);
    setFont(7, 'normal', MUTED);
    txt(ajustar(p.cargo || '—', persW * 0.28 - 2), ML + persW * 0.56, ry + 4.2);
    setFont(7, 'normal', TXT);
    txt(ajustar(p.id || '—', persW * 0.16 - 2), ML + persW * 0.84, ry + 4.2);
  });
  rect(firmaX, y0, firmaW, altoBloque, BGROW, BORDER, 1.2);
  setFont(5.8, 'bold', MUTED);
  txt('FIRMA DEL RESPONSABLE', firmaX + firmaW / 2, y0 + 4, { align: 'center' });
  const fTop = y0 + 6,
    fBot = y0 + altoBloque - 9;
  if (d.firmaImg && String(d.firmaImg).startsWith('data:image')) {
    try {
      const pr = doc.getImageProperties(d.firmaImg);
      const k = Math.min((firmaW - 8) / pr.width, (fBot - fTop) / pr.height);
      const iw = pr.width * k,
        ih = pr.height * k;
      doc.addImage(d.firmaImg, 'PNG', firmaX + (firmaW - iw) / 2, fTop + (fBot - fTop - ih) / 2, iw, ih, '', 'FAST');
    } catch {
      // firma ilegible: queda el recuadro con el nombre
    }
  } else {
    setFont(7.6, 'italic', MUTED);
    txt('Sin firma digital', firmaX + firmaW / 2, (fTop + fBot) / 2, { align: 'center' });
  }
  line(firmaX + 6, fBot + 1, firmaX + firmaW - 6, fBot + 1, MUTED, 0.3);
  setFont(8, 'bold', NAVY);
  txt(ajustar(d.firmaResponsable || '—', firmaW - 8), firmaX + firmaW / 2, fBot + 5.5, { align: 'center' });
  y = y0 + altoBloque + 4;

  // ══════════════════════════════════════════════════════
  //  PIE DE PÁGINA EN TODAS LAS PÁGINAS (se dibuja una vez, al final)
  // ══════════════════════════════════════════════════════
  const paginas = doc.getNumberOfPages();
  const generado = 'Generado: ' + new Date().toLocaleString('es-HN');
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    rect(0, PH - 9, PW, 9, NAVY);
    setFont(6.2, 'normal', [150, 170, 200]);
    txt('Hoja de inspección · ' + (d.visitaNum || '') + ' · ' + (d.fechaVisita || ''), ML, PH - 3.6);
    txt(generado, PW / 2, PH - 3.6, { align: 'center' });
    txt('Pág. ' + i + ' / ' + paginas, PW - MR, PH - 3.6, { align: 'right' });
  }

  return doc.output('blob');
}
