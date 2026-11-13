# Permisos

Sistema: **`utcd_restauradores`**. Los códigos viven en `shared/permisos.ts` (única fuente para el
servidor y la app) y se siembran en la base al arrancar (`permisos`, `roles`, `rol_permisos`).
El código **nunca pregunta por un rol**: solo por permisos.

| Módulo | Permiso | Qué permite |
| --- | --- | --- |
| `utcd_restauradores_visitas` | `utcd_restauradores_visitas_registrar` | Registrar inspecciones de restaurador (y ver las propias) |
| | `utcd_restauradores_visitas_consultar` | Consultar las inspecciones de todos |
| | `utcd_restauradores_visitas_exportar` | Exportar inspecciones a CSV |
| `utcd_restauradores_usuarios` | `utcd_restauradores_usuarios_gestionar` | Usuarios y solicitudes de cuenta |
| `utcd_restauradores_catalogos` | `utcd_restauradores_catalogos_gestionar` | Restauradores, materiales, personal, tipos, marcas, tableros y zona horaria |

## Datos visibles sin permiso adicional (lo propio)

- **Inspecciones y registros** (una sola sección): con `visitas_consultar` muestra las de todos
  (`GET /api/v1/visitas`); sin él, las **propias**: las que registró la persona y aquellas en las que
  figura en el personal (`GET /api/v1/visitas/mios`). El detalle, las fotos y el PDF siguen la misma
  regla (`visitasPropias` / `filtroVisitas` en `server/plumbing/contexto.ts`). Subir fotos y el PDF
  solo lo hace quien la registró.
- **Mi cuenta** y **cambiar contraseña**: los datos del propio usuario.

## Roles

| Rol | Permisos |
| --- | --- |
| `utcd_restauradores_administrador` | Todos |
| `utcd_restauradores_supervisor` | visitas: registrar, consultar, exportar |
| `utcd_restauradores_tecnico` | visitas: registrar |

## Personal de la inspección

El técnico #1 es quien inspecciona. Al agregar personal se ofrecen las cuentas activas del **mismo nivel
o menor** (`nivel` de cada rol en `shared/permisos.ts`: administrador 3, supervisor 2, técnico 1). El
cargo de cada persona es el de su cuenta (Administración → Usuarios).

## Estado de la inspección

Por ahora una inspección tiene un solo estado: **registrada** (`registros.estado`, con restricción en la
base). Los demás estados se agregarán cuando el área usuaria los defina.
