import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { actualizarYRecargar } from '@/common/pwa/version';

const CLAVE_RECARGA = 'recarga-por-error';

/** Errores al descargar una pantalla: suelen ocurrir justo después de publicar una versión nueva. */
export const esErrorDeCarga = (e: unknown) =>
  e instanceof Error && /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError/i.test(e.message);

/** Recarga una sola vez (por minuto) tomando la versión nueva; evita ciclos de recarga. */
export function recargarUnaVez(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) || 0);
    if (Date.now() - ultima < 60_000) return false;
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
  } catch {
    // Sin sessionStorage: se recarga igual.
  }
  void actualizarYRecargar();
  return true;
}

/** Evita la pantalla en blanco: muestra un mensaje y el detalle técnico si algo falla al mostrar una pantalla. */
export class ErrorPantalla extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error al mostrar la pantalla:', error, info.componentStack);
    // La causa más común es una versión vieja de la app guardada en el teléfono que no entiende las
    // respuestas del servidor nuevo: se intenta (una vez por minuto) pasar a la versión más reciente.
    recargarUnaVez();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-4 py-10" role="alert">
        <div className="tarjeta p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
          <h1 className="mt-3 text-lg font-bold text-slate-900">
            {esErrorDeCarga(error) ? 'Hay una versión nueva de la aplicación' : 'No se pudo mostrar esta pantalla'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">Recargue para continuar. Si el problema se repite, comparta el detalle técnico.</p>
          <button className="btn-primario mt-4 w-full" onClick={() => void actualizarYRecargar()}>
            <RefreshCcw className="h-5 w-5" /> Recargar
          </button>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm font-semibold text-slate-600">Detalle técnico</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
              {`${error.name}: ${error.message}\n${window.location.pathname}`}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
