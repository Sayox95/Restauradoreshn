import { ROL_ETIQUETA, type Rol } from '@shared/constantes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, KeyRound, LogOut, Pencil, Power, UserX } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useConfirmar } from '@/common/components/ConfirmDialog';
import { useAvisos } from '@/common/components/Toast';
import { CajaError, Cargando, Encabezado, Seccion } from '@/common/components/ui';
import { mensajeError } from '@/common/http/api';
import { useSesion } from '@/common/seguridad/sesion';
import { fecha, fechaHora } from '@/common/utils/fechas';
import {
  activarCuenta,
  cerrarSesionesDe,
  desactivarCuenta,
  type EventoCuenta,
  rechazarCuenta,
  restablecerPassword,
  verUsuario,
} from '@/app/modules/usuarios/api';
import { BadgeCuenta, ClaveTemporal, DialogoAprobar, FormCuenta } from '@/app/modules/usuarios/components/cuenta';
import { useTiempoReal } from '@/common/tiempo-real/useTiempoReal';

const ACCION: Record<string, string> = {
  solicitar_cuenta: 'Solicitó la cuenta',
  crear: 'Creó la cuenta',
  editar: 'Editó los datos',
  aprobar: 'Aprobó la cuenta',
  rechazar: 'Rechazó la solicitud',
  rechazar_solicitud: 'Rechazó la solicitud',
  desactivar: 'Desactivó la cuenta',
  activar: 'Activó la cuenta',
  restablecer_password: 'Generó una contraseña temporal',
  cerrar_sesiones: 'Cerró sus sesiones',
  cambiar_password: 'Cambió su contraseña',
  editar_cuenta: 'Actualizó sus datos',
};

const CAMPOS: Record<string, string> = { nombre: 'nombre', correo: 'correo', telefono: 'celular', rol: 'perfil' };

/** Qué cambió, en una línea (perfil, motivo o campos editados). */
function detalle(h: EventoCuenta): string | null {
  const d = h.despues ?? {};
  if (h.accion === 'aprobar' && d.rol) return `Perfil: ${ROL_ETIQUETA[d.rol as Rol]}`;
  if (d.motivo) return `Motivo: ${String(d.motivo)}`;
  if ((h.accion === 'editar' || h.accion === 'editar_cuenta') && h.antes) {
    const cambios = Object.keys(CAMPOS).filter((k) => k in d && (d[k] ?? null) !== (h.antes![k] ?? null));
    return cambios.length ? `Cambió ${cambios.map((k) => CAMPOS[k]).join(', ')}` : null;
  }
  return null;
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-slate-500">{titulo}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function BotonAccion({
  icono: Icono,
  texto,
  ayuda,
  onClick,
  peligro,
}: {
  icono: typeof Power;
  texto: string;
  ayuda?: string;
  onClick: () => void;
  peligro?: boolean;
}) {
  return (
    <button onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
      <Icono className={`h-5 w-5 shrink-0 ${peligro ? 'text-rose-500' : 'text-slate-500'}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${peligro ? 'text-rose-700' : 'text-slate-900'}`}>{texto}</span>
        {ayuda && <span className="block text-xs text-slate-500">{ayuda}</span>}
      </span>
    </button>
  );
}

export function VerUsuario() {
  const id = Number(useParams().id);
  const yo = useSesion().usuario;
  const q = useQuery({ queryKey: ['usuario', id], queryFn: () => verUsuario(id) });
  useTiempoReal(['usuarios'], (e) => (e === 'reconectado' || e.id === id || e.id === null) && void q.refetch());
  const qc = useQueryClient();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const [editando, setEditando] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [temporal, setTemporal] = useState<string | null>(null);

  if (q.isLoading) return <Cargando />;
  if (q.error || !q.data) return <CajaError error={q.error} reintentar={() => q.refetch()} />;
  const u = q.data;
  const propia = yo?.id === u.id;

  const ejecutar = async (fn: () => Promise<unknown>, aviso: string) => {
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      qc.invalidateQueries({ queryKey: ['usuario', id] });
      avisar(aviso);
    } catch (e) {
      avisar(mensajeError(e), { tipo: 'error' });
    }
  };

  const restablecer = async () => {
    if (
      !(await confirmar({
        titulo: '¿Generar una contraseña temporal?',
        mensaje: `${u.nombre} deberá cambiarla al ingresar. Se cerrarán sus sesiones.`,
        confirmar: 'Generar',
      }))
    )
      return;
    try {
      const r = await restablecerPassword(u.id);
      qc.invalidateQueries({ queryKey: ['usuario', id] });
      setTemporal(r.password_temporal);
    } catch (e) {
      avisar(mensajeError(e), { tipo: 'error' });
    }
  };

  return (
    <div>
      <Encabezado volver titulo={u.nombre} subtitulo={<span className="font-mono">{u.usuario}</span>} accion={<BadgeCuenta estado={u.estado} />} />

      {u.estado === 'pendiente' && (
        <div className="tarjeta mb-5 flex flex-wrap items-center gap-3 p-4 ring-2 ring-amber-200">
          <p className="min-w-0 flex-1 text-sm text-slate-700">Solicitó una cuenta el {fecha(u.creado_en)}. Elija su perfil para aprobarla.</p>
          <button className="btn-exito" onClick={() => setAprobando(true)}>
            <Check className="h-5 w-5" /> Aprobar
          </button>
          <button
            className="btn-secundario"
            onClick={async () => {
              if (await confirmar({ titulo: `¿Rechazar la solicitud de ${u.nombre}?`, confirmar: 'Rechazar', peligro: true }))
                void ejecutar(() => rechazarCuenta(u.id), 'Solicitud rechazada');
            }}
          >
            Rechazar
          </button>
        </div>
      )}

      <Seccion
        titulo="Datos"
        accion={
          <button className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-marca-600" onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </button>
        }
      >
        <dl className="tarjeta divide-y divide-slate-100">
          <Dato titulo="Correo">{u.correo ?? '—'}</Dato>
          <Dato titulo="Celular">{u.telefono ?? '—'}</Dato>
          <Dato titulo="Perfil">{ROL_ETIQUETA[u.rol]}</Dato>
        </dl>
      </Seccion>

      <Seccion titulo="Acceso">
        <dl className="tarjeta mb-3 divide-y divide-slate-100">
          <Dato titulo="Cuenta creada">{fecha(u.creado_en)}</Dato>
          <Dato titulo="Último ingreso">{u.ultimo_ingreso_en ? fechaHora(u.ultimo_ingreso_en) : 'Nunca'}</Dato>
          <Dato titulo="Sesiones abiertas">{u.sesiones_activas}</Dato>
          <Dato titulo="Visitas registradas">{u.visitas_registradas}</Dato>
          {u.debe_cambiar_password && <Dato titulo="Contraseña">Temporal (pendiente de cambio)</Dato>}
        </dl>
        {!propia && (u.estado === 'activa' || u.estado === 'inactiva') && (
          <div className="tarjeta divide-y divide-slate-100 overflow-hidden">
            {u.estado === 'activa' && (
              <>
                <BotonAccion icono={KeyRound} texto="Restablecer contraseña" ayuda="Genera una temporal que debe cambiar al ingresar." onClick={restablecer} />
                {u.sesiones_activas > 0 && (
                  <BotonAccion
                    icono={LogOut}
                    texto="Cerrar sus sesiones"
                    onClick={async () => {
                      if (
                        await confirmar({
                          titulo: `¿Cerrar las sesiones de ${u.nombre}?`,
                          mensaje: 'Tendrá que volver a ingresar.',
                          confirmar: 'Cerrar sesiones',
                        })
                      )
                        void ejecutar(() => cerrarSesionesDe(u.id), 'Sesiones cerradas');
                    }}
                  />
                )}
                <BotonAccion
                  icono={UserX}
                  peligro
                  texto="Desactivar cuenta"
                  ayuda="Pierde el acceso de inmediato; su historial se conserva."
                  onClick={async () => {
                    if (
                      await confirmar({
                        titulo: `¿Desactivar la cuenta de ${u.nombre}?`,
                        mensaje: 'No podrá ingresar hasta que la active de nuevo.',
                        confirmar: 'Desactivar',
                        peligro: true,
                      })
                    )
                      void ejecutar(() => desactivarCuenta(u.id), 'Cuenta desactivada');
                  }}
                />
              </>
            )}
            {u.estado === 'inactiva' && (
              <BotonAccion icono={Power} texto="Activar cuenta" onClick={() => void ejecutar(() => activarCuenta(u.id), 'Cuenta activada')} />
            )}
          </div>
        )}
        {propia && <p className="px-1 text-sm text-slate-500">Es su propia cuenta: su contraseña y sesiones se gestionan desde «Mi cuenta».</p>}
      </Seccion>

      <Seccion titulo="Historial">
        <ol className="tarjeta divide-y divide-slate-100">
          {u.historial.map((h) => (
            <li key={h.id} className="px-4 py-3">
              <p className="text-sm font-medium text-slate-900">{ACCION[h.accion] ?? h.accion}</p>
              {detalle(h) && <p className="text-sm text-slate-600">{detalle(h)}</p>}
              <p className="text-xs text-slate-500">
                {fechaHora(h.creado_en)}
                {h.por && ` · ${h.por}`}
              </p>
            </li>
          ))}
          {!u.historial.length && <li className="px-4 py-3 text-sm text-slate-500">Sin cambios registrados.</li>}
        </ol>
      </Seccion>

      {editando && <FormCuenta u={u} onCerrar={() => setEditando(false)} />}
      {aprobando && <DialogoAprobar u={u} onCerrar={() => setAprobando(false)} />}
      {temporal && <ClaveTemporal usuario={u.usuario} password={temporal} onCerrar={() => setTemporal(null)} />}
    </div>
  );
}
