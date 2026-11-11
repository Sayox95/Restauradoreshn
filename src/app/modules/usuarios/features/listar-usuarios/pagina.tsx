import { ROL_ETIQUETA, type EstadoCuenta } from '@shared/constantes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirmar } from '@/common/components/ConfirmDialog';
import { useAvisos } from '@/common/components/Toast';
import { CajaError, Cargando, Encabezado, Seccion, Vacio } from '@/common/components/ui';
import { SelectorMultiple } from '@/common/components/SelectorMultiple';
import { mensajeError } from '@/common/http/api';
import { fecha } from '@/common/utils/fechas';
import { listarUsuarios, rechazarCuenta, type Usuario } from '@/app/modules/usuarios/api';
import { Avatar, BadgeCuenta, DialogoAprobar, FormCuenta } from '@/app/modules/usuarios/components/cuenta';
import { urlUsuario } from '@/app/modules/usuarios/urls';
import { useTiempoReal } from '@/common/tiempo-real/useTiempoReal';

type Filtro = Exclude<EstadoCuenta, 'pendiente'>;

/** Solicitud de cuenta hecha desde la pantalla de ingreso: se aprueba (eligiendo el perfil) o se rechaza. */
function Solicitud({ u, onAprobar }: { u: Usuario; onAprobar: () => void }) {
  const qc = useQueryClient();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const [enviando, setEnviando] = useState(false);
  const rechazar = async () => {
    if (
      !(await confirmar({
        titulo: `¿Rechazar la solicitud de ${u.nombre}?`,
        mensaje: 'No podrá ingresar. Puede volver a solicitar más adelante.',
        confirmar: 'Rechazar',
        peligro: true,
      }))
    )
      return;
    setEnviando(true);
    try {
      await rechazarCuenta(u.id);
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      avisar('Solicitud rechazada');
    } catch (e) {
      avisar(mensajeError(e), { tipo: 'error' });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <Avatar nombre={u.nombre} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{u.nombre}</p>
        <p className="truncate text-sm text-slate-500">
          <span className="font-mono">{u.usuario}</span> · {u.correo} · solicitó el {fecha(u.creado_en)}
        </p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <button className="btn-exito flex-1 sm:flex-none" disabled={enviando} onClick={onAprobar}>
          <Check className="h-5 w-5" /> Aprobar
        </button>
        <button className="btn-secundario flex-1 sm:flex-none" disabled={enviando} onClick={rechazar}>
          Rechazar
        </button>
      </div>
    </li>
  );
}

function Fila({ u }: { u: Usuario }) {
  return (
    <li>
      <Link to={urlUsuario(u.id)} className="flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-slate-50">
        <Avatar nombre={u.nombre} />
        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold ${u.estado === 'activa' ? 'text-slate-900' : 'text-slate-500'}`}>{u.nombre}</p>
          <p className="truncate text-sm text-slate-500">
            <span className="font-mono">{u.usuario}</span> · {ROL_ETIQUETA[u.rol]}
          </p>
        </div>
        <div className="hidden shrink-0 text-right text-xs text-slate-500 sm:block">
          {u.debe_cambiar_password ? 'Con clave temporal' : u.ultimo_ingreso_en ? `Ingresó el ${fecha(u.ultimo_ingreso_en)}` : 'Nunca ingresó'}
        </div>
        {u.estado !== 'activa' && <BadgeCuenta estado={u.estado} />}
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
      </Link>
    </li>
  );
}

export function Usuarios() {
  const [nuevo, setNuevo] = useState(false);
  const [aprobando, setAprobando] = useState<Usuario | null>(null);
  // Sin estados elegidos se ven todas las cuentas (las solicitudes van aparte, arriba).
  const [filtro, setFiltro] = useState<Filtro[]>([]);
  const [buscar, setBuscar] = useState('');
  const q = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios });
  useTiempoReal(['usuarios'], () => void q.refetch());
  const todos = q.data ?? [];
  const cuenta = (e: EstadoCuenta) => todos.filter((u) => u.estado === e).length;
  const pendientes = todos.filter((u) => u.estado === 'pendiente');
  const lista = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return (q.data ?? [])
      .filter((u) => u.estado !== 'pendiente' && (!filtro.length || filtro.includes(u.estado as Filtro)))
      .filter((u) => !t || [u.nombre, u.usuario, u.correo ?? ''].some((v) => v.toLowerCase().includes(t)));
  }, [q.data, filtro, buscar]);

  return (
    <div>
      <Encabezado
        volver
        titulo="Usuarios"
        subtitulo={q.data && `${cuenta('activa')} activas · ${cuenta('inactiva')} inactivas`}
        accion={
          <button className="btn-primario" onClick={() => setNuevo(true)}>
            <Plus className="h-5 w-5" /> Nuevo
          </button>
        }
      />
      {q.isLoading && <Cargando />}
      {q.error && <CajaError error={q.error} reintentar={() => q.refetch()} />}
      {pendientes.length > 0 && (
        <Seccion titulo={`Solicitudes de cuenta (${pendientes.length})`}>
          <ul className="tarjeta divide-y divide-slate-100 overflow-hidden ring-2 ring-amber-200">
            {pendientes.map((u) => (
              <Solicitud key={u.id} u={u} onAprobar={() => setAprobando(u)} />
            ))}
          </ul>
        </Seccion>
      )}
      {q.data && (
        <Seccion titulo="Cuentas">
          <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end">
            <div>
              <label className="etiqueta" htmlFor="buscar-usuarios">
                Buscar
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  id="buscar-usuarios"
                  type="search"
                  className="campo h-11 py-0 pl-9"
                  placeholder="Nombre, usuario o correo"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                />
              </div>
            </div>
            <SelectorMultiple<Filtro>
              etiqueta="Estado"
              textoTodas="Todas"
              valor={filtro}
              onChange={setFiltro}
              opciones={[
                { valor: 'activa', texto: `Activas (${cuenta('activa')})` },
                { valor: 'inactiva', texto: `Inactivas (${cuenta('inactiva')})` },
                { valor: 'rechazada', texto: `Rechazadas (${cuenta('rechazada')})` },
              ]}
            />
          </div>
          {lista.length ? (
            <ul className="tarjeta divide-y divide-slate-100 overflow-hidden">
              {lista.map((u) => (
                <Fila key={u.id} u={u} />
              ))}
            </ul>
          ) : (
            <div className="tarjeta">
              <Vacio texto={buscar ? 'Ninguna cuenta coincide con la búsqueda.' : 'No hay cuentas en este estado.'} />
            </div>
          )}
        </Seccion>
      )}
      {nuevo && <FormCuenta u={null} onCerrar={() => setNuevo(false)} />}
      {aprobando && <DialogoAprobar u={aprobando} onCerrar={() => setAprobando(null)} />}
    </div>
  );
}
