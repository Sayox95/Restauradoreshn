import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { AuthRoute } from '@/common/seguridad/acceso';
import { PermisosUsuarios } from './permisos';

const ListarUsuarios = lazy(() => import('./features/listar-usuarios/pagina').then((m) => ({ default: m.Usuarios })));
const VerUsuario = lazy(() => import('./features/ver-usuario/pagina').then((m) => ({ default: m.VerUsuario })));

/** Sin opción propia en el menú principal: se entra desde Administración. */
export const rutasUsuarios = [
  <Route
    key="usuarios"
    path="admin/usuarios"
    element={
      <AuthRoute access={[PermisosUsuarios.Gestionar]}>
        <ListarUsuarios />
      </AuthRoute>
    }
  />,
  <Route
    key="usuario"
    path="admin/usuarios/:id"
    element={
      <AuthRoute access={[PermisosUsuarios.Gestionar]}>
        <VerUsuario />
      </AuthRoute>
    }
  />,
];
