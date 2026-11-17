/** Eliminar una inspección (permiso Eliminar): pide el motivo, que queda en el registro. */
import { Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eliminarVisitaEsquema } from '@shared/esquemas';
import { ErrorCampo, ErrorServidor, useFormulario } from '@components/formulario';
import { Hoja } from '@components/hoja';
import { useAvisos } from '@components/toast';
import { mensajeError } from '@common/http/api';
import { useEliminarInspeccion } from '../hooks/useInspecciones';
import { urlInspecciones } from '../urls';

export function BotonEliminar({ id, folio }: { id: number; folio: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <div className="tarjeta overflow-hidden">
        <button onClick={() => setAbierta(true)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
          <Trash2 className="h-5 w-5 shrink-0 text-rose-500" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-rose-700">Eliminar inspección</span>
            <span className="block text-xs text-slate-500">Deja de verse en la app; queda guardada con el motivo.</span>
          </span>
        </button>
      </div>
      {abierta && <DialogoEliminar id={id} folio={folio} onCerrar={() => setAbierta(false)} />}
    </>
  );
}

function DialogoEliminar({ id, folio, onCerrar }: { id: number; folio: string; onCerrar: () => void }) {
  const form = useFormulario(eliminarVisitaEsquema, { motivo: '' });
  const [error, setError] = useState<string | null>(null);
  const eliminarInspeccion = useEliminarInspeccion();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const motivo = form.watch('motivo') ?? '';
  const eliminar = form.handleSubmit(async (d) => {
    setError(null);
    try {
      await eliminarInspeccion(id, d.motivo);
      avisar('Inspección eliminada');
      navegar(urlInspecciones, { replace: true });
    } catch (e) {
      setError(mensajeError(e));
    }
  });
  return (
    <Hoja
      abierta
      titulo="Eliminar inspección"
      onCerrar={onCerrar}
      pie={
        <div className="space-y-2">
          <ErrorServidor mensaje={error} />
          <button className="btn-peligro w-full" onClick={eliminar} disabled={form.formState.isSubmitting || !motivo.trim()}>
            {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />} Eliminar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          La inspección <span className="font-mono font-semibold text-slate-900">{folio}</span> dejará de verse en listas, detalle y CSV. Sus datos, fotos y PDF
          se conservan.
        </p>
        <div>
          <label className="etiqueta" htmlFor="motivo-eliminar">
            Motivo
          </label>
          <textarea
            id="motivo-eliminar"
            className="campo min-h-[88px]"
            maxLength={300}
            placeholder="P. ej. inspección de prueba"
            {...form.register('motivo')}
          />
          <ErrorCampo form={form} nombre="motivo" />
        </div>
      </div>
    </Hoja>
  );
}
