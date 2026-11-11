import { MAX_FOTOS, MAX_FOTO_BYTES } from '@shared/constantes';
import { Camera, ImageOff, Loader2, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useConfirmar } from '@/common/components/ConfirmDialog';
import { Hoja } from '@/common/components/Hoja';
import { useAvisos } from '@/common/components/Toast';
import { copiaReducida } from '@/common/utils/imagen';
import type { FotoLocal } from './almacen';

const MB = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/** Vista previa de una foto: la copia reducida, o el original si el navegador puede mostrarlo. */
function Miniatura({ foto }: { foto: FotoLocal }) {
  const [url, setUrl] = useState<string | null>(foto.copia);
  useEffect(() => {
    if (foto.copia) return setUrl(foto.copia);
    const u = URL.createObjectURL(foto.original);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [foto]);
  return url ? (
    <img src={url} alt="" className="h-36 w-full rounded-t-xl object-cover" />
  ) : (
    <div className="flex h-36 items-center justify-center rounded-t-xl bg-slate-100 text-slate-400">
      <ImageOff className="h-8 w-8" />
    </div>
  );
}

/**
 * Fotos de la visita (excepción E2): 1 obligatoria y hasta 3 más, en su resolución original.
 * Cada una lleva una observación opcional.
 */
export function Fotos({ fotos, onCambio, falta }: { fotos: FotoLocal[]; onCambio: (f: FotoLocal[]) => void; falta?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [procesando, setProcesando] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [obs, setObs] = useState('');
  const confirmar = useConfirmar();
  const avisar = useAvisos();

  const elegida = async (archivo: File | undefined) => {
    if (!archivo) return;
    if (!archivo.type.startsWith('image/') && !/\.(heic|heif)$/i.test(archivo.name)) return avisar('El archivo no es una imagen.', { tipo: 'error' });
    if (archivo.size > MAX_FOTO_BYTES) return avisar(`La foto pesa ${MB(archivo.size)}; el máximo es ${MB(MAX_FOTO_BYTES)}.`, { tipo: 'error' });
    setProcesando(true);
    const copia = await copiaReducida(archivo);
    setProcesando(false);
    const nuevas = [...fotos, { original: archivo, nombre: archivo.name, copia, observacion: null }];
    onCambio(nuevas);
    setObs('');
    setEditando(nuevas.length - 1);
  };

  const quitar = async (i: number) => {
    if (await confirmar({ titulo: `¿Quitar la foto ${i + 1}?`, confirmar: 'Quitar', peligro: true })) onCambio(fotos.filter((_, j) => j !== i));
  };

  return (
    <div data-campo="fotos" className={falta ? 'rounded-xl bg-rose-50 p-2 ring-1 ring-rose-300' : ''}>
      <p className="mb-3 text-sm text-slate-600">1 fotografía obligatoria y hasta {MAX_FOTOS - 1} adicionales. Se guardan en su resolución original.</p>
      <div className="grid grid-cols-2 gap-3">
        {fotos.map((f, i) => (
          <div key={i} className="tarjeta overflow-hidden">
            <Miniatura foto={f} />
            <div className="flex items-start gap-1 p-2">
              <p className="min-w-0 flex-1 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Foto {i + 1}</span>
                {f.observacion ? ` · ${f.observacion}` : ` · ${MB(f.original.size)}`}
              </p>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label={`Observación de la foto ${i + 1}`}
                onClick={() => {
                  setObs(f.observacion ?? '');
                  setEditando(i);
                }}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                aria-label={`Quitar la foto ${i + 1}`}
                onClick={() => quitar(i)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {fotos.length < MAX_FOTOS && (
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={procesando}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
          >
            {procesando ? <Loader2 className="h-7 w-7 animate-spin" /> : fotos.length ? <Plus className="h-7 w-7" /> : <Camera className="h-7 w-7" />}
            <span className="text-sm font-semibold">{fotos.length ? 'Agregar foto' : 'Foto 1 (obligatoria)'}</span>
            <span className="text-xs">{MAX_FOTOS - fotos.length} disponible(s)</span>
          </button>
        )}
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void elegida(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <Hoja
        abierta={editando !== null}
        titulo={`Observación de la foto ${(editando ?? 0) + 1}`}
        onCerrar={() => setEditando(null)}
        pie={
          <button
            className="btn-primario w-full"
            onClick={() => {
              onCambio(fotos.map((f, j) => (j === editando ? { ...f, observacion: obs.trim() || null } : f)));
              setEditando(null);
            }}
          >
            Guardar
          </button>
        }
      >
        <textarea
          className="campo min-h-[96px]"
          maxLength={200}
          placeholder="Qué muestra la foto (opcional)"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          aria-label="Observación"
        />
      </Hoja>
    </div>
  );
}
