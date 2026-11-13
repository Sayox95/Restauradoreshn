/** Piezas comunes de la gestión de cuentas: estado, accesos, contraseña temporal y formularios. */
import { CARGOS_PERSONAL, DOMINIO_CORREO, ESTADO_CUENTA_ETIQUETA, PATRON_USUARIO, type EstadoCuenta, usuarioDeCorreo } from '@shared/constantes';
import { MODULOS, ROLES_DE_PERFIL, ROLES_SISTEMA } from '@shared/permisos';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Hoja } from '@/common/components/Hoja';
import { Segmentado } from '@/common/components/ui';
export { Avatar } from '@/common/components/Avatar';
import { useAvisos } from '@/common/components/Toast';
import { mensajeError } from '@/common/http/api';
import { TONO_CUENTA } from '@/common/tonos';
import { aprobarCuenta, crearUsuario, editarUsuario, type Usuario } from '@/app/modules/usuarios/api';

export function BadgeCuenta({ estado }: { estado: EstadoCuenta }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONO_CUENTA[estado]}`}>
      {ESTADO_CUENTA_ETIQUETA[estado]}
    </span>
  );
}

/** Qué permiten los roles elegidos, en palabras (sale de sus permisos). */
export function resumenPermisos(roles: readonly string[]) {
  const permisos = ROLES_SISTEMA.filter((r) => roles.includes(r.codigo)).flatMap((r) => r.permisos);
  return MODULOS.flatMap((m) => m.permisos)
    .filter((p) => permisos.includes(p.codigo))
    .map((p) => p.nombre);
}

/** Accesos de la cuenta, como en el SSO: una fila por módulo con «Sin acceso» o el rol que se habilita. */
export function CamposAcceso({ roles, onRoles }: { roles: string[]; onRoles: (r: string[]) => void }) {
  const elegir = (modulo: string, codigo: string) =>
    onRoles([...roles.filter((r) => ROLES_SISTEMA.find((x) => x.codigo === r)?.modulo !== modulo), ...(codigo ? [codigo] : [])]);
  return (
    <fieldset>
      <legend className="etiqueta">Accesos</legend>
      <div className="space-y-3 rounded-xl border border-slate-200 p-3">
        {MODULOS.map((m) => {
          const delModulo = ROLES_SISTEMA.filter((r) => r.modulo === m.codigo);
          const actual = delModulo.find((r) => roles.includes(r.codigo))?.codigo ?? '';
          const opciones = [
            { valor: '', texto: 'Sin acceso' },
            ...delModulo.map((r) => ({ valor: r.codigo, texto: delModulo.length === 1 ? 'Con acceso' : r.nombre })),
          ];
          return (
            <div key={m.codigo} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{m.nombre}</span>
              <Segmentado etiqueta={`Acceso a ${m.nombre}`} opciones={opciones} valor={actual} onChange={(v) => elegir(m.codigo, v)} />
            </div>
          );
        })}
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
        {resumenPermisos(roles).map((p) => (
          <li key={p} className="flex gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden /> {p}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** Contraseña temporal: se muestra una sola vez para entregarla a la persona. */
export function ClaveTemporal({ usuario, password, onCerrar }: { usuario: string; password: string; onCerrar: () => void }) {
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
          <p>Entréguela a la persona. Solo se muestra esta vez; al ingresar deberá cambiarla por una propia.</p>
        </div>
        <dl className="space-y-3">
          <div>
            <dt className="etiqueta">Usuario</dt>
            <dd className="font-mono text-lg font-semibold text-slate-900">{usuario}</dd>
          </div>
          <div>
            <dt className="etiqueta">Contraseña temporal</dt>
            <dd className="flex items-center gap-2">
              <span className="flex-1 select-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-lg font-semibold tracking-wider text-slate-900">
                {password}
              </span>
              <button className="btn-secundario" onClick={copiar} aria-label="Copiar contraseña">
                {copiada ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
              </button>
            </dd>
          </div>
        </dl>
      </div>
    </Hoja>
  );
}

/** Alta (con contraseña temporal) o corrección de los datos de una cuenta. */
export function FormCuenta({ u, onCerrar }: { u: Usuario | null; onCerrar: () => void }) {
  const [f, setF] = useState({
    correo: u?.correo ?? '',
    nombre: u?.nombre ?? '',
    telefono: u?.telefono ?? '',
    roles: u?.roles ?? [ROLES_DE_PERFIL.tecnico[0]!],
    cargo: u?.cargo ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [creada, setCreada] = useState<{ usuario: string; password_temporal: string } | null>(null);
  const qc = useQueryClient();
  const avisar = useAvisos();
  const correo = f.correo.trim().toLowerCase();
  const usuario = correo.endsWith(`@${DOMINIO_CORREO}`) ? usuarioDeCorreo(correo) : '';

  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const datos = { ...f, correo, telefono: f.telefono.trim() || null, cargo: f.cargo || null };
      if (u) await editarUsuario(u.id, { ...datos, correo: correo || undefined });
      else setCreada(await crearUsuario(datos));
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      if (u) {
        qc.invalidateQueries({ queryKey: ['usuario', u.id] });
        avisar('Usuario actualizado');
        onCerrar();
      }
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  if (creada) return <ClaveTemporal usuario={creada.usuario} password={creada.password_temporal} onCerrar={onCerrar} />;

  return (
    <Hoja
      abierta
      titulo={u ? `Editar ${u.usuario}` : 'Nuevo usuario'}
      onCerrar={onCerrar}
      pie={
        <div>
          {error && (
            <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primario w-full" onClick={guardar} disabled={enviando}>
            {enviando && <Loader2 className="h-5 w-5 animate-spin" />} {u ? 'Guardar' : 'Crear usuario'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="etiqueta" htmlFor="u-correo">
            Correo institucional
          </label>
          <input
            id="u-correo"
            type="email"
            className="campo"
            autoCapitalize="none"
            placeholder={`nombre.apellido@${DOMINIO_CORREO}`}
            value={f.correo}
            onChange={(e) => setF({ ...f, correo: e.target.value })}
          />
          {u ? null : usuario ? (
            <p className={`mt-1 text-xs ${PATRON_USUARIO.test(usuario) ? 'text-slate-600' : 'text-rose-700'}`}>
              Usuario: <strong className="font-mono">{usuario}</strong>
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Sin correo propio: use una variante con «+», p. ej. jefe+nombre.apellido@{DOMINIO_CORREO}.</p>
          )}
        </div>
        <div>
          <label className="etiqueta" htmlFor="u-nombre">
            Nombre completo
          </label>
          <input id="u-nombre" className="campo" autoComplete="off" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="u-tel">
            Celular
          </label>
          <input id="u-tel" type="tel" inputMode="tel" className="campo" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="u-cargo">
            Cargo
          </label>
          <select id="u-cargo" className="campo" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })}>
            <option value="">— Sin cargo —</option>
            {CARGOS_PERSONAL.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Aparece en el personal de las inspecciones.</p>
        </div>
        <CamposAcceso roles={f.roles} onRoles={(roles) => setF({ ...f, roles })} />
        {!u && <p className="text-xs text-slate-500">Se generará una contraseña temporal para entregarle.</p>}
      </div>
    </Hoja>
  );
}

/** Aprobar una solicitud de cuenta: el administrador habilita los accesos. */
export function DialogoAprobar({ u, onCerrar }: { u: Usuario; onCerrar: () => void }) {
  const [roles, setRoles] = useState<string[]>(ROLES_DE_PERFIL.tecnico);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const avisar = useAvisos();
  const aprobar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await aprobarCuenta(u.id, { roles });
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      qc.invalidateQueries({ queryKey: ['usuario', u.id] });
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
            <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {error}
            </p>
          )}
          <button className="btn-exito w-full" onClick={aprobar} disabled={enviando}>
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Aprobar cuenta
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          <span className="font-mono font-semibold text-slate-900">{u.usuario}</span> · {u.correo}
        </p>
        <CamposAcceso roles={roles} onRoles={setRoles} />
      </div>
    </Hoja>
  );
}
