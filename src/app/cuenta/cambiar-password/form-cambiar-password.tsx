import { cambiarPasswordFormEsquema } from '@shared/esquemas';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { CampoForm, ErrorServidor, useFormulario } from '@components/formulario';
import { mensajeError } from '@common/http/api';
import { cambiarPassword } from '@common/seguridad/api';

/** Cambio de contraseña con la actual (o la temporal que entregó el administrador). */
export function FormCambiarPassword({ temporal = false, onListo }: { temporal?: boolean; onListo: () => void }) {
  const form = useFormulario(cambiarPasswordFormEsquema, { actual: '', nueva: '', confirmar: '' });
  const [error, setError] = useState<string | null>(null);
  const enviar = form.handleSubmit(async (d) => {
    setError(null);
    try {
      await cambiarPassword(d.actual, d.nueva);
      onListo();
    } catch (err) {
      setError(mensajeError(err));
    }
  });
  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <CampoForm
        form={form}
        nombre="actual"
        id="cp-actual"
        type="password"
        autoComplete="current-password"
        etiqueta={temporal ? 'Contraseña temporal' : 'Contraseña actual'}
      />
      <CampoForm
        form={form}
        nombre="nueva"
        id="cp-nueva"
        type="password"
        autoComplete="new-password"
        etiqueta="Nueva contraseña"
        ayuda="Mínimo 8 caracteres."
      />
      <CampoForm form={form} nombre="confirmar" id="cp-confirmar" type="password" autoComplete="new-password" etiqueta="Repita la nueva contraseña" />
      <ErrorServidor mensaje={error} />
      <button className="btn-primario w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />} Cambiar contraseña
      </button>
    </form>
  );
}
