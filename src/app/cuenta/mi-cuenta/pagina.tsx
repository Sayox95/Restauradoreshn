import { ROL_ETIQUETA } from '@shared/constantes';
import { MODULOS, PermisosVisitas } from '@shared/permisos';
import { Check, KeyRound, LogOut, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/common/components/Avatar';
import { useConfirmar } from '@/common/components/ConfirmDialog';
import { Hoja } from '@/common/components/Hoja';
import { useAvisos } from '@/common/components/Toast';
import { Encabezado, Seccion } from '@/common/components/ui';
import { useAccess } from '@/common/seguridad/acceso';
import { useSesion } from '@/common/seguridad/sesion';
import { zonaActual } from '@/common/utils/fechas';
import { FormCambiarPassword } from '@/app/cuenta/cambiar-password/FormCambiarPassword';

/**
 * Mi cuenta: igual para todos los perfiles (lo propio de cada quien, sin permiso). Los datos de la cuenta
 * solo se ven (los corrige un administrador); cada quien cambia su contraseña y cierra sus sesiones.
 */
export function MiCuenta() {
  const { usuario, salir } = useSesion();
  const { hasAccess } = useAccess();
  const confirmar = useConfirmar();
  const avisar = useAvisos();
  const [cambiandoClave, setCambiandoClave] = useState(false);
  if (!usuario) return null;
  const permisos = MODULOS.flatMap((m) => m.permisos).filter((p) => usuario.permisos.includes(p.codigo));

  return (
    <div className="mx-auto max-w-2xl">
      {/* Como las demás pantallas que se abren fuera del menú: título y botón para regresar. */}
      <Encabezado volver titulo="Mi cuenta" />
      <div className="tarjeta mb-5 flex items-center gap-4 p-4">
        <Avatar nombre={usuario.nombre} tamano="grande" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900">{usuario.nombre}</h1>
          <p className="truncate text-sm text-slate-500">
            <span className="font-mono">{usuario.usuario}</span> · {ROL_ETIQUETA[usuario.rol]}
          </p>
        </div>
      </div>

      <Seccion titulo="Mis datos">
        <dl className="tarjeta divide-y divide-slate-100">
          {(
            [
              ['Nombre', usuario.nombre],
              ['Usuario', usuario.usuario],
              ['Correo', usuario.correo ?? '—'],
              ['Celular', usuario.telefono ?? '—'],
              ['Perfil', ROL_ETIQUETA[usuario.rol]],
            ] as const
          ).map(([titulo, valor]) => (
            <div key={titulo} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
              <dt className="shrink-0 text-slate-500">{titulo}</dt>
              <dd className={`min-w-0 truncate text-right font-medium text-slate-900 ${titulo === 'Usuario' ? 'font-mono' : ''}`}>{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 px-1 text-xs text-slate-500">Para corregir estos datos, pídalo a un administrador.</p>
      </Seccion>

      <Seccion titulo="Lo que puede hacer">
        <ul className="tarjeta space-y-1.5 p-4 text-sm text-slate-700">
          {permisos.map((p) => (
            <li key={p.codigo} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> {p.nombre}
            </li>
          ))}
          {hasAccess([PermisosVisitas.Registrar]) && !hasAccess([PermisosVisitas.Consultar]) && (
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> Ver las inspecciones que registró
            </li>
          )}
        </ul>
      </Seccion>

      <Seccion titulo="Seguridad">
        <div className="tarjeta divide-y divide-slate-100 overflow-hidden">
          <button className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left hover:bg-slate-50" onClick={() => setCambiandoClave(true)}>
            <KeyRound className="h-5 w-5 text-slate-500" aria-hidden />
            <span className="flex-1 font-medium">Cambiar contraseña</span>
          </button>
          <button
            className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left hover:bg-slate-50"
            onClick={async () => {
              if (
                await confirmar({
                  titulo: '¿Cerrar sesión en todos los dispositivos?',
                  mensaje: 'Tendrá que volver a ingresar en cada uno.',
                  confirmar: 'Cerrar sesiones',
                })
              )
                void salir(true);
            }}
          >
            <MonitorSmartphone className="h-5 w-5 text-slate-500" aria-hidden />
            <span className="flex-1 font-medium">Cerrar sesión en todos los dispositivos</span>
          </button>
        </div>
      </Seccion>

      <button className="btn-secundario mb-4 w-full" onClick={() => salir()}>
        <LogOut className="h-5 w-5" /> Cerrar sesión
      </button>
      <p className="px-1 text-center text-xs text-slate-500">Las fechas se muestran en la zona horaria {zonaActual()}.</p>

      {cambiandoClave && (
        <Hoja abierta titulo="Cambiar contraseña" onCerrar={() => setCambiandoClave(false)}>
          <FormCambiarPassword
            onListo={() => {
              setCambiandoClave(false);
              avisar('Contraseña actualizada');
            }}
          />
        </Hoja>
      )}
    </div>
  );
}
