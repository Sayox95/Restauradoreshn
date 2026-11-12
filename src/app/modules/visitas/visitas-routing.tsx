import { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
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
    key="visitas-inspecciones"
    path="visitas"
    element={
      <AuthRoute access={[PermisosVisitas.Registrar, PermisosVisitas.Consultar]}>
        <ListarVisitas />
      </AuthRoute>
    }
  />,
  // Direcciones anteriores: llevan a la sección única.
  <Route key="visitas-mias" path="visitas/mias" element={<Navigate to="/visitas" replace />} />,
  // Lo propio: el servidor solo entrega la visita si es de quien la pide o si tiene Consultar.
  <Route key="visitas-ver" path="visitas/:id" element={<VerVisita />} />,
];
