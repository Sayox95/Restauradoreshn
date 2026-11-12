/**
 * PDF de la ficha de visita (excepción E3: se genera en la app porque no hay formato oficial seriado;
 * la base es la fuente oficial). Diseño: grilla de celdas de igual altura, títulos que no quedan solos
 * al final de una página, fotos sin deformar y firma en su recuadro.
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
      drawPageFooter();
    }
  };
  // Numeración automática: las secciones vacías (p. ej. sin módems) no dejan saltos
  let numSeccion = 0;

  // ══════════════════════════════════════════════════════
  //  SISTEMA DE MAQUETACIÓN
  //  Todo se dibuja en celdas de una grilla de 4 columnas con la misma
  //  altura: etiqueta arriba, valor (texto o pastilla de color) abajo.
  //  La última celda de cada fila se estira para no dejar huecos.
  // ══════════════════════════════════════════════════════
  const TXT: Color = [30, 41, 59];
  const SUBBG: Color = [232, 240, 254];
  const CELL_H = 11;
  const vacio = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
  const esToggle = (v: unknown) =>
    ['SI', 'NO', 'OK', 'NOK', 'ON', 'OFF'].includes(
      String(v || '')
        .trim()
        .toUpperCase(),
    );
  const ajustar = (t: unknown, w: number): string => doc.splitTextToSize(String(t), w)[0] || '';

  const pastilla = (val: unknown, x: number, yy: number) => {
    const v = String(val || '').toUpperCase();
    const pos = ['SI', 'ON', 'OK'].includes(v),
      neg = ['NO', 'OFF', 'NOK'].includes(v);
    rect(x, yy, 15, 5, pos ? OK : neg ? NOK : BLUE, null, 2.4);
    setFont(6.8, 'bold', WHITE);
    txt(v, x + 7.5, yy + 3.6, { align: 'center' });
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
  const altoPendiente = () => (_secPendiente ? 8.5 : 0) + (_subPendiente ? 5.2 : 0);
  const dibujarSubtitulo = () => {
    if (_secPendiente) {
      rect(ML, y, CW, 7, NAVY, null, 1);
      rect(ML, y, 1.6, 7, ACCENT);
      setFont(8.5, 'bold', WHITE);
      txt(++numSeccion + '  ·  ' + _secPendiente, ML + 4.5, y + 4.9);
      y += 8.5;
      _secPendiente = null;
    }
    if (_subPendiente) {
      rect(ML, y, CW, 5.2, SUBBG);
      setFont(6.8, 'bold', BLUE);
      txt(_subPendiente.toUpperCase(), ML + 2.5, y + 3.7);
      y += 5.2;
      _subPendiente = null;
    }
  };
  // Para bloques propios (tablas, fotos, firma): reservar espacio y dibujar títulos
  const abrir = (alto: number) => {
    checkPage(altoPendiente() + alto);
    dibujarSubtitulo();
  };

  // items: [{l: etiqueta, v: valor, s: columnas que ocupa}]
  const grid = (lista: (Celda | null)[], cols = 4) => {
    const items = lista.filter((x): x is Celda => !!x);
    if (!items.length) return;
    const cw = CW / cols;
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
    // Grupos pequeños (hasta 4 filas) no se parten entre páginas
    const alto = altoPendiente() + Math.min(filas.length, 4) * CELL_H;
    checkPage(alto);
    dibujarSubtitulo();
    filas.forEach((f, fi) => {
      const total = f.reduce((a, it) => a + (it.s ?? 1), 0);
      f[f.length - 1]!.s = (f[f.length - 1]!.s ?? 1) + cols - total; // estirar la última celda
      checkPage(CELL_H);
      let x = ML;
      f.forEach((it) => {
        const w = cw * (it.s ?? 1);
        rect(x, y, w, CELL_H, fi % 2 === 0 ? BGROW : WHITE);
        line(x, y + CELL_H, x + w, y + CELL_H, BORDER, 0.2);
        if (x > ML) line(x, y + 1.5, x, y + CELL_H - 1.5, BORDER, 0.2);
        setFont(6.2, 'normal', MUTED);
        txt(ajustar(String(it.l).toUpperCase(), w - 4), x + 2.5, y + 3.9);
        if (vacio(it.v)) {
          setFont(8.5, 'normal', [148, 163, 184]);
          txt('—', x + 2.5, y + 9.1);
        } else if (esToggle(it.v)) pastilla(it.v, x + 2.5, y + 5.2);
        else {
          setFont(8.6, 'bold', TXT);
          txt(ajustar(it.v, w - 5), x + 2.5, y + 9.1);
        }
        x += w;
      });
      y += CELL_H;
    });
    y += 2.5;
  };

  // Recuadro de texto largo (observaciones, descripción de alarma, etc.)
  const textoLargo = (etiqueta: string, texto: unknown, tono = 'normal') => {
    if (vacio(texto)) return;
    setFont(8.2, 'normal');
    const lineas = doc.splitTextToSize(String(texto), CW - 6);
    let i = 0,
      primera = true;
    checkPage(altoPendiente() + 12);
    dibujarSubtitulo();
    while (i < lineas.length) {
      checkPage(12);
      const cabe = Math.max(1, Math.floor((PH - 14 - y - 7) / 4.2));
      const trozo = lineas.slice(i, i + cabe);
      const h = 6 + trozo.length * 4.2 + 1.5;
      const fondo: Color = tono === 'aviso' ? [255, 251, 235] : BGROW;
      const borde = tono === 'aviso' ? ACCENT : BORDER;
      rect(ML, y, CW, h, fondo, borde, 1);
      setFont(6.2, 'normal', tono === 'aviso' ? [146, 64, 14] : MUTED);
      txt((etiqueta + (primera ? '' : ' (cont.)')).toUpperCase(), ML + 3, y + 4);
      setFont(8.2, 'normal', TXT);
      doc.text(trozo, ML + 3, y + 8.6);
      y += h + 2.5;
      i += trozo.length;
      primera = false;
    }
  };

  const esCooperPdf = String(d.marcaReconectador || '')
    .toUpperCase()
    .includes('COOPER');

  // ══════════════════════════════════════════════════════
  //  ENCABEZADO
  // ══════════════════════════════════════════════════════
  rect(0, 0, PW, 24, NAVY);
  rect(0, 0, 3, 24, ACCENT);
  if (logoBase64) {
    try {
      const pr = doc.getImageProperties(logoBase64);
      const lh = 11,
        lw = Math.min(34, (lh * pr.width) / pr.height);
      doc.addImage(logoBase64, 'PNG', 8, (24 - lh) / 2, lw, lh, '', 'FAST');
    } catch {
      // sin logo: el encabezado sigue legible
    }
  }
  line(46, 5, 46, 19, [60, 85, 120], 0.3);
  setFont(14, 'bold', WHITE);
  txt('HOJA DE INSPECCIÓN', 50, 11);
  setFont(7.5, 'normal', ACCENT);
  txt('Inspección de Restauradores · SCADA Distribución', 50, 16.5);
  // N° de visita: recuadro claro con buen contraste
  const nvW = 54,
    nvX = PW - MR - nvW;
  rect(nvX, 5, nvW, 14, WHITE, null, 1.5);
  setFont(6.2, 'bold', MUTED);
  txt('FOLIO', nvX + nvW / 2, 9.2, { align: 'center' });
  setFont(10.5, 'bold', NAVY);
  txt(d.visitaNum || '—', nvX + nvW / 2, 15.6, { align: 'center' });
  y = 28;

  // Franja de datos de la visita
  const rapidos = [
    ['Fecha', d.fechaVisita],
    ['Tipo de visita', d.tipoVisita],
    ['Llegada', d.horaLlegada],
    ['Salida', d.horaSalida],
    ['Energis', d.codigoEnergis],
    ['Circuito', d.codigoCircuito],
  ];
  const qw = CW / rapidos.length;
  rect(ML, y, CW, 11, WHITE, BORDER, 1.2);
  rapidos.forEach(([l, v], i) => {
    const cx = ML + qw * i + qw / 2;
    if (i > 0) line(ML + qw * i, y + 2, ML + qw * i, y + 9, BORDER, 0.2);
    setFont(6, 'normal', MUTED);
    txt(l.toUpperCase(), cx, y + 4, { align: 'center' });
    setFont(8.8, 'bold', NAVY);
    txt(ajustar(vacio(v) ? '—' : v, qw - 3), cx, y + 9, { align: 'center' });
  });
  y += 15;

  // ══════════════════════════════════════════════════════
  //  DATOS DEL RESTAURADOR
  // ══════════════════════════════════════════════════════
  seccion('DATOS DEL RESTAURADOR');
  const coord = !vacio(d.latitud) || !vacio(d.longitud) ? `${d.latitud || '—'} , ${d.longitud || '—'}` : '';
  grid([
    { l: 'Ubicación', v: d.nombreUbicacion, s: 2 },
    { l: 'Subestación', v: d.subestacion },
    { l: 'Zona', v: d.zona },
    { l: 'Sector', v: d.sector },
    { l: 'Coordenadas (lat , long)', v: coord, s: 2 },
    { l: 'Generación distribuida', v: d.genDistribuida },
  ]);

  // ══════════════════════════════════════════════════════
  //  RECONECTADOR
  // ══════════════════════════════════════════════════════
  seccion('RECONECTADOR');
  grid([
    { l: 'Tipo', v: d.tipoRecon },
    { l: 'Marca', v: d.marcaReconectador },
    { l: 'Modelo', v: d.modeloRecon },
    { l: 'Medio de extinción', v: d.medioExtincion },
    { l: 'Serie reconectador', v: d.serieRecon },
    { l: 'Tipo de control', v: d.tipoControl },
    { l: 'Serie control', v: d.serieControl },
    esCooperPdf ? { l: 'Firmware / Proview', v: d.proviewControl } : null,
  ]);
  if (esCooperPdf) {
    subtitulo('Mangueras extras');
    grid([
      { l: 'Terminal p/sensores V', v: d.termSensV },
      { l: 'Manguera sensores V', v: d.manguSensV },
      { l: 'Terminal manguera aux', v: d.termManguAux },
      { l: 'Manguera auxiliar', v: d.manguAux },
    ]);
  }

  // ══════════════════════════════════════════════════════
  //  MÓDEMS
  // ══════════════════════════════════════════════════════
  seccion('MÓDEMS Y COMUNICACIONES');
  [1, 2].forEach((n) => {
    const tiene = d['hasModem' + n];
    if (!tiene) return;
    subtitulo('Módem ' + n);
    const ant = d['antenaModem' + n],
      tAnt = d['tipoAntena' + n];
    grid([
      { l: 'Tipo', v: d['tipoModem' + n] },
      { l: 'Marca', v: d['marcaModem' + n] },
      { l: 'Modelo', v: d['modeloModem' + n] },
      { l: 'Serie', v: d['serieModem' + n] },
      { l: 'Antena', v: ant ? ant + (tAnt ? ' · ' + tAnt : '') : '', s: 2 },
      { l: 'Tecnología', v: d['tecModem' + n], s: 2 },
    ]);
  });
  if (!d.hasModem1 && !d.hasModem2)
    grid([
      { l: 'Módem 1', v: 'NO' },
      { l: 'Módem 2', v: 'NO' },
    ]);

  // ══════════════════════════════════════════════════════
  //  TABLERO DE CONTROL
  // ══════════════════════════════════════════════════════
  const tablero = Object.entries(d.tableroCampos || {}).filter(([, v]) => v);
  if (tablero.length || d.grupoActivo) {
    seccion('TABLERO DE CONTROL' + (d.tableroMarca ? ' · ' + String(d.tableroMarca).toUpperCase() : ''));
    grid([...tablero.map(([l, v]) => ({ l, v })), d.grupoActivo ? { l: 'Grupo activo', v: d.grupoActivo } : null]);
  }

  // ══════════════════════════════════════════════════════
  //  ALARMA Y BATERÍA
  // ══════════════════════════════════════════════════════
  seccion('ALARMA Y BATERÍA');
  grid([
    { l: 'Alarma presente', v: d.alarmaPresente },
    { l: 'Battery test', v: d.batteryTest },
    { l: 'Cambio de baterías', v: d.cambioBaterias },
    { l: 'Batería instalada', v: d.cambioBaterias === 'SI' ? d.tipoBateria : 'N/A' },
    { l: 'Medición AC (V)', v: d.medicionAC },
    { l: 'Medición baterías (V)', v: d.medicionBat },
    { l: 'Medición cargador (V)', v: d.medicionCargador, s: 2 },
  ]);
  textoLargo('Descripción de la alarma', d.descAlarma);

  // ══════════════════════════════════════════════════════
  //  CORRIENTES
  // ══════════════════════════════════════════════════════
  seccion('CORRIENTES INSTANTÁNEAS (A)');
  grid([
    { l: 'IA', v: d.corrIA },
    { l: 'IB', v: d.corrIB },
    { l: 'IC', v: d.corrIC },
    { l: 'IN (neutro)', v: d.corrIN },
  ]);

  // ══════════════════════════════════════════════════════
  //  ESTADO FÍSICO
  // ══════════════════════════════════════════════════════
  seccion('ESTADO FÍSICO');
  subtitulo('Equipo y aterrizaje');
  grid([
    { l: 'Gabinete', v: d.gabinete },
    { l: 'Borneras', v: d.borneras },
    { l: 'Aterrizaje restaurador', v: d.aterRestState },
    { l: 'Aterrizaje control', v: d.aterCtrlState },
    { l: 'Cable de tierra', v: d.cableTierra },
    { l: 'N° varillas', v: d.numVarillas },
    { l: 'Resistencia control (ohm)', v: d.aterControl },
    { l: 'Resistencia restaurador (ohm)', v: d.aterRestaurador },
    !vacio(d.aterOtros) ? { l: 'Resistencia otros (ohm)', v: d.aterOtros } : null,
  ]);
  textoLargo('Observación del estado físico', d.obsEstadoFisico);
  subtitulo('Bypass');
  grid([
    { l: 'Tipo de cuchilla', v: d.tipoCuchilla, s: 2 },
    { l: 'Estado cuchillas', v: d.estadoCuchillas },
    { l: 'N° cuchillas', v: d.numCuchillas },
    { l: 'Pararrayos', v: d.pararrayos },
    { l: 'N° pararrayos', v: d.numPararrayos },
  ]);
  subtitulo('Potencial');
  if (d.tienePotencial === 'SI') {
    grid([
      { l: 'Tiene potencial', v: 'SI' },
      { l: 'Cantidad', v: d.potCantidad },
      { l: 'Fase de conexión', v: d.faseConexion },
      { l: 'Aterrizaje potencial', v: d.aterPotState },
      { l: 'Pararrayos', v: d.potPararrayos },
      { l: 'Cuchilla', v: d.potCuchilla },
    ]);
  } else {
    grid([{ l: 'Tiene potencial', v: d.tienePotencial }, d.tienePotencial === 'NO' ? { l: 'Alimentado por acometida', v: d.alimentadoAcometida } : null]);
    textoLargo('Observación de la alimentación', d.obsPotencial);
  }

  // ══════════════════════════════════════════════════════
  //  MATERIALES
  // ══════════════════════════════════════════════════════
  const mats = d.materialesUtilizados || [];
  if (mats.length > 0) {
    seccion('MATERIALES UTILIZADOS');
    abrir(6.5 + 7.5 * Math.min(mats.length, 3));
    const cols = [
      { l: 'Código', w: 0.13 },
      { l: 'Descripción', w: 0.43 },
      { l: 'Unidad', w: 0.09, c: 1 },
      { l: 'Cantidad', w: 0.11, c: 1 },
      { l: 'Motivo', w: 0.24 },
    ];
    const encabezado = () => {
      rect(ML, y, CW, 6.5, BLUE, null, 1);
      let mx = ML;
      cols.forEach((c) => {
        setFont(6.8, 'bold', WHITE);
        txt(c.l.toUpperCase(), c.c ? mx + (CW * c.w) / 2 : mx + 2.5, y + 4.4, c.c ? { align: 'center' } : {});
        mx += CW * c.w;
      });
      y += 6.5;
    };
    encabezado();
    mats.forEach((m: any, idx: number) => {
      if (y + 8 > PH - 14) {
        checkPage(20);
        encabezado();
      }
      rect(ML, y, CW, 7.5, idx % 2 === 0 ? BGROW : WHITE);
      line(ML, y + 7.5, ML + CW, y + 7.5, BORDER, 0.2);
      let mx = ML;
      [m.codigo, m.desc, m.unidad, m.cant, m.motivo].forEach((v, ci) => {
        const c = cols[ci];
        setFont(7.8, ci === 1 ? 'bold' : 'normal', ci === 0 ? BLUE : TXT);
        const t = ajustar(vacio(v) ? '—' : v, CW * c.w - 4);
        txt(t, c.c ? mx + (CW * c.w) / 2 : mx + 2.5, y + 5, c.c ? { align: 'center' } : {});
        mx += CW * c.w;
      });
      y += 7.5;
    });
    y += 2.5;
    textoLargo('Observación de materiales', d.obsMateriales, 'aviso');
  }

  // ══════════════════════════════════════════════════════
  //  FOTOGRAFÍAS (filas de 2; una foto sola queda centrada)
  // ══════════════════════════════════════════════════════
  const fotos = (d.fotografias || []).filter((f: FotoFicha) => f && f.base64);
  if (fotos.length > 0) {
    const FW = (CW - 5) / 2,
      FH = 66,
      CAP = 7;
    seccion('REGISTRO FOTOGRÁFICO');
    abrir(FH + CAP + 2);
    for (let i = 0; i < fotos.length; i += 2) {
      checkPage(FH + CAP + 2);
      const enFila = fotos.slice(i, i + 2);
      const x0 = enFila.length === 1 ? ML + (CW - FW) / 2 : ML;
      enFila.forEach((foto: FotoFicha, j: number) => {
        const x = x0 + j * (FW + 5);
        rect(x, y, FW, FH + CAP, WHITE, BORDER, 1.5);
        try {
          const pr = doc.getImageProperties(foto.base64);
          const k = Math.min((FW - 3) / pr.width, (FH - 3) / pr.height);
          const iw = pr.width * k,
            ih = pr.height * k;
          doc.addImage(foto.base64, 'JPEG', x + (FW - iw) / 2, y + 1.5 + (FH - 3 - ih) / 2, iw, ih, '', 'FAST');
        } catch {
          setFont(8, 'normal', MUTED);
          txt('Imagen no disponible', x + FW / 2, y + FH / 2, { align: 'center' });
        }
        line(x, y + FH, x + FW, y + FH, BORDER, 0.2);
        setFont(7.2, 'bold', NAVY);
        txt('Foto ' + (i + j + 1), x + 2.5, y + FH + 4.6);
        if (foto.observacion) {
          setFont(7.2, 'normal', MUTED);
          txt(ajustar(foto.observacion, FW - 18), x + 15, y + FH + 4.6);
        }
      });
      y += FH + CAP + 4;
    }
  }

  // ══════════════════════════════════════════════════════
  //  OBSERVACIONES GENERALES
  // ══════════════════════════════════════════════════════
  if (!vacio(d.obsGenerales)) {
    seccion('OBSERVACIONES GENERALES');
    textoLargo('Observaciones', d.obsGenerales);
  }

  // ══════════════════════════════════════════════════════
  //  PERSONAL Y FIRMA (bloques lado a lado, misma altura)
  // ══════════════════════════════════════════════════════
  const personal = d.personal || [];
  const filaP = 8,
    cabP = 6.5;
  const altoTabla = cabP + Math.max(1, personal.length) * filaP;
  const altoBloque = Math.max(46, altoTabla);
  seccion('PERSONAL Y FIRMA');
  abrir(altoBloque);
  const gap = 5,
    persW = CW * 0.58 - gap / 2,
    firmaW = CW - persW - gap,
    firmaX = ML + persW + gap;
  const y0 = y;
  // Tabla de personal
  rect(ML, y0, persW, altoBloque, WHITE, BORDER, 1.2);
  rect(ML, y0, persW, cabP, BLUE, null, 1.2);
  setFont(6.8, 'bold', WHITE);
  txt('NOMBRE', ML + 2.5, y0 + 4.4);
  txt('CARGO', ML + persW * 0.56, y0 + 4.4);
  txt('N° EMP.', ML + persW * 0.84, y0 + 4.4);
  personal.forEach((p: any, i: number) => {
    const ry = y0 + cabP + i * filaP;
    if (i % 2 === 0) rect(ML + 0.3, ry, persW - 0.6, filaP, BGROW);
    setFont(8, 'bold', TXT);
    txt(ajustar(p.nombre || '—', persW * 0.54 - 3), ML + 2.5, ry + 5.3);
    setFont(7.4, 'normal', MUTED);
    txt(ajustar(p.cargo || '—', persW * 0.28 - 2), ML + persW * 0.56, ry + 5.3);
    setFont(7.4, 'normal', TXT);
    txt(ajustar(p.id || '—', persW * 0.16 - 2), ML + persW * 0.84, ry + 5.3);
  });
  // Firma
  rect(firmaX, y0, firmaW, altoBloque, BGROW, BORDER, 1.2);
  setFont(6.2, 'bold', MUTED);
  txt('FIRMA DEL RESPONSABLE', firmaX + firmaW / 2, y0 + 4.6, { align: 'center' });
  const fTop = y0 + 7,
    fBot = y0 + altoBloque - 10;
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
    setFont(8, 'italic', MUTED);
    txt('Sin firma digital', firmaX + firmaW / 2, (fTop + fBot) / 2, { align: 'center' });
  }
  line(firmaX + 6, fBot + 1, firmaX + firmaW - 6, fBot + 1, MUTED, 0.3);
  setFont(8.4, 'bold', NAVY);
  txt(ajustar(d.firmaResponsable || '—', firmaW - 8), firmaX + firmaW / 2, fBot + 6, { align: 'center' });
  y = y0 + altoBloque + 4;

  // ══════════════════════════════════════════════════════
  //  PIE DE PÁGINA EN TODAS LAS PÁGINAS
  // ══════════════════════════════════════════════════════
  function drawPageFooter() {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      rect(0, PH - 10, PW, 10, NAVY);
      setFont(6.5, 'normal', [150, 170, 200]);
      txt('SCADA Distribución — Hoja de Inspección · ' + (d.visitaNum || '') + ' · ' + (d.fechaVisita || ''), ML, PH - 4);
      txt('Pág. ' + i + ' / ' + pages, PW - MR, PH - 4, { align: 'right' });
      txt('Generado: ' + new Date().toLocaleString('es-HN'), PW / 2, PH - 4, { align: 'center' });
    }
  }
  drawPageFooter();

  return doc.output('blob');
}
