/**
 * Catálogos del formulario de visita. Se piden al servidor y se guarda una copia en el teléfono para
 * poder capturar sin señal (excepción E1); sin conexión se usa esa copia.
 */
import type { CatalogosVisita } from '@shared/tipos';
import { useQuery } from '@tanstack/react-query';
import { ErrorApi } from '@/common/http/api';
import { catalogosVisita } from '@/app/modules/catalogos/api';
import { guardarCatalogosLocales, leerCatalogosLocales } from './almacen';

async function cargar(): Promise<CatalogosVisita & { local?: boolean }> {
  try {
    const c = await catalogosVisita();
    await guardarCatalogosLocales(c).catch(() => {});
    return c;
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 0) {
      const local = await leerCatalogosLocales().catch(() => undefined);
      if (local) return { ...local, local: true };
    }
    throw e;
  }
}

export const useCatalogosVisita = () => useQuery({ queryKey: ['catalogos-visita'], queryFn: cargar, staleTime: 5 * 60_000 });

const igual = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase();

/** Datos del catálogo que dependen de lo elegido (modelos de la marca, campos del tablero…). */
export function opcionesDe(c: CatalogosVisita | undefined, marca: string | null | undefined) {
  const m = c?.marcas.find((x) => igual(x.marca, marca));
  return {
    marca: m,
    camposTablero: c?.tableros.find((t) => igual(t.marca, marca))?.campos ?? [],
    modem: (marcaModem: string | null | undefined) => c?.modems.find((x) => igual(x.marca, marcaModem)),
  };
}
