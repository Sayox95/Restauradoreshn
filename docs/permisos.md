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

## Roles (accesos por módulo, como en el SSO)

A cada cuenta se le habilita cada módulo por separado: uno o más roles, **a lo sumo uno por módulo**
(Administración → Usuarios → «Accesos»). La pantalla asigna roles, nunca permisos sueltos.

| Módulo | Rol | Permisos |
| --- | --- | --- |
| Inspecciones | `utcd_restauradores_tecnico` (Técnico) | visitas: registrar |
| | `utcd_restauradores_supervisor` (Supervisor) | visitas: registrar, consultar, exportar |
| Usuarios | `utcd_restauradores_admin_usuarios` | usuarios: gestionar |
| Catálogos | `utcd_restauradores_admin_catalogos` | catálogos: gestionar |

`usuarios.rol` guarda solo un perfil de resumen (compatibilidad); el acceso sale de los roles. Las
cuentas con el rol «Administrador» anterior quedaron con Supervisor + Usuarios + Catálogos
(migración 0006). Nadie puede quitarse a sí mismo el acceso a Usuarios.

## Personal de la inspección

El técnico #1 es quien inspecciona. Al agregar personal se ofrecen las cuentas activas del **mismo nivel
o menor** (`nivel` de su rol en Inspecciones, en `shared/permisos.ts`: supervisor 2, técnico 1). El
cargo de cada persona es el de su cuenta (Administración → Usuarios).

## Estado de la inspección

Por ahora una inspección tiene un solo estado: **registrada** (`registros.estado`, con restricción en la
base). Los demás estados se agregarán cuando el área usuaria los defina.
