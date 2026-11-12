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
  (`GET /api/v1/visitas`); sin él, las que registró la persona (`GET /api/v1/visitas/mios`). El detalle,
  las fotos y el PDF siguen la misma regla (`filtroVisitas` en `server/plumbing/contexto.ts`).
- **Mi cuenta** y **cambiar contraseña**: los datos del propio usuario.

## Roles

| Rol | Permisos |
| --- | --- |
| `utcd_restauradores_administrador` | Todos |
| `utcd_restauradores_supervisor` | visitas: registrar, consultar, exportar |
| `utcd_restauradores_tecnico` | visitas: registrar |

## Estado de la inspección

Por ahora una inspección tiene un solo estado: **registrada** (`registros.estado`, con restricción en la
base). Los demás estados se agregarán cuando el área usuaria los defina.
