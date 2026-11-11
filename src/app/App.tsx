/** Rutas de la aplicación, armadas con las de cada módulo (app/modules/<modulo>/<modulo>-routing.tsx). */
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CambiarPasswordObligatorio } from '@/app/cuenta/cambiar-password/pagina';
import { Login } from '@/app/cuenta/ingreso/pagina';
import { accesoAdministracion, menuPrincipal } from '@/app/menu';
import { Layout } from '@/app/Layout';
import { rutasCatalogos } from '@/app/modules/catalogos';
import { urlMiCuenta } from '@/app/cuenta/urls';
import { rutasUsuarios } from '@/app/modules/usuarios';
import { rutasVisitas } from '@/app/modules/visitas';
import { Cargando } from '@/common/components/ui';
import { AuthRoute, useAccess } from '@/common/seguridad/acceso';
import { useSesion } from '@/common/seguridad/sesion';

const MiCuenta = lazy(() => import('@/app/cuenta/mi-cuenta/pagina').then((m) => ({ default: m.MiCuenta })));
const Administracion = lazy(() => import('@/app/administracion/pagina').then((m) => ({ default: m.Administracion })));

export function App() {
  const { usuario, cargando } = useSesion();
  const { hasAccess } = useAccess();
  if (cargando) return <Cargando texto="Iniciando…" />;
  if (!usuario) return <Login />;
  if (usuario.debe_cambiar_password) return <CambiarPasswordObligatorio />;
  // Todas las rutas existen para todos (cada una protegida por su permiso). El inicio («/») es la primera
  // opción del menú a la que tiene acceso (Nueva visita o, sin Registrar, Todas las visitas).
  const inicio = menuPrincipal.find((o) => hasAccess(o.access))?.a ?? urlMiCuenta;
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to={inicio} replace />} />
          {[...rutasVisitas, ...rutasUsuarios, ...rutasCatalogos]}
          <Route
            path="admin"
            element={
              <AuthRoute access={accesoAdministracion}>
                <Administracion />
              </AuthRoute>
            }
          />
          <Route path="cuenta" element={<MiCuenta />} />
          <Route path="perfil" element={<Navigate to="/cuenta" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
