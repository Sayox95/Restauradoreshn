import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { AuthRoute } from '@/common/seguridad/acceso';
import { PermisosVisitas } from './permisos';

const RegistrarVisita = lazy(() => import('./features/registrar-visita/pagina').then((m) => ({ default: m.RegistrarVisita })));
const ListarVisitas = lazy(() => import('./features/listar-visitas/pagina').then((m) => ({ default: m.ListarVisitas })));
const VerVisita = lazy(() => import('./features/ver-visita/pagina').then((m) => ({ default: m.VerVisita })));

export const rutasVisitas = [
  <Route
    key="visitas-nueva"
    path="visitas/nueva"
    element={
      <AuthRoute access={[PermisosVisitas.Registrar]}>
        <RegistrarVisita />
      </AuthRoute>
    }
  />,
  <Route
    key="visitas-mias"
    path="visitas/mias"
    element={
      <AuthRoute access={[PermisosVisitas.Registrar]}>
        <ListarVisitas />
      </AuthRoute>
    }
  />,
  <Route
    key="visitas-todas"
    path="visitas"
    element={
      <AuthRoute access={[PermisosVisitas.Consultar]}>
        <ListarVisitas todas />
      </AuthRoute>
    }
  />,
  // Lo propio: el servidor solo entrega la visita si es de quien la pide o si tiene Consultar.
  <Route key="visitas-ver" path="visitas/:id" element={<VerVisita />} />,
];
