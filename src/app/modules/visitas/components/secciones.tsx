/** Las diez secciones de la hoja de visita. Una columna al capturar (salvo mediciones, excepción E4). */
import {
  ANTENAS,
  CARGOS_PERSONAL,
  FASES_CONEXION,
  GRUPOS_AJUSTE,
  MEDIOS_EXTINCION,
  MOTIVOS_MATERIAL,
  OK_NOK,
  ON_OFF,
  SI_NO,
  TECNOLOGIAS_MODEM,
  TIPOS_ANTENA,
  TIPOS_BATERIA,
  TIPOS_CUCHILLA,
  TIPOS_MODEM,
  TIPOS_VISITA,
} from '@shared/constantes';
import type { CatalogosVisita, Restaurador } from '@shared/tipos';
import { esCooper, esMonofasico } from '@shared/visitas';
import { Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bloque, Campo, FilaMediciones, Lista, Opciones, Texto } from './campos';
import { opcionesDe } from './catalogos';
import { Firma } from './Firma';
import { Fotos } from './Fotos';
import type { Borrador, Cambios, MaterialB, PersonaB } from './formulario';
import type { FotoLocal } from './almacen';

export interface PropsSeccion {
  b: Borrador;
  /** Cambia uno o varios campos a la vez. */
  set: (cambios: Cambios) => void;
  faltan: Set<string>;
  cat: CatalogosVisita | undefined;
  fotos: FotoLocal[];
  setFotos: (f: FotoLocal[]) => void;
}

const MODEM_TIPO: Record<string, string> = { 'MODEM DATOS': 'Modem Datos', 'MODEM TELEMETRIA': 'Modem Telemetria', 'RADIO MODEM': 'Radio Modem' };

// ── 1 · Datos generales ─────────────────────────────────────────────────────────────────────
function BuscarRestaurador({ cat, onElegir }: { cat: CatalogosVisita | undefined; onElegir: (r: Restaurador) => void }) {
  const [q, setQ] = useState('');
  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return (cat?.restauradores ?? [])
      .filter((r) =>
        [r.energis, r.circuito, r.ubicacion, r.sector].some((x) =>
          String(x ?? '')
            .toLowerCase()
            .includes(t),
        ),
      )
      .slice(0, 8);
  }, [q, cat]);
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
      <input
        id="v-codigo_energis"
        className="campo pl-9"
        inputMode="search"
        placeholder="Buscar por Energis, circuito o ubicación"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {resultados.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {resultados.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left hover:bg-marca-50"
                onClick={() => {
                  onElegir(r);
                  setQ('');
                }}
              >
                <span className="block font-semibold text-slate-900">
                  {r.energis} · {r.circuito ?? '—'}
                </span>
                <span className="block text-xs text-slate-500">{[r.ubicacion, r.subestacion, r.sector].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DatosGenerales({ b, set, faltan, cat }: PropsSeccion) {
  const elegido = !!b.codigo_energis;
  const elegir = (r: Restaurador) =>
    set({
      codigo_energis: String(r.energis),
      circuito: r.circuito ?? '',
      ubicacion: r.ubicacion ?? '',
      subestacion: r.subestacion ?? '',
      zona: r.zona ?? '',
      sector: r.sector ?? '',
      latitud: r.latitud === null ? '' : String(r.latitud),
      longitud: r.longitud === null ? '' : String(r.longitud),
    });
  return (
    <>
      <Bloque titulo="Inspección">
        <Campo id="fecha_visita" etiqueta="Fecha de visita" requerido falta={faltan.has('fecha_visita')}>
          <input id="v-fecha_visita" type="date" className="campo" value={b.fecha_visita ?? ''} onChange={(e) => set({ fecha_visita: e.target.value })} />
        </Campo>
        <Campo id="tipo_visita" etiqueta="Tipo de visita" requerido falta={faltan.has('tipo_visita')}>
          <Lista id="tipo_visita" valor={b.tipo_visita} opciones={TIPOS_VISITA} onCambio={(v) => set({ tipo_visita: v })} />
        </Campo>
        <Campo id="hora_llegada" etiqueta="Hora de llegada" requerido falta={faltan.has('hora_llegada')}>
          <input id="v-hora_llegada" type="time" className="campo" value={b.hora_llegada ?? ''} onChange={(e) => set({ hora_llegada: e.target.value })} />
        </Campo>
        <Campo id="hora_salida" etiqueta="Hora de salida" requerido falta={faltan.has('hora_salida')} ayuda="Se pide al guardar la inspección.">
          <input id="v-hora_salida" type="time" className="campo" value={b.hora_salida ?? ''} onChange={(e) => set({ hora_salida: e.target.value })} />
        </Campo>
      </Bloque>
      <Bloque titulo="Restaurador">
        <Campo id="codigo_energis" etiqueta={elegido ? 'Cambiar restaurador' : 'Buscar restaurador'} requerido falta={faltan.has('codigo_energis')}>
          <BuscarRestaurador cat={cat} onElegir={elegir} />
        </Campo>
        {/* Los datos del restaurador siempre están en su lugar (con «—» mientras no se elige): al elegir
            se llenan sin mover la pantalla, que en el teléfono se sentía brusco. */}
        <dl className={`divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 ${elegido ? 'bg-slate-50' : 'bg-slate-50/60'}`}>
          {(
            [
              ['codigo_energis', 'Código Energis'],
              ['ubicacion', 'Ubicación'],
              ['circuito', 'Circuito'],
              ['subestacion', 'Subestación'],
              ['zona', 'Zona'],
              ['sector', 'Sector'],
            ] as const
          ).map(([k, t]) => (
            <div key={k} className="flex items-baseline gap-3 px-3 py-2.5 text-sm">
              <dt className="w-32 shrink-0 text-slate-500">{t}</dt>
              <dd key={b[k] ?? ''} className={`min-w-0 flex-1 break-words font-semibold ${b[k] ? 'anim-dato text-slate-900' : 'text-slate-400'}`}>
                {b[k] || '—'}
              </dd>
            </div>
          ))}
        </dl>
        <Campo
          id="latitud"
          etiqueta="Latitud"
          falta={faltan.has('latitud')}
          ayuda={faltan.has('latitud') ? 'Fuera de Honduras: revise si está invertida con la longitud.' : undefined}
        >
          <Texto id="latitud" valor={b.latitud} numerico placeholder="Se llena al elegir el restaurador" onCambio={(v) => set({ latitud: v })} />
        </Campo>
        <Campo id="longitud" etiqueta="Longitud" falta={faltan.has('longitud')}>
          <Texto id="longitud" valor={b.longitud} numerico placeholder="Se llena al elegir el restaurador" onCambio={(v) => set({ longitud: v })} />
        </Campo>
        <Campo id="gen_distribuida" etiqueta="Generación distribuida" requerido falta={faltan.has('gen_distribuida')}>
          <Opciones id="gen_distribuida" valor={b.gen_distribuida} opciones={SI_NO} onCambio={(v) => set({ gen_distribuida: v })} />
        </Campo>
      </Bloque>
    </>
  );
}

// ── 2 · Reconectador ────────────────────────────────────────────────────────────────────────
export function Reconectador({ b, set, faltan, cat }: PropsSeccion) {
  const o = opcionesDe(cat, b.marca_reconectador);
  const cooper = esCooper({ marca_reconectador: b.marca_reconectador ?? null });
  const req = (k: string) => faltan.has(k);
  return (
    <>
      <Bloque titulo="Equipo">
        <Campo id="tipo_recon" etiqueta="Tipo de reconectador" requerido={!!cat?.tipos.length} falta={req('tipo_recon')}>
          <Lista id="tipo_recon" valor={b.tipo_recon} opciones={cat?.tipos ?? []} onCambio={(v) => set({ tipo_recon: v })} />
        </Campo>
        <Campo id="marca_reconectador" etiqueta="Marca" requerido={!!cat?.marcas.length} falta={req('marca_reconectador')}>
          <Lista
            id="marca_reconectador"
            valor={b.marca_reconectador}
            opciones={cat?.marcas.map((m) => m.marca) ?? []}
            // Otra marca: modelo, control y tablero dependen de ella.
            onCambio={(v) => set({ marca_reconectador: v, modelo_recon: '', tipo_control: '', tablero_campos: {}, ajuste_activo: '' })}
          />
        </Campo>
        <Campo id="modelo_recon" etiqueta="Modelo" requerido={!!o.marca?.modelos.length} falta={req('modelo_recon')}>
          <Lista
            id="modelo_recon"
            valor={b.modelo_recon}
            opciones={o.marca?.modelos ?? []}
            vacia={b.marca_reconectador ? '— Elegir —' : 'Elija la marca primero'}
            onCambio={(v) => set({ modelo_recon: v })}
          />
        </Campo>
        <Campo id="tipo_control" etiqueta="Tipo de control" requerido={!!o.marca?.controles.length} falta={req('tipo_control')}>
          <Lista
            id="tipo_control"
            valor={b.tipo_control}
            opciones={o.marca?.controles ?? []}
            vacia={b.marca_reconectador ? '— Elegir —' : 'Elija la marca primero'}
            onCambio={(v) => set({ tipo_control: v })}
          />
        </Campo>
        <Campo id="serie_recon" etiqueta="Serie del reconectador" requerido falta={req('serie_recon')}>
          <Texto id="serie_recon" valor={b.serie_recon} placeholder="N° de serie" onCambio={(v) => set({ serie_recon: v })} />
        </Campo>
        <Campo id="serie_control" etiqueta="Serie del control" requerido falta={req('serie_control')}>
          <Texto id="serie_control" valor={b.serie_control} placeholder="N° de serie" onCambio={(v) => set({ serie_control: v })} />
        </Campo>
        <Campo id="medio_extincion" etiqueta="Medio de extinción" requerido falta={req('medio_extincion')}>
          <Lista id="medio_extincion" valor={b.medio_extincion} opciones={MEDIOS_EXTINCION} onCambio={(v) => set({ medio_extincion: v })} />
        </Campo>
        {cooper && (
          <Campo id="proview_control" etiqueta="Firmware / Proview" requerido falta={req('proview_control')}>
            <Texto id="proview_control" valor={b.proview_control} placeholder="Ej.: 4.0.1, 5.1, RC10" onCambio={(v) => set({ proview_control: v })} />
          </Campo>
        )}
      </Bloque>
      {cooper && (
        <Bloque titulo="Mangueras extras">
          {(
            [
              ['term_sens_v', 'Terminal p/sensores V'],
              ['mangu_sens_v', 'Manguera sensores V'],
              ['term_mangu_aux', 'Terminal manguera aux'],
              ['mangu_aux', 'Manguera auxiliar'],
            ] as const
          ).map(([k, t]) => (
            <Campo key={k} id={k} etiqueta={t} requerido falta={req(k)}>
              <Opciones id={k} valor={b[k]} opciones={SI_NO} onCambio={(v) => set({ [k]: v })} />
            </Campo>
          ))}
        </Bloque>
      )}
    </>
  );
}

// ── 3 · Módems ──────────────────────────────────────────────────────────────────────────────
export function Modems({ b, set, faltan, cat }: PropsSeccion) {
  const o = opcionesDe(cat, null);
  return (
    <>
      {([1, 2] as const).map((n) => {
        const k = (c: string) => `${c}${n}`;
        const tiene = b[k('has_modem')] === 'SI';
        const marcaModem = o.modem(b[k('marca_modem')]);
        return (
          <Bloque key={n} titulo={`Módem ${n}`}>
            <Campo id={k('has_modem')} etiqueta={`¿Tiene módem ${n}?`} requerido falta={faltan.has(k('has_modem'))}>
              <Opciones id={k('has_modem')} valor={b[k('has_modem')]} opciones={SI_NO} onCambio={(v) => set({ [k('has_modem')]: v })} />
            </Campo>
            {tiene && (
              <>
                <Campo id={k('marca_modem')} etiqueta="Marca" requerido={!!cat?.modems.length} falta={faltan.has(k('marca_modem'))}>
                  <Lista
                    id={k('marca_modem')}
                    valor={b[k('marca_modem')]}
                    opciones={cat?.modems.map((m) => m.marca) ?? []}
                    onCambio={(v) => {
                      const elemento = o.modem(v)?.elemento;
                      set({
                        [k('marca_modem')]: v,
                        [k('modelo_modem')]: '',
                        ...(elemento && MODEM_TIPO[elemento] ? { [k('tipo_modem')]: MODEM_TIPO[elemento] } : {}),
                      });
                    }}
                  />
                </Campo>
                <Campo id={k('tipo_modem')} etiqueta="Tipo de módem" requerido falta={faltan.has(k('tipo_modem'))}>
                  <Lista id={k('tipo_modem')} valor={b[k('tipo_modem')]} opciones={TIPOS_MODEM} onCambio={(v) => set({ [k('tipo_modem')]: v })} />
                </Campo>
                <Campo id={k('modelo_modem')} etiqueta="Modelo" requerido={!!marcaModem?.modelos.length} falta={faltan.has(k('modelo_modem'))}>
                  <Lista
                    id={k('modelo_modem')}
                    valor={b[k('modelo_modem')]}
                    opciones={marcaModem?.modelos ?? []}
                    vacia={b[k('marca_modem')] ? '— Elegir —' : 'Elija la marca primero'}
                    onCambio={(v) => set({ [k('modelo_modem')]: v })}
                  />
                </Campo>
                <Campo id={k('serie_modem')} etiqueta="Serie" requerido falta={faltan.has(k('serie_modem'))}>
                  <Texto id={k('serie_modem')} valor={b[k('serie_modem')]} placeholder="N° de serie" onCambio={(v) => set({ [k('serie_modem')]: v })} />
                </Campo>
                <Campo id={k('antena_modem')} etiqueta="Antena" requerido falta={faltan.has(k('antena_modem'))}>
                  <Opciones id={k('antena_modem')} valor={b[k('antena_modem')]} opciones={ANTENAS} onCambio={(v) => set({ [k('antena_modem')]: v })} />
                </Campo>
                {b[k('antena_modem')] === 'EXTERNA' && (
                  <Campo id={k('tipo_antena')} etiqueta="Tipo de antena" requerido falta={faltan.has(k('tipo_antena'))}>
                    <Lista id={k('tipo_antena')} valor={b[k('tipo_antena')]} opciones={TIPOS_ANTENA} onCambio={(v) => set({ [k('tipo_antena')]: v })} />
                  </Campo>
                )}
                <Campo id={k('tec_modem')} etiqueta="Tecnología" requerido falta={faltan.has(k('tec_modem'))}>
                  <Opciones id={k('tec_modem')} valor={b[k('tec_modem')]} opciones={TECNOLOGIAS_MODEM} onCambio={(v) => set({ [k('tec_modem')]: v })} />
                </Campo>
              </>
            )}
          </Bloque>
        );
      })}
    </>
  );
}

// ── 4 · Tablero, alarma y batería ───────────────────────────────────────────────────────────
export function Tablero({ b, set, faltan, cat }: PropsSeccion) {
  const campos = opcionesDe(cat, b.marca_reconectador).camposTablero;
  return (
    <>
      <Bloque titulo={`Tablero de control${b.marca_reconectador ? ` · ${b.marca_reconectador}` : ''}`}>
        {!b.marca_reconectador ? (
          <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">Elija la marca del reconectador para ver los campos de su tablero.</p>
        ) : !campos.length ? (
          <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">Esta marca no tiene tablero configurado (Administración → Catálogos → Tableros).</p>
        ) : (
          <>
            {campos.map((c) => (
              <Campo key={c} id={`tablero.${c}`} etiqueta={c} requerido falta={faltan.has(`tablero.${c}`)}>
                <Opciones
                  id={`tablero.${c}`}
                  valor={b.tablero_campos[c]}
                  opciones={ON_OFF}
                  onCambio={(v) => {
                    const t = { ...b.tablero_campos };
                    if (v) t[c] = v as 'ON' | 'OFF';
                    else delete t[c];
                    set({ tablero_campos: t });
                  }}
                />
              </Campo>
            ))}
            <Campo id="ajuste_activo" etiqueta="Grupo activo" requerido falta={faltan.has('ajuste_activo')}>
              <Lista id="ajuste_activo" valor={b.ajuste_activo} opciones={GRUPOS_AJUSTE} onCambio={(v) => set({ ajuste_activo: v })} />
            </Campo>
          </>
        )}
      </Bloque>
      <Bloque titulo="Alarma">
        <Campo id="alarma_presente" etiqueta="Alarma presente" requerido falta={faltan.has('alarma_presente')}>
          <Opciones id="alarma_presente" valor={b.alarma_presente} opciones={SI_NO} onCambio={(v) => set({ alarma_presente: v })} />
        </Campo>
        {b.alarma_presente === 'SI' && (
          <Campo id="desc_alarma" etiqueta="Descripción de la alarma" requerido falta={faltan.has('desc_alarma')}>
            <Texto id="desc_alarma" valor={b.desc_alarma} multilinea onCambio={(v) => set({ desc_alarma: v })} />
          </Campo>
        )}
      </Bloque>
      <Bloque titulo="Batería · voltajes (V)">
        <FilaMediciones
          unidad="V"
          faltan={faltan}
          valores={b}
          onCambio={(id, v) => set({ [id]: v })}
          campos={[
            { id: 'medicion_ac', etiqueta: 'AC', requerido: true },
            { id: 'medicion_bat', etiqueta: 'Baterías', requerido: true },
            { id: 'medicion_cargador', etiqueta: 'Cargador', requerido: true },
          ]}
        />
        <Campo id="battery_test" etiqueta="Battery test" requerido falta={faltan.has('battery_test')}>
          <Opciones id="battery_test" valor={b.battery_test} opciones={OK_NOK} onCambio={(v) => set({ battery_test: v })} />
        </Campo>
        <Campo id="cambio_baterias" etiqueta="Cambio de baterías" requerido falta={faltan.has('cambio_baterias')}>
          <Opciones id="cambio_baterias" valor={b.cambio_baterias} opciones={SI_NO} onCambio={(v) => set({ cambio_baterias: v })} />
        </Campo>
        {b.cambio_baterias === 'SI' && (
          <Campo id="tipo_bateria" etiqueta="Tipo de batería instalada" requerido falta={faltan.has('tipo_bateria')}>
            <Lista id="tipo_bateria" valor={b.tipo_bateria} opciones={TIPOS_BATERIA} onCambio={(v) => set({ tipo_bateria: v })} />
          </Campo>
        )}
      </Bloque>
    </>
  );
}

// ── 5 · Corrientes ──────────────────────────────────────────────────────────────────────────
export function Corrientes({ b, set, faltan }: PropsSeccion) {
  const mono = esMonofasico({ tipo_recon: b.tipo_recon ?? null });
  return (
    <Bloque titulo="Corrientes instantáneas (A)">
      <FilaMediciones
        unidad="A"
        faltan={faltan}
        valores={b}
        onCambio={(id, v) => set({ [id]: v })}
        campos={[
          { id: 'corr_ia', etiqueta: 'IA', requerido: true },
          { id: 'corr_ib', etiqueta: 'IB', requerido: !mono },
          { id: 'corr_ic', etiqueta: 'IC', requerido: !mono },
          { id: 'corr_in', etiqueta: 'IN', requerido: true },
        ]}
      />
      {mono && <p className="text-xs text-slate-500">Reconectador monofásico: IB e IC son opcionales.</p>}
    </Bloque>
  );
}

// ── 6 · Estado físico ───────────────────────────────────────────────────────────────────────
export function EstadoFisico({ b, set, faltan }: PropsSeccion) {
  const op = (k: string, t: string, opciones: readonly string[] = OK_NOK) => (
    <Campo id={k} etiqueta={t} requerido falta={faltan.has(k)}>
      <Opciones id={k} valor={b[k]} opciones={opciones} onCambio={(v) => set({ [k]: v })} />
    </Campo>
  );
  const num = (k: string, t: string) => (
    <Campo id={k} etiqueta={t} requerido falta={faltan.has(k)}>
      <Texto id={k} valor={b[k]} numerico placeholder="Cantidad" onCambio={(v) => set({ [k]: v })} />
    </Campo>
  );
  const hayNok = b.gabinete === 'NOK' || b.borneras === 'NOK';
  return (
    <>
      <Bloque titulo="Estado del equipo">
        {op('gabinete', 'Gabinete')}
        {op('borneras', 'Borneras')}
        <Campo id="obs_estado_fisico" etiqueta="Observación" requerido={hayNok} falta={faltan.has('obs_estado_fisico')}>
          <Texto
            id="obs_estado_fisico"
            valor={b.obs_estado_fisico}
            multilinea
            placeholder="Estado físico del equipo"
            onCambio={(v) => set({ obs_estado_fisico: v })}
          />
        </Campo>
      </Bloque>
      <Bloque titulo="Aterrizaje">
        {op('ater_rest_state', 'Restaurador')}
        {op('ater_ctrl_state', 'Control')}
        {op('cable_tierra', 'Cable de tierra')}
        {num('num_varillas', '# Varillas')}
      </Bloque>
      <Bloque titulo="Resistencia de aterrizaje (Ω)">
        <FilaMediciones
          unidad="Ω"
          faltan={faltan}
          valores={b}
          onCambio={(id, v) => set({ [id]: v })}
          campos={[
            { id: 'ater_control', etiqueta: 'Control', requerido: true },
            { id: 'ater_restaurador', etiqueta: 'Restaurador', requerido: true },
            { id: 'ater_otros', etiqueta: 'Otros' },
          ]}
        />
      </Bloque>
      <Bloque titulo="Bypass">
        <Campo id="tipo_cuchilla" etiqueta="Tipo de cuchilla" requerido falta={faltan.has('tipo_cuchilla')}>
          <Lista id="tipo_cuchilla" valor={b.tipo_cuchilla} opciones={TIPOS_CUCHILLA} onCambio={(v) => set({ tipo_cuchilla: v })} />
        </Campo>
        {op('estado_cuchillas', 'Estado de cuchillas')}
        {num('num_cuchillas', '# Cuchillas')}
        {op('pararrayos', 'Pararrayos')}
        {num('num_pararrayos', '# Pararrayos')}
      </Bloque>
      <Bloque titulo="Potencial">
        {op('tiene_potencial', '¿Tiene potencial?', SI_NO)}
        {b.tiene_potencial === 'SI' && (
          <>
            {num('pot_cantidad', 'Cantidad')}
            <Campo id="fase_conexion" etiqueta="Fase de conexión" requerido falta={faltan.has('fase_conexion')}>
              <Lista id="fase_conexion" valor={b.fase_conexion} opciones={FASES_CONEXION} onCambio={(v) => set({ fase_conexion: v })} />
            </Campo>
            {op('pot_pararrayos', 'Pararrayos', SI_NO)}
            {op('pot_cuchilla', 'Cuchilla', SI_NO)}
            {op('ater_pot_state', 'Aterrizaje del potencial')}
          </>
        )}
        {b.tiene_potencial === 'NO' && (
          <>
            {op('alimentado_acometida', 'Alimentado por acometida', SI_NO)}
            <Campo id="obs_potencial" etiqueta="Observaciones">
              <Texto id="obs_potencial" valor={b.obs_potencial} multilinea placeholder="Alimentación del equipo" onCambio={(v) => set({ obs_potencial: v })} />
            </Campo>
          </>
        )}
      </Bloque>
    </>
  );
}

// ── 7 · Materiales ──────────────────────────────────────────────────────────────────────────
export function Materiales({ b, set, faltan, cat }: PropsSeccion) {
  const cambiar = (i: number, c: Partial<MaterialB>) => set({ materiales: b.materiales.map((m, j) => (j === i ? { ...m, ...c } : m)) });
  return (
    <>
      <p className="mb-4 text-sm text-slate-600">Materiales reemplazados o utilizados en la inspección (opcional).</p>
      {b.materiales.map((m, i) => (
        <div key={i} className="tarjeta mb-4 space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-800">Material #{i + 1}</p>
            <button
              type="button"
              className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
              aria-label={`Quitar material ${i + 1}`}
              onClick={() => set({ materiales: b.materiales.filter((_, j) => j !== i) })}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <Campo id={`material.${i}.catalogo`} etiqueta="Del catálogo">
            <select
              id={`v-material.${i}.catalogo`}
              className="campo"
              value={m.codigo}
              onChange={(e) => {
                const mat = cat?.materiales.find((x) => x.codigo === e.target.value);
                cambiar(i, mat ? { codigo: mat.codigo, desc: mat.nombre, unidad: mat.unidad ?? '' } : { codigo: '' });
              }}
            >
              <option value="">— Escribir a mano —</option>
              {cat?.materiales.map((x) => (
                <option key={x.id} value={x.codigo}>
                  {x.codigo} · {x.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id={`material.${i}.desc`} etiqueta="Descripción" requerido falta={faltan.has(`material.${i}.desc`)}>
            <Texto id={`material.${i}.desc`} valor={m.desc} onCambio={(v) => cambiar(i, { desc: v })} />
          </Campo>
          <Campo id={`material.${i}.unidad`} etiqueta="Unidad">
            <Texto id={`material.${i}.unidad`} valor={m.unidad} placeholder="UN" onCambio={(v) => cambiar(i, { unidad: v.toUpperCase() })} />
          </Campo>
          <Campo id={`material.${i}.cant`} etiqueta="Cantidad" requerido falta={faltan.has(`material.${i}.cant`)}>
            <Texto id={`material.${i}.cant`} valor={m.cant} numerico onCambio={(v) => cambiar(i, { cant: v })} />
          </Campo>
          <Campo id={`material.${i}.motivo`} etiqueta="Motivo">
            <Lista id={`material.${i}.motivo`} valor={m.motivo} opciones={MOTIVOS_MATERIAL} onCambio={(v) => cambiar(i, { motivo: v })} />
          </Campo>
        </div>
      ))}
      <button
        type="button"
        className="btn-secundario mb-4 w-full border-dashed"
        onClick={() => set({ materiales: [...b.materiales, { codigo: '', desc: '', unidad: '', cant: '', motivo: '' }] })}
      >
        <Plus className="h-5 w-5" /> Agregar material
      </button>
      <Campo id="obs_materiales" etiqueta="Observación de materiales">
        <Texto id="obs_materiales" valor={b.obs_materiales} multilinea placeholder="Justificación o comentarios" onCambio={(v) => set({ obs_materiales: v })} />
      </Campo>
    </>
  );
}

// ── 8 · Fotografías ─────────────────────────────────────────────────────────────────────────
export function Fotografias({ fotos, setFotos, faltan }: PropsSeccion) {
  return <Fotos fotos={fotos} onCambio={setFotos} falta={faltan.has('fotos')} />;
}

// ── 9 · Observaciones ───────────────────────────────────────────────────────────────────────
export function Observaciones({ b, set }: PropsSeccion) {
  return (
    <Campo id="obs_generales" etiqueta="Observaciones generales">
      <Texto
        id="obs_generales"
        valor={b.obs_generales}
        multilinea
        placeholder="Observaciones relevantes de la inspección"
        onCambio={(v) => set({ obs_generales: v })}
      />
    </Campo>
  );
}

// ── 10 · Personal y firma ───────────────────────────────────────────────────────────────────
export function Personal({ b, set, faltan, cat }: PropsSeccion) {
  // El nombre del responsable se copia del técnico #1 mientras no se escriba a mano.
  const conPersonal = (personal: PersonaB[]) => set({ personal, ...(b.responsable_a_mano ? {} : { firma_responsable: personal[0]?.nombre ?? '' }) });
  const cambiar = (i: number, c: Partial<PersonaB>) => conPersonal(b.personal.map((p, j) => (j === i ? { ...p, ...c } : p)));
  return (
    <>
      <Bloque titulo="Personal de la inspección">
        {b.personal.map((p, i) => (
          <div key={i} className="tarjeta space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-800">Técnico #{i + 1}</p>
              {i > 0 && (
                <button
                  type="button"
                  className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                  aria-label={`Quitar técnico ${i + 1}`}
                  onClick={() => conPersonal(b.personal.filter((_, j) => j !== i))}
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <Campo id={`personal.${i}.nombre`} etiqueta="Técnico" requerido falta={faltan.has(`personal.${i}.nombre`)}>
              <select
                id={`v-personal.${i}.nombre`}
                className="campo"
                value={p.eleccion}
                onChange={(e) => {
                  const v = e.target.value;
                  const per = cat?.personal.find((x) => x.nombre === v);
                  // El catálogo solo entrega cargos de la lista de la hoja (CARGOS_PERSONAL): se copian tal cual.
                  cambiar(
                    i,
                    v === 'OTRO' ? { eleccion: v, nombre: '' } : { eleccion: v, nombre: v, cargo: per?.cargo ?? p.cargo, id: per?.empleado_id ?? p.id },
                  );
                }}
              >
                <option value="">— Elegir —</option>
                {cat?.personal.map((x) => (
                  <option key={x.id} value={x.nombre}>
                    {x.nombre}
                    {x.cargo ? ` · ${x.cargo}` : ''}
                  </option>
                ))}
                <option value="OTRO">Otro (escribir el nombre)</option>
              </select>
            </Campo>
            {p.eleccion === 'OTRO' && (
              <Campo id={`personal.${i}.manual`} etiqueta="Nombre completo" requerido>
                <Texto id={`personal.${i}.manual`} valor={p.nombre} onCambio={(v) => cambiar(i, { nombre: v })} />
              </Campo>
            )}
            <Campo id={`personal.${i}.cargo`} etiqueta="Cargo">
              <Lista id={`personal.${i}.cargo`} valor={p.cargo} opciones={CARGOS_PERSONAL} onCambio={(v) => cambiar(i, { cargo: v })} />
            </Campo>
            <Campo id={`personal.${i}.id`} etiqueta="N° de empleado">
              <Texto id={`personal.${i}.id`} valor={p.id} onCambio={(v) => cambiar(i, { id: v })} />
            </Campo>
          </div>
        ))}
        <button
          type="button"
          className="btn-secundario w-full border-dashed"
          onClick={() => conPersonal([...b.personal, { eleccion: '', nombre: '', cargo: '', id: '' }])}
        >
          <Plus className="h-5 w-5" /> Agregar técnico
        </button>
      </Bloque>
      <Bloque titulo="Firma del responsable">
        <Campo id="firma_responsable" etiqueta="Nombre del responsable" requerido falta={faltan.has('firma_responsable')} ayuda="Se llena con el técnico #1.">
          <Texto id="firma_responsable" valor={b.firma_responsable} onCambio={(v) => set({ firma_responsable: v, responsable_a_mano: v.trim() !== '' })} />
        </Campo>
        <Campo id="firma_img" etiqueta="Firma" requerido falta={faltan.has('firma_img')}>
          <Firma valor={b.firma_img} onCambio={(v) => set({ firma_img: v })} falta={faltan.has('firma_img')} />
        </Campo>
      </Bloque>
    </>
  );
}

export const SECCIONES_FORMULARIO = [
  DatosGenerales,
  Reconectador,
  Modems,
  Tablero,
  Corrientes,
  EstadoFisico,
  Materiales,
  Fotografias,
  Observaciones,
  Personal,
] as const;
