import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { AuthRoute } from '@/common/seguridad/acceso';
import { PermisosCatalogos } from './permisos';

const ListarCatalogos = lazy(() => import('./features/listar-catalogos/pagina').then((m) => ({ default: m.ListarCatalogos })));
const GestionarCatalogo = lazy(() => import('./features/gestionar-catalogos/pagina').then((m) => ({ default: m.GestionarCatalogo })));

/** Sin opción propia en el menú principal: se entra desde Administración. */
export const rutasCatalogos = [
  <Route
    key="catalogos"
    path="admin/catalogos"
    element={
      <AuthRoute access={[PermisosCatalogos.Gestionar]}>
        <ListarCatalogos />
      </AuthRoute>
    }
  />,
  <Route
    key="catalogo"
    path="admin/catalogos/:catalogo"
    element={
      <AuthRoute access={[PermisosCatalogos.Gestionar]}>
        <GestionarCatalogo />
      </AuthRoute>
    }
  />,
];
