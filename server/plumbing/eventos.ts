/**
 * Nombres de los eventos de dominio de cada acción auditada (lineamientos v2 §7): en pasado y en
 * PascalCase, los mismos que tendrán en la bitácora por eventos del marco de TI. Única fuente: al
 * agregar una acción que se audita, se agrega aquí (una prueba revisa que ninguna quede sin nombre).
 */
const ENTIDAD_CATALOGO: Record<string, string> = {
  restauradores: 'Restaurador',
  materiales: 'Material',
  tipos: 'TipoRestaurador',
  marcas: 'MarcaModelo',
  cargos: 'Cargo',
};

export const EVENTOS: Record<string, string> = {
  'visita.registrar': 'InspeccionRegistrada',
  'visita.subir_foto': 'FotoInspeccionSubida',
  'visita.subir_copia_foto': 'CopiaFotoInspeccionSubida',
  'visita.archivar_pdf': 'FichaInspeccionArchivada',
  'visita.eliminar': 'InspeccionEliminada',
  'usuario.solicitar_cuenta': 'CuentaSolicitada',
  'usuario.crear': 'CuentaCreada',
  'usuario.editar': 'CuentaEditada',
  'usuario.aprobar': 'CuentaAprobada',
  'usuario.rechazar': 'SolicitudCuentaRechazada',
  'usuario.desactivar': 'CuentaDesactivada',
  'usuario.activar': 'CuentaActivada',
  'usuario.restablecer_password': 'ContrasenaRestablecida',
  'usuario.cerrar_sesiones': 'SesionesCerradas',
  'usuario.cambiar_password': 'ContrasenaCambiada',
  'tableros.editar': 'TableroControlActualizado',
  'configuracion.editar': 'ConfiguracionActualizada',
  ...Object.fromEntries(
    Object.entries(ENTIDAD_CATALOGO).flatMap(([cat, nombre]) => [
      [`${cat}.crear`, `${nombre}Creado`],
      [`${cat}.editar`, `${nombre}Editado`],
    ]),
  ),
};

/** Nombre del evento de una acción; si no está en la lista, uno genérico (la prueba lo detecta). */
export const eventoDe = (accion: string, entidad: string) =>
  EVENTOS[`${entidad}.${accion}`] ?? `${entidad}_${accion}`.replace(/(^|_)(\w)/g, (_, __, l: string) => l.toUpperCase());
