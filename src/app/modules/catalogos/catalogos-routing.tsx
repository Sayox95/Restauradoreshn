import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { AuthRoute } from '@/common/seguridad/acceso';
import { PermisosCatalogos } from './permisos';

const GestionarCatalogos = lazy(() => import('./features/gestionar-catalogos/pagina').then((m) => ({ default: m.Catalogos })));

/** Sin opción propia en el menú principal: se entra desde Administración. */
export const rutasCatalogos = [
  <Route
    key="catalogos"
    path="admin/catalogos"
    element={
      <AuthRoute access={[PermisosCatalogos.Gestionar]}>
        <GestionarCatalogos />
      </AuthRoute>
    }
  />,
];
