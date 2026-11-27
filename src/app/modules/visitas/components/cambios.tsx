import type { Cambio } from '@shared/edicion';

/** Cambios «campo: antes → después» (en la confirmación y en el historial). */
export function ListaCambios({ cambios }: { cambios: Cambio[] }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
      {cambios.map(c => (
        <li key={c.campo} className="px-3 py-2 text-sm">
          <span className="text-slate-600">{c.etiqueta}</span>
          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <span className="text-slate-500 line-through decoration-slate-300">
              {c.antes}
            </span>
            <span aria-hidden className="text-slate-400">
              →
            </span>
            <span className="font-semibold text-slate-900">{c.despues}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
