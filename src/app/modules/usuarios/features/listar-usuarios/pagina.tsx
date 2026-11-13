import { ROL_ETIQUETA, type EstadoCuenta } from '@shared/constantes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { type Columna, Tabla } from '@/common/components/Tabla';
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

const ultimoIngreso = (u: Usuario) => (u.debe_cambiar_password ? 'Con clave temporal' : u.ultimo_ingreso_en ? fecha(u.ultimo_ingreso_en) : 'Nunca ingresó');

const COLUMNAS: Columna<Usuario>[] = [
  {
    titulo: 'Nombre',
    celda: (u) => (
      <span className="flex items-center gap-3">
        <Avatar nombre={u.nombre} tamano="chico" />
        <span className="font-semibold">{u.nombre}</span>
      </span>
    ),
  },
  { titulo: 'Usuario', celda: (u) => <span className="font-mono">{u.usuario}</span> },
  { titulo: 'Perfil', celda: (u) => ROL_ETIQUETA[u.rol] },
  { titulo: 'Cargo', celda: (u) => u.cargo ?? '—' },
  { titulo: 'Estado', celda: (u) => <BadgeCuenta estado={u.estado} /> },
  { titulo: 'Último ingreso', celda: ultimoIngreso, clase: 'whitespace-nowrap' },
];

function TarjetaUsuario({ u }: { u: Usuario }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar nombre={u.nombre} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{u.nombre}</p>
        <p className="truncate text-sm text-slate-500">
          <span className="font-mono">{u.usuario}</span> · {ROL_ETIQUETA[u.rol]}
        </p>
      </div>
      {u.estado !== 'activa' && <BadgeCuenta estado={u.estado} />}
    </div>
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
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                className="campo h-11 py-0 pl-9"
                placeholder="Buscar por nombre, usuario o correo"
                aria-label="Buscar cuentas"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
              />
            </div>
            <SelectorMultiple<Filtro>
              etiqueta="Estado"
              textoTodas="Todos los estados"
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
            <Tabla
              etiqueta="Cuentas"
              filas={lista}
              clave={(u) => u.id}
              columnas={COLUMNAS}
              tarjeta={(u) => <TarjetaUsuario u={u} />}
              enlace={(u) => urlUsuario(u.id)}
              apagada={(u) => u.estado !== 'activa'}
            />
          ) : (
            <div className="tarjeta">
              <Vacio texto={buscar ? 'Ninguna cuenta coincide con la búsqueda.' : 'No hay cuentas en este estado.'} />
            </div>
          )}
        </>
      )}
      {nuevo && <FormCuenta u={null} onCerrar={() => setNuevo(false)} />}
      {aprobando && <DialogoAprobar u={aprobando} onCerrar={() => setAprobando(null)} />}
    </div>
  );
}
