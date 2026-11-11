import { Loader2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { mensajeError } from '@/common/http/api';
import { cambiarPassword } from '@/common/seguridad/api';

/** Cambio de contraseña con la actual (o la temporal que entregó el administrador). */
export function FormCambiarPassword({ temporal = false, onListo }: { temporal?: boolean; onListo: () => void }) {
  const [f, setF] = useState({ actual: '', nueva: '', confirmar: '' });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (f.nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres.');
    if (f.nueva !== f.confirmar) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    setError(null);
    try {
      await cambiarPassword(f.actual, f.nueva);
      onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };
  const campo = (k: keyof typeof f, etiqueta: string, autoComplete: string) => (
    <div>
      <label htmlFor={`cp-${k}`} className="etiqueta">
        {etiqueta}
      </label>
      <input
        id={`cp-${k}`}
        type="password"
        className="campo"
        required
        autoComplete={autoComplete}
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
    </div>
  );
  return (
    <form onSubmit={enviar} className="space-y-4">
      {campo('actual', temporal ? 'Contraseña temporal' : 'Contraseña actual', 'current-password')}
      {campo('nueva', 'Nueva contraseña', 'new-password')}
      <p className="-mt-3 text-xs text-slate-500">Mínimo 8 caracteres.</p>
      {campo('confirmar', 'Repita la nueva contraseña', 'new-password')}
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}
      <button className="btn-primario w-full" disabled={enviando}>
        {enviando && <Loader2 className="h-5 w-5 animate-spin" />} Cambiar contraseña
      </button>
    </form>
  );
}
