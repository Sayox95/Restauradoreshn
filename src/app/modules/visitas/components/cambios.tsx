import { type Cambio, SIN_VALOR } from '@shared/edicion';

/**
 * Cambios «campo: antes → después» (en la confirmación y en el historial). Un elemento agregado a una
 * lista muestra solo lo nuevo; uno quitado, solo lo anterior tachado.
 */
export function ListaCambios({ cambios }: { cambios: Cambio[] }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
      {cambios.map(c => (
        <li key={c.campo} className="px-3 py-2 text-sm">
          <span className="text-slate-600">{c.etiqueta}</span>
          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            {c.antes !== SIN_VALOR || c.despues === SIN_VALOR ? (
              <span
                className={
                  c.despues === SIN_VALOR
                    ? 'font-semibold text-slate-500 line-through decoration-slate-400'
                    : 'text-slate-500 line-through decoration-slate-300'
                }
              >
                {c.antes}
              </span>
            ) : null}
            {c.antes !== SIN_VALOR && c.despues !== SIN_VALOR && (
              <span aria-hidden className="text-slate-400">
                →
              </span>
            )}
            {c.despues !== SIN_VALOR && (
              <span className="font-semibold text-slate-900">{c.despues}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
