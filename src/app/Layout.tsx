import { CloudOff, Menu, Plus, WifiOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCola, useEnvioAutomatico } from '@/app/modules/visitas/components/envio';
import { PermisosVisitas } from '@/app/modules/visitas/permisos';
import { urlMisVisitas, urlNuevaVisita } from '@/app/modules/visitas/urls';
import { Cargando } from '@/common/components/ui';
import { ErrorPantalla } from '@/common/components/ErrorPantalla';
import { useAccess } from '@/common/seguridad/acceso';
import { useSesion } from '@/common/seguridad/sesion';
import { menuPrincipal } from '@/app/menu';
import { urlMiCuenta } from '@/app/cuenta/urls';
import { Notificaciones } from '@/app/Notificaciones';
import { Avatar } from '@/common/components/Avatar';
import { detenerCanal, iniciarCanal } from '@/common/tiempo-real/canal';
import { useTiempoReal } from '@/common/tiempo-real/useTiempoReal';

function useEnLinea() {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return enLinea;
}

/** Menú lateral abierto u oculto (PC); se recuerda en este navegador. */
function useMenuLateral() {
  const [abierto, setAbierto] = useState(() => {
    try {
      return localStorage.getItem('menu-lateral') !== 'oculto';
    } catch {
      return true;
    }
  });
  const cambiar = (v: boolean) => {
    setAbierto(v);
    try {
      localStorage.setItem('menu-lateral', v ? 'abierto' : 'oculto');
    } catch {
      /* almacenamiento no disponible */
    }
  };
  return [abierto, cambiar] as const;
}

export function Layout() {
  const { usuario } = useSesion();
  const { hasAccess } = useAccess();
  // Un solo menú: cada opción se muestra según su permiso.
  const nav = menuPrincipal.filter((o) => hasAccess(o.access));
  const puedeRegistrar = hasAccess([PermisosVisitas.Registrar]);
  const enLinea = useEnLinea();
  const ruta = useLocation().pathname;
  // Excepción E1: lo guardado en el teléfono se envía solo (al abrir, al volver la señal o a la app).
  useEnvioAutomatico();
  const { pendientes, enviando } = useCola();
  // La barra inferior (teléfono y tableta) muestra las secciones del menú, también en el formulario.
  const barraInferior = nav.length > 0;
  const [menuAbierto, setMenuAbierto] = useMenuLateral();
  // Canal de tiempo real: abierto mientras se usa la app con sesión (el marco solo existe con sesión).
  useEffect(() => {
    iniciarCanal();
    return detenerCanal;
  }, []);
  // Si cambia su propia cuenta (perfil, desactivación) o la configuración, se recarga la sesión:
  // el menú y los permisos se actualizan solos (y si la desactivaron, sale).
  const qc = useQueryClient();
  const idUsuario = usuario?.id;
  useTiempoReal(['usuarios', 'catalogos'], (e) => {
    if (e === 'reconectado' || e.modulo === 'catalogos' || e.id === idUsuario) void qc.invalidateQueries({ queryKey: ['yo'] });
  });

  return (
    <div className={`min-h-dvh lg:pb-8 ${barraInferior ? 'pb-24' : 'pb-8'}`}>
      <header className="sticky top-0 z-30 bg-marca-900 text-white shadow lg:border-b lg:border-slate-200 lg:bg-white lg:text-slate-900 lg:shadow-none">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="hidden h-10 w-10 items-center justify-center rounded-xl text-marca-600 hover:bg-marca-50 lg:flex"
            aria-label={menuAbierto ? 'Ocultar menú' : 'Mostrar menú'}
            aria-expanded={menuAbierto}
            aria-controls="menu-lateral"
          >
            <Menu className="h-5 w-5" />
          </button>
          <NavLink to="/" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Ir al inicio">
            <img src="/icons/icon-192.png" alt="" className="h-8 w-8" />
            <span className="truncate text-base font-bold">Inspección de Restauradores</span>
          </NavLink>
          {/* Mientras se envía no se muestra: no es «sin señal» (al guardar, la pantalla muestra el avance). */}
          {pendientes.length > 0 && !enviando && (
            <NavLink
              to={urlMisVisitas}
              className="flex h-9 items-center gap-1.5 rounded-full bg-amber-300 px-3 text-xs font-bold text-slate-900"
              title="Visitas guardadas en el teléfono que faltan por enviar"
            >
              <CloudOff className="h-4 w-4" aria-hidden /> {pendientes.length} sin enviar
            </NavLink>
          )}
          <NavLink
            to={urlMiCuenta}
            className={({ isActive }) =>
              `flex h-11 w-11 items-center justify-center rounded-full ${isActive ? 'bg-white/15 lg:bg-marca-50' : 'hover:bg-white/10 lg:hover:bg-slate-100'}`
            }
            aria-label={`Mi cuenta (${usuario?.nombre})`}
            title="Mi cuenta"
          >
            <Avatar nombre={usuario?.nombre ?? ''} tamano="chico" className="bg-white/90 text-marca-900 lg:bg-marca-100 lg:text-marca-700" />
          </NavLink>
        </div>
        {!enLinea && (
          <div className="flex items-center justify-center gap-2 bg-amber-300 px-4 py-1.5 text-center text-sm font-semibold text-slate-900" role="status">
            <WifiOff className="h-4 w-4" aria-hidden /> Sin conexión. Las visitas se guardan en el teléfono y se envían al volver la señal.
          </div>
        )}
      </header>

      {/* PC: menú lateral izquierdo que se oculta con el botón del encabezado. */}
      <aside
        id="menu-lateral"
        className={`fixed bottom-0 left-0 top-14 z-20 hidden w-60 overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 transition-[transform,visibility] duration-200 ease-out lg:block ${menuAbierto ? '' : 'lg:invisible lg:-translate-x-full'}`}
      >
        {puedeRegistrar && (
          <NavLink
            to={urlNuevaVisita}
            className="mb-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-bold text-slate-900 hover:bg-amber-200"
          >
            <Plus className="h-5 w-5" aria-hidden /> Nueva visita
          </NavLink>
        )}
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Menú</p>
        <nav aria-label="Principal" className="space-y-1">
          {nav.map(({ a, texto, icono: Icono }) => (
            <NavLink
              key={a}
              to={a}
              end={a === '/'}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${isActive ? 'bg-marca-50 text-marca-700' : 'text-slate-600 hover:bg-slate-100'}`
              }
            >
              <Icono className="h-5 w-5" aria-hidden />
              {texto}
            </NavLink>
          ))}
        </nav>
      </aside>

      <Notificaciones />
      <div className={`transition-[padding] duration-200 ease-out ${menuAbierto ? 'lg:pl-60' : ''}`}>
        <main className="mx-auto max-w-6xl px-4 pt-4 lg:px-6 lg:pt-6">
          <ErrorPantalla key={ruta}>
            {/* Al cambiar de pantalla, la nueva entra con un desvanecido corto. */}
            <div className="anim-pagina">
              <Suspense fallback={<Cargando />}>
                <Outlet />
              </Suspense>
            </div>
          </ErrorPantalla>
        </main>
      </div>

      {barraInferior && (
        <nav className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white lg:hidden" aria-label="Principal (móvil)">
          <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
            {nav.map(({ a, texto, corto, icono: Icono }) => (
              <NavLink
                key={a}
                to={a}
                end={a === '/'}
                className={({ isActive }) =>
                  `flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-marca-600' : 'text-slate-500'}`
                }
              >
                <Icono className="h-6 w-6" aria-hidden />
                {corto ?? texto}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
