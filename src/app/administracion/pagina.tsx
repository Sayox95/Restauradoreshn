import { PermisosCatalogos, PermisosUsuarios } from '@shared/permisos';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Settings, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Encabezado } from '@/common/components/ui';
import { useAccess } from '@/common/seguridad/acceso';
import { urlCatalogos } from '@/app/modules/catalogos/urls';
import { listarUsuarios } from '@/app/modules/usuarios/api';
import { urlUsuarios } from '@/app/modules/usuarios/urls';
import { useTiempoReal } from '@/common/tiempo-real/useTiempoReal';

/** Administración: cada sección aparece según el permiso de quien entra. */
export function Administracion() {
  const { hasAccess } = useAccess();
  const gestionaUsuarios = hasAccess([PermisosUsuarios.Gestionar]);
  const usuarios = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios, enabled: gestionaUsuarios });
  useTiempoReal(['usuarios'], () => gestionaUsuarios && void usuarios.refetch());
  const pendientes = usuarios.data?.filter((u) => u.estado === 'pendiente').length ?? 0;
  const activas = usuarios.data?.filter((u) => u.estado === 'activa').length;
  const secciones = [
    {
      a: urlUsuarios,
      titulo: 'Usuarios',
      texto: activas === undefined ? 'Cuentas, perfiles y solicitudes' : `${activas} cuentas activas · perfiles y solicitudes`,
      Icono: Users,
      access: [PermisosUsuarios.Gestionar],
      aviso: pendientes ? `${pendientes} ${pendientes === 1 ? 'solicitud' : 'solicitudes'}` : null,
    },
    {
      a: urlCatalogos,
      titulo: 'Catálogos',
      texto: 'Restauradores, materiales, personal, marcas, tableros y zona horaria',
      Icono: Settings,
      access: [PermisosCatalogos.Gestionar],
      aviso: null,
    },
  ].filter((s) => hasAccess(s.access));
  return (
    <div>
      <Encabezado titulo="Administración" />
      <ul className="grid gap-3 md:grid-cols-2">
        {secciones.map(({ a, titulo, texto, Icono, aviso }) => (
          <li key={a}>
            <Link to={a} className="tarjeta flex min-h-[76px] items-center gap-4 p-4 hover:bg-slate-50">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-marca-600">
                <Icono className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{titulo}</span>
                <span className="block text-sm text-slate-500">{texto}</span>
              </span>
              {aviso && <span className="shrink-0 rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-slate-900">{aviso}</span>}
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
