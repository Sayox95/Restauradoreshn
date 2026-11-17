/** Piezas comunes de la gestión de cuentas: estado, perfil y permisos, contraseña temporal y formularios. */
import {
  DOMINIO_CORREO,
  ESTADO_CUENTA_ETIQUETA,
  PATRON_USUARIO,
  ROL_ETIQUETA,
  ROLES,
  type EstadoCuenta,
  type Rol,
  usuarioDeCorreo,
} from '@shared/constantes';
import {
  usuarioCrearEsquema,
  usuarioEditarFormEsquema,
} from '@shared/esquemas';
import {
  igualAlPerfil,
  MODULOS,
  type Permiso,
  permisosDePerfil,
} from '@shared/permisos';
import { Check, Copy, KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  CampoForm,
  ErrorServidor,
  useFormulario,
} from '@components/formulario';
import { Hoja } from '@components/hoja';
export { Avatar } from '@components/avatar';
import { useAvisos } from '@components/toast';
import { mensajeError } from '@common/http/api';
import { TONO_CUENTA, TONO_PERSONALIZADO } from '@common/tonos';
import {
  aprobarCuenta,
  crearUsuario,
  type DatosUsuario,
  editarUsuario,
  type Usuario,
} from '@modules/usuarios/api';
import { useCargos, useRecargarUsuarios } from '../hooks/useUsuarios';

export function BadgeCuenta({ estado }: { estado: EstadoCuenta }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONO_CUENTA[estado]}`}
    >
      {ESTADO_CUENTA_ETIQUETA[estado]}
    </span>
  );
}

/**
 * Acceso de una cuenta: perfil y permisos. El perfil es la plantilla: al elegirlo se marcan sus
 * permisos, y luego se puede marcar o desmarcar cada uno, agrupados por módulo.
 */
export function CamposAcceso({
  rol,
  permisos,
  onRol,
  onPermisos,
}: {
  rol: Rol;
  permisos: string[];
  onRol: (r: Rol) => void;
  onPermisos: (p: string[]) => void;
}) {
  const aMedida = !igualAlPerfil(rol, permisos);
  const alternar = (p: string) =>
    onPermisos(
      permisos.includes(p) ? permisos.filter(x => x !== p) : [...permisos, p],
    );
  return (
    <>
      <div>
        <label className="etiqueta" htmlFor="u-perfil">
          Perfil
        </label>
        <select
          id="u-perfil"
          className="campo"
          value={rol}
          onChange={e => {
            const r = e.target.value as Rol;
            onRol(r);
            onPermisos(permisosDePerfil(r));
          }}
        >
          {ROLES.map(r => (
            <option key={r} value={r}>
              {ROL_ETIQUETA[r]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          El perfil marca sus permisos; después puede ajustar cada uno.
        </p>
      </div>
      <fieldset>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
          <legend className="etiqueta mb-0">Permisos</legend>
          {aMedida && (
            <span className="flex items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ${TONO_PERSONALIZADO}`}
              >
                Personalizado
              </span>
              <button
                type="button"
                className="font-semibold text-marca-600 hover:underline"
                onClick={() => onPermisos(permisosDePerfil(rol))}
              >
                Volver a los del perfil
              </button>
            </span>
          )}
        </div>
        <div className="space-y-2">
          {MODULOS.map(m => (
            <div key={m.codigo} className="rounded-xl border border-slate-200">
              <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {m.nombre}
              </p>
              <ul>
                {m.permisos.map(p => {
                  const marcado = permisos.includes(p.codigo);
                  return (
                    <li key={p.codigo}>
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={marcado}
                          onChange={() => alternar(p.codigo)}
                        />
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-marca-500 ${
                            marcado
                              ? 'border-marca-600 bg-marca-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                          aria-hidden
                        >
                          {marcado && (
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          )}
                        </span>
                        <span className="text-sm text-slate-800">
                          {p.nombre}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {!permisos.length && (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            Sin permisos: solo podrá ver su cuenta.
          </p>
        )}
      </fieldset>
    </>
  );
}

/** Contraseña temporal: se muestra una sola vez para entregarla a la persona. */
export function ClaveTemporal({
  usuario,
  password,
  onCerrar,
}: {
  usuario: string;
  password: string;
  onCerrar: () => void;
}) {
  const [copiada, setCopiada] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiada(true);
    } catch {
      /* el navegador no permitió copiar: queda a la vista */
    }
  };
  return (
    <Hoja
      abierta
      titulo="Contraseña temporal"
      onCerrar={onCerrar}
      pie={
        <button className="btn-primario w-full" onClick={onCerrar}>
          Listo
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Entréguela a la persona. Solo se muestra esta vez; al ingresar
            deberá cambiarla por una propia.
          </p>
        </div>
        <dl className="space-y-3">
          <div>
            <dt className="etiqueta">Usuario</dt>
            <dd className="font-mono text-lg font-semibold text-slate-900">
              {usuario}
            </dd>
          </div>
          <div>
            <dt className="etiqueta">Contraseña temporal</dt>
            <dd className="flex items-center gap-2">
              <span className="flex-1 select-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-lg font-semibold tracking-wider text-slate-900">
                {password}
              </span>
              <button
                className="btn-secundario"
                onClick={copiar}
                aria-label="Copiar contraseña"
              >
                {copiada ? (
                  <Check className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </dd>
          </div>
        </dl>
      </div>
    </Hoja>
  );
}

/** Alta (con contraseña temporal) o corrección de los datos de una cuenta. */
export function FormCuenta({
  u,
  onCerrar,
}: {
  u: Usuario | null;
  onCerrar: () => void;
}) {
  // Al crear, el correo y el celular son obligatorios; al editar, una cuenta antigua puede no tener correo.
  const esquema = (
    u ? usuarioEditarFormEsquema : usuarioCrearEsquema
  ) as typeof usuarioCrearEsquema;
  const form = useFormulario(esquema, {
    correo: u?.correo ?? '',
    nombre: u?.nombre ?? '',
    telefono: u?.telefono ?? '',
    rol: u?.rol ?? 'tecnico',
    permisos: (u?.permisos ??
      permisosDePerfil(u?.rol ?? 'tecnico')) as Permiso[],
    cargo_id: u?.cargo_id ?? null,
  });
  const cargos = useCargos().data ?? [];
  // Si su cargo actual fue desactivado en el catálogo, se sigue mostrando para no perderlo al guardar.
  const opcionesCargo =
    u?.cargo_id && u.cargo && !cargos.some(c => c.id === u.cargo_id)
      ? [...cargos, { id: u.cargo_id, nombre: u.cargo }]
      : cargos;
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<{
    usuario: string;
    password_temporal: string;
  } | null>(null);
  const recargar = useRecargarUsuarios();
  const avisar = useAvisos();
  const correo = String(form.watch('correo') ?? '')
    .trim()
    .toLowerCase();
  const usuario = correo.endsWith(`@${DOMINIO_CORREO}`)
    ? usuarioDeCorreo(correo)
    : '';
  const rol = form.watch('rol') as Rol;
  const permisos = form.watch('permisos') as string[];

  const guardar = form.handleSubmit(async d => {
    setError(null);
    try {
      const datos = d as DatosUsuario;
      if (u) await editarUsuario(u.id, datos);
      else setCreada(await crearUsuario(datos));
      void recargar(u?.id);
      if (u) {
        avisar('Usuario actualizado');
        onCerrar();
      }
    } catch (e) {
      setError(mensajeError(e));
    }
  });

  if (creada)
    return (
      <ClaveTemporal
        usuario={creada.usuario}
        password={creada.password_temporal}
        onCerrar={onCerrar}
      />
    );

  return (
    <Hoja
      abierta
      titulo={u ? `Editar ${u.usuario}` : 'Nuevo usuario'}
      onCerrar={onCerrar}
      pie={
        <div className="space-y-2">
          <ErrorServidor mensaje={error} />
          <button
            className="btn-primario w-full"
            onClick={guardar}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}{' '}
            {u ? 'Guardar' : 'Crear usuario'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <CampoForm
          form={form}
          nombre="correo"
          id="u-correo"
          type="email"
          autoCapitalize="none"
          placeholder={`nombre.apellido@${DOMINIO_CORREO}`}
          etiqueta="Correo institucional"
          ayuda={
            u || usuario
              ? undefined
              : `Sin correo propio: use una variante con «+», p. ej. jefe+nombre.apellido@${DOMINIO_CORREO}.`
          }
        />
        {!u && usuario && (
          <p
            className={`-mt-3 text-xs ${PATRON_USUARIO.test(usuario) ? 'text-slate-600' : 'text-rose-700'}`}
          >
            Usuario: <strong className="font-mono">{usuario}</strong>
          </p>
        )}
        <CampoForm
          form={form}
          nombre="nombre"
          id="u-nombre"
          autoComplete="off"
          etiqueta="Nombre completo"
        />
        <CampoForm
          form={form}
          nombre="telefono"
          id="u-tel"
          type="tel"
          inputMode="tel"
          etiqueta="Celular"
        />
        <div>
          <label className="etiqueta" htmlFor="u-cargo">
            Cargo
          </label>
          <select
            id="u-cargo"
            className="campo"
            {...form.register('cargo_id', {
              setValueAs: v => (v === '' || v === null ? null : Number(v)),
            })}
          >
            <option value="">— Sin cargo —</option>
            {opcionesCargo.map(c => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Aparece en el personal de las inspecciones.
          </p>
        </div>
        <CamposAcceso
          rol={rol}
          permisos={permisos}
          onRol={r => form.setValue('rol', r)}
          onPermisos={p => form.setValue('permisos', p as Permiso[])}
        />
        {!u && (
          <p className="text-xs text-slate-500">
            Se generará una contraseña temporal para entregarle.
          </p>
        )}
      </div>
    </Hoja>
  );
}

/** Aprobar una solicitud de cuenta: el administrador elige el perfil y, si hace falta, ajusta los permisos. */
export function DialogoAprobar({
  u,
  onCerrar,
}: {
  u: Usuario;
  onCerrar: () => void;
}) {
  const [rol, setRol] = useState<Rol>('tecnico');
  const [permisos, setPermisos] = useState<string[]>(() =>
    permisosDePerfil('tecnico'),
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recargar = useRecargarUsuarios();
  const avisar = useAvisos();
  const aprobar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await aprobarCuenta(u.id, { rol, permisos });
      void recargar(u.id);
      avisar('Cuenta aprobada');
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Hoja
      abierta
      titulo={`Aprobar a ${u.nombre}`}
      onCerrar={onCerrar}
      pie={
        <div>
          {error && (
            <p
              className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            className="btn-exito w-full"
            onClick={aprobar}
            disabled={enviando}
          >
            {enviando ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}{' '}
            Aprobar cuenta
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          <span className="font-mono font-semibold text-slate-900">
            {u.usuario}
          </span>{' '}
          · {u.correo}
        </p>
        <CamposAcceso
          rol={rol}
          permisos={permisos}
          onRol={setRol}
          onPermisos={setPermisos}
        />
      </div>
    </Hoja>
  );
}
