import { useQueryClient } from '@tanstack/react-query';
import { useSesion } from '@/common/seguridad/sesion';
import { Marco } from '@/app/cuenta/ingreso/pagina';
import { FormCambiarPassword } from './FormCambiarPassword';

/** Primer ingreso con contraseña temporal: hay que elegir una propia antes de usar la app. */
export function CambiarPasswordObligatorio() {
  const { usuario, salir } = useSesion();
  const qc = useQueryClient();
  return (
    <Marco subtitulo="Elija su contraseña">
      <div className="tarjeta w-full max-w-sm space-y-4 p-6">
        <p className="text-sm text-slate-600">
          Hola, <strong>{usuario?.nombre}</strong>. Ingresó con una contraseña temporal; elija una propia para continuar.
        </p>
        <FormCambiarPassword temporal onListo={() => qc.invalidateQueries({ queryKey: ['yo'] })} />
        <button type="button" className="w-full text-sm font-semibold text-slate-500" onClick={() => salir()}>
          Salir
        </button>
      </div>
    </Marco>
  );
}
