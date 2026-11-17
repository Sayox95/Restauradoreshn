import { DOMINIO_CORREO, PATRON_USUARIO, usuarioDeCorreo } from '@shared/constantes';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { loginEsquema, registroFormEsquema } from '@shared/esquemas';
import { type ReactNode, useState } from 'react';
import { CampoForm, ErrorServidor, useFormulario } from '@/common/components/Formulario';
import { mensajeError } from '@/common/http/api';
import { iniciarSesion, solicitarCuenta } from '@/common/seguridad/api';
import { tomarAvisoIngreso, useRecargarSesion } from '@/common/seguridad/sesion';

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

/** Solicitud de cuenta con correo institucional; queda pendiente de aprobación. */
function CrearCuenta({ onVolver }: { onVolver: () => void }) {
  const form = useFormulario(registroFormEsquema, { nombre: '', correo: '', telefono: '', password: '', confirmar: '' });
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState<string | null>(null);
  const correo = (form.watch('correo') ?? '').trim().toLowerCase();
  // El usuario sale del correo: antes de la @, o después del «+» si es una variante.
  const usuario = correo.endsWith(`@${DOMINIO_CORREO}`) ? usuarioDeCorreo(correo) : '';

  const enviar = form.handleSubmit(async (d) => {
    setError(null);
    try {
      const r = await solicitarCuenta({ nombre: d.nombre, correo: d.correo, telefono: d.telefono, password: d.password });
      setEnviada(r.usuario);
    } catch (err) {
      setError(mensajeError(err));
    }
  });

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
      <form onSubmit={enviar} className="tarjeta w-full max-w-sm space-y-4 p-6" noValidate>
        <CampoForm form={form} nombre="nombre" id="nombre" etiqueta="Nombre completo" autoComplete="name" />
        <CampoForm
          form={form}
          nombre="correo"
          id="correo"
          etiqueta="Correo institucional"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder={`nombre@${DOMINIO_CORREO}`}
          ayuda={
            usuario ? undefined : `Solo correos @${DOMINIO_CORREO}. Si no tiene uno propio, use una variante con «+»: jefe+nombre.apellido@${DOMINIO_CORREO}.`
          }
        />
        {usuario && (
          <p className={`-mt-3 text-xs ${PATRON_USUARIO.test(usuario) ? 'text-slate-600' : 'text-rose-700'}`}>
            Su usuario será <strong className="font-mono">{usuario}</strong>
          </p>
        )}
        <CampoForm form={form} nombre="telefono" id="telefono" etiqueta="Celular" type="tel" inputMode="tel" autoComplete="tel" />
        <CampoForm form={form} nombre="password" id="password" etiqueta="Contraseña" type="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres." />
        <CampoForm form={form} nombre="confirmar" id="confirmar" etiqueta="Repita la contraseña" type="password" autoComplete="new-password" />
        <ErrorServidor mensaje={error} />
        <button className="btn-primario w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />} Solicitar cuenta
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
  const form = useFormulario(loginEsquema, { usuario: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const recargarSesion = useRecargarSesion();
  // «Su sesión terminó…»: solo si la sesión terminó sin que la persona saliera (se lee una vez).
  const [aviso] = useState(tomarAvisoIngreso);
  if (creando) return <CrearCuenta onVolver={() => setCreando(false)} />;
  const entrar = form.handleSubmit(async (d) => {
    setError(null);
    try {
      await iniciarSesion(d.usuario, d.password);
      await recargarSesion();
    } catch (err) {
      setError(mensajeError(err));
    }
  });

  return (
    <Marco subtitulo="UTCD · Hojas de inspección">
      <form onSubmit={entrar} className="tarjeta w-full max-w-sm space-y-4 p-6" noValidate>
        {aviso && !error && (
          <p className="rounded-lg bg-marca-50 px-3 py-2 text-sm text-marca-900" role="status">
            {aviso}
          </p>
        )}
        <CampoForm form={form} nombre="usuario" id="usuario" etiqueta="Usuario o correo" autoComplete="username" autoCapitalize="none" autoFocus />
        <CampoForm form={form} nombre="password" id="password" etiqueta="Contraseña" type="password" autoComplete="current-password" />
        <ErrorServidor mensaje={error} />
        <button className="btn-primario w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />} Ingresar
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
