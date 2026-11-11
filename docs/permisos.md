# Permisos

Sistema: **`utcd_restauradores`**. Los códigos viven en `shared/permisos.ts` (única fuente para el
servidor y la app) y se siembran en la base al arrancar (`permisos`, `roles`, `rol_permisos`).
El código **nunca pregunta por un rol**: solo por permisos.

| Módulo | Permiso | Qué permite |
| --- | --- | --- |
| `utcd_restauradores_visitas` | `utcd_restauradores_visitas_registrar` | Registrar hojas de visita (y ver las propias) |
| | `utcd_restauradores_visitas_consultar` | Consultar las visitas de todos |
| | `utcd_restauradores_visitas_exportar` | Exportar visitas a CSV |
| `utcd_restauradores_usuarios` | `utcd_restauradores_usuarios_gestionar` | Usuarios y solicitudes de cuenta |
| `utcd_restauradores_catalogos` | `utcd_restauradores_catalogos_gestionar` | Restauradores, materiales, personal, tipos, marcas, tableros y zona horaria |

## Datos visibles sin permiso adicional (lo propio)

- **Mis visitas** (`GET /api/v1/visitas/mios`) y el detalle, fotos y PDF de una visita: quien no tiene
  `visitas_consultar` solo ve lo que registró (`filtroVisitas` en `server/plumbing/contexto.ts`).
- **Mi cuenta** y **cambiar contraseña**: los datos del propio usuario.

## Roles

| Rol | Permisos |
| --- | --- |
| `utcd_restauradores_administrador` | Todos |
| `utcd_restauradores_supervisor` | visitas: registrar, consultar, exportar |
| `utcd_restauradores_tecnico` | visitas: registrar |

## Estado de la visita

Por ahora una visita tiene un solo estado: **registrada** (`registros.estado`, con restricción en la
base). Los demás estados se agregarán cuando el área usuaria los defina.
