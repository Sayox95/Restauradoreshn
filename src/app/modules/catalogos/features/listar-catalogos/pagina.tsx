/** Catálogos: la lista de catálogos; cada uno abre su pantalla, donde se crean y editan sus registros. */
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Encabezado } from '@/common/components/ui';
import { SECCION, SECCIONES_CATALOGO } from '../../secciones';
import { urlCatalogo } from '../../urls';

export function ListarCatalogos() {
  return (
    <div>
      <Encabezado volver titulo="Catálogos" subtitulo="Lo que se elige en la hoja de inspección. Los registros se desactivan, no se borran." />
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SECCIONES_CATALOGO.map((clave) => {
          const { titulo, descripcion, icono: Icono } = SECCION[clave];
          return (
            <li key={clave}>
              <Link to={urlCatalogo(clave)} className="tarjeta flex min-h-[76px] items-center gap-4 p-4 hover:bg-slate-50">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-marca-600">
                  <Icono className="h-6 w-6" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">{titulo}</span>
                  <span className="block text-sm text-slate-500">{descripcion}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
