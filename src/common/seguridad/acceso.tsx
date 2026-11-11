import { type Permiso, tieneAcceso } from '@shared/permisos';
import type { ReactNode } from 'react';
import { useSesion } from '@/common/seguridad/sesion';

/**
 * Permisos en pantalla, como useAccess() del marco de TI: los códigos llegan con la sesión.
 * Ocultar un botón es comodidad: el servidor siempre valida el permiso.
 */
export function useAccess() {
  const { usuario } = useSesion();
  return { hasAccess: (permisos: readonly Permiso[]) => !!usuario && tieneAcceso(usuario.permisos, permisos) };
}

/**
 * Ruta protegida: sin alguno de los permisos no se abre, aunque se escriba la dirección.
 * Muestra «Sin acceso» en lugar de redirigir (redirigir a otra ruta protegida podría dar vueltas).
 */
export function AuthRoute({ access, children }: { access: readonly Permiso[]; children: ReactNode }) {
  const { hasAccess } = useAccess();
  if (hasAccess(access)) return <>{children}</>;
  return (
    <div className="tarjeta mx-auto mt-6 max-w-md p-6 text-center">
      <p className="font-semibold text-slate-900">Sin acceso</p>
      <p className="mt-1 text-sm text-slate-600">Su cuenta no tiene permiso para esta sección.</p>
    </div>
  );
}
