/**
 * Lista de registros común: en PC (lg) es una tabla con columnas; en el teléfono, una tarjeta por fila.
 * Cada pantalla declara sus columnas y su tarjeta; el comportamiento (fila que abre el registro,
 * teclado, estilos) es el mismo en toda la app.
 */
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export interface Columna<T> {
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** Clases de la celda (ancho, alineación, `whitespace-nowrap`…). */
  clase?: string;
}

interface Props<T> {
  filas: T[];
  clave: (fila: T) => string | number;
  columnas: Columna<T>[];
  /** Contenido de la tarjeta en el teléfono. */
  tarjeta: (fila: T) => ReactNode;
  /** A dónde lleva la fila (opcional). */
  enlace?: (fila: T) => string;
  /** Acción al elegir la fila, si no es un enlace (p. ej. abrir el formulario de edición). */
  alElegir?: (fila: T) => void;
  /** Fila atenuada (p. ej. registros inactivos). */
  apagada?: (fila: T) => boolean;
  etiqueta: string;
}

export function Tabla<T>({ filas, clave, columnas, tarjeta, enlace, alElegir, apagada, etiqueta }: Props<T>) {
  const navegar = useNavigate();
  const elegir = (f: T) => (enlace ? navegar(enlace(f)) : alElegir?.(f));
  const interactiva = !!(enlace || alElegir);
  return (
    <>
      {/* PC: tabla */}
      <div className="tarjeta hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-sm" aria-label={etiqueta}>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {columnas.map((c) => (
                <th key={c.titulo} scope="col" className={`px-4 py-3 ${c.clase ?? ''}`}>
                  {c.titulo}
                </th>
              ))}
              {interactiva && <th className="w-8" aria-hidden />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((f) => (
              <tr
                key={clave(f)}
                onClick={interactiva ? () => elegir(f) : undefined}
                onKeyDown={interactiva ? (e) => e.key === 'Enter' && elegir(f) : undefined}
                tabIndex={interactiva ? 0 : undefined}
                className={`${interactiva ? 'cursor-pointer hover:bg-marca-50/50 focus:bg-marca-50 focus:outline-none' : ''} ${apagada?.(f) ? 'text-slate-400' : 'text-slate-800'}`}
              >
                {columnas.map((c) => (
                  <td key={c.titulo} className={`px-4 py-3 align-middle ${c.clase ?? ''}`}>
                    {c.celda(f)}
                  </td>
                ))}
                {interactiva && (
                  <td className="pr-3 text-slate-300">
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Teléfono y tableta: tarjetas */}
      <ul className="tarjeta divide-y divide-slate-100 overflow-hidden lg:hidden" aria-label={etiqueta}>
        {filas.map((f) => {
          const contenido = (
            <>
              <div className={`min-w-0 flex-1 ${apagada?.(f) ? 'opacity-60' : ''}`}>{tarjeta(f)}</div>
              {interactiva && <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />}
            </>
          );
          const clase = 'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50';
          return (
            <li key={clave(f)}>
              {enlace ? (
                <Link to={enlace(f)} className={clase}>
                  {contenido}
                </Link>
              ) : alElegir ? (
                <button type="button" className={clase} onClick={() => alElegir(f)}>
                  {contenido}
                </button>
              ) : (
                <div className={clase}>{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
