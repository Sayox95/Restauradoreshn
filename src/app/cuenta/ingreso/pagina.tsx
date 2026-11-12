import { useQueryClient } from '@tanstack/react-query';
import { DOMINIO_CORREO, PATRON_USUARIO, usuarioDeCorreo } from '@shared/constantes';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { mensajeError } from '@/common/http/api';
import { iniciarSesion, solicitarCuenta } from '@/common/seguridad/api';

export function Marco({ subtitulo, children }: { subtitulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-marca-900 px-4 py-10">
      <img src="/icons/icon-192.png" alt="" className="mb-4 h-16 w-16" />
      <h1 className="mb-1 text-center text-2xl font-bold text-white">Inspección de Restauradores</h1>
      <p className="mb-8 text-center text-sm text-white/70">{subtitulo}</p>
      {children}
    </div>
  );
}

function Campo({ id, etiqueta, ayuda, ...props }: { id: string; etiqueta: string; ayuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta">
        {etiqueta}
      </label>
      <input id={id} className="campo" required {...props} />
      {ayuda && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
    </div>
  );
}

/** Solicitud de cuenta con correo institucional; queda pendiente de aprobación. */
function CrearCuenta({ onVolver }: { onVolver: () => void }) {
  const [f, setF] = useState({ nombre: '', correo: '', telefono: '', password: '', confirmar: '' });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const correo = f.correo.trim().toLowerCase();
  // El usuario sale del correo: antes de la @, o después del «+» si es una variante.
  const usuario = correo.endsWith(`@${DOMINIO_CORREO}`) ? usuarioDeCorreo(correo) : '';

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario) return setError(`Use su correo institucional @${DOMINIO_CORREO}.`);
    if (f.password !== f.confirmar) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    setError(null);
    try {
      const r = await solicitarCuenta({ nombre: f.nombre, correo, telefono: f.telefono, password: f.password });
      setEnviada(r.usuario);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  if (enviada)
    return (
      <Marco subtitulo="Crear cuenta">
        <div className="tarjeta w-full max-w-sm space-y-4 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
          <p className="font-semibold text-slate-900">Solicitud enviada</p>
          <p className="text-sm text-slate-600">
            Un administrador debe aprobar su cuenta. Cuando lo haga, ingrese con su usuario <strong className="font-mono">{enviada}</strong> (o su correo) y su
            contraseña.
          </p>
          <button className="btn-primario w-full" onClick={onVolver}>
            Volver al ingreso
          </button>
        </div>
      </Marco>
    );

  return (
    <Marco subtitulo="Crear cuenta">
      <form onSubmit={enviar} className="tarjeta w-full max-w-sm space-y-4 p-6">
        <Campo id="nombre" etiqueta="Nombre completo" autoComplete="name" value={f.nombre} onChange={set('nombre')} />
        <Campo
          id="correo"
          etiqueta="Correo institucional"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder={`nombre@${DOMINIO_CORREO}`}
          value={f.correo}
          onChange={set('correo')}
          ayuda={
            usuario ? undefined : `Solo correos @${DOMINIO_CORREO}. Si no tiene uno propio, use una variante con «+»: jefe+nombre.apellido@${DOMINIO_CORREO}.`
          }
        />
        {usuario && (
          <p className={`-mt-3 text-xs ${PATRON_USUARIO.test(usuario) ? 'text-slate-600' : 'text-rose-700'}`}>
            Su usuario será <strong className="font-mono">{usuario}</strong>
          </p>
        )}
        <Campo id="telefono" etiqueta="Celular" type="tel" inputMode="tel" autoComplete="tel" value={f.telefono} onChange={set('telefono')} />
        <Campo
          id="password"
          etiqueta="Contraseña"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={f.password}
          onChange={set('password')}
          ayuda="Mínimo 8 caracteres."
        />
        <Campo id="confirmar" etiqueta="Repita la contraseña" type="password" autoComplete="new-password" value={f.confirmar} onChange={set('confirmar')} />
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primario w-full" disabled={enviando}>
          {enviando && <Loader2 className="h-5 w-5 animate-spin" />} Solicitar cuenta
        </button>
        <p className="text-center text-xs text-slate-500">Un administrador revisará y aprobará su solicitud.</p>
        <button type="button" className="w-full text-sm font-semibold text-marca-600" onClick={onVolver}>
          Ya tengo cuenta · Ingresar
        </button>
      </form>
    </Marco>
  );
}

export function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [creando, setCreando] = useState(false);
  const qc = useQueryClient();
  if (creando) return <CrearCuenta onVolver={() => setCreando(false)} />;
  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(usuario, password);
      await qc.invalidateQueries({ queryKey: ['yo'] });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Marco subtitulo="UTCD · Hojas de inspección">
      <form onSubmit={entrar} className="tarjeta w-full max-w-sm space-y-4 p-6">
        <Campo
          id="usuario"
          etiqueta="Usuario o correo"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
        <Campo
          id="password"
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primario w-full" disabled={enviando}>
          {enviando && <Loader2 className="h-5 w-5 animate-spin" />} Ingresar
        </button>
        <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-600">
          ¿No tiene cuenta?{' '}
          <button type="button" className="font-semibold text-marca-600" onClick={() => setCreando(true)}>
            Crear cuenta
          </button>
        </p>
      </form>
    </Marco>
  );
}
