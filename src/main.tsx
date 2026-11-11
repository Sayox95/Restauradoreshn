import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/app/App';
import { ActualizacionAutomatica } from '@/common/pwa/ActualizacionAutomatica';
import { ErrorPantalla, recargarUnaVez } from '@/common/components/ErrorPantalla';
import { ProveedorAvisos } from '@/common/components/Toast';
import { ErrorApi } from '@/common/http/api';
import { ProveedorSesion } from '@/common/seguridad/sesion';
import './index.css';
import { ProveedorConfirmacion } from '@/common/components/ConfirmDialog';

// Si una pantalla no se puede descargar (p. ej. tras publicar una versión nueva), recargar para tomar la nueva.
window.addEventListener('vite:preloadError', (e) => {
  if (recargarUnaVez()) e.preventDefault();
});

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (n, e) => !(e instanceof ErrorApi && e.status >= 400 && e.status < 500) && n < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ErrorPantalla>
          <ProveedorAvisos>
            <ProveedorConfirmacion>
              <ProveedorSesion>
                <App />
                <ActualizacionAutomatica />
              </ProveedorSesion>
            </ProveedorConfirmacion>
          </ProveedorAvisos>
        </ErrorPantalla>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
