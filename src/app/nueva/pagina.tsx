/** «+ Nueva»: los tipos de registro que la persona puede empezar, reunidos de cada módulo. */
import { ChevronRight, PencilLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { opcionesNueva } from '@/app/menu';
import { Encabezado } from '@/common/components/ui';
import type { OpcionNueva } from '@/common/menu/tipos';
import { useAccess } from '@/common/seguridad/acceso';
import { TONO } from '@/common/tonos';

function Opcion({ o }: { o: OpcionNueva }) {
  const [enCurso, setEnCurso] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void o.enCurso?.().then((t) => vivo && setEnCurso(t));
    return () => {
      vivo = false;
    };
  }, [o]);
  const Icono = o.icono;
  return (
    <li>
      <Link to={o.a} className="tarjeta flex min-h-[76px] items-center gap-4 p-4 hover:bg-slate-50">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-marca-600">
          <Icono className="h-6 w-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">{o.texto}</span>
          {enCurso && (
            <span
              className={`mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONO.atencion.etiqueta}`}
            >
              <PencilLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Continuar · {enCurso}</span>
            </span>
          )}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
      </Link>
    </li>
  );
}

export function Nueva() {
  const { hasAccess } = useAccess();
  const opciones = opcionesNueva.filter((o) => hasAccess(o.access));
  return (
    <div className="mx-auto max-w-2xl">
      <Encabezado titulo="Nueva" />
      <ul className="space-y-3">
        {opciones.map((o) => (
          <Opcion key={o.a} o={o} />
        ))}
      </ul>
    </div>
  );
}
