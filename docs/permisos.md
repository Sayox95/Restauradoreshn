# Permisos

Sistema: **`utcd_restauradores`**. Los códigos viven en `shared/permisos.ts` (única fuente para el
servidor y la app) y se siembran en la base al arrancar (`permisos`, `roles`, `rol_permisos`).
El código **nunca pregunta por un rol**: solo por permisos.

| Módulo | Permiso | Qué permite |
| --- | --- | --- |
| `utcd_restauradores_visitas` | `utcd_restauradores_visitas_registrar` | Registrar inspecciones de restaurador (y ver las propias) |
| | `utcd_restauradores_visitas_consultar` | Consultar las inspecciones de todos |
| | `utcd_restauradores_visitas_exportar` | Exportar inspecciones a CSV |
| | `utcd_restauradores_visitas_eliminar` | Eliminar inspecciones: quedan ocultas en toda la app, pero guardadas con quién, cuándo y el motivo (`visitas_registro.eliminada_*`) |
| `utcd_restauradores_usuarios` | `utcd_restauradores_usuarios_gestionar` | Usuarios y solicitudes de cuenta |
| `utcd_restauradores_catalogos` | `utcd_restauradores_catalogos_gestionar` | Restauradores, materiales, tipos, marcas, tableros, cargos y zona horaria |

## Datos visibles sin permiso adicional (lo propio)

- **Inspecciones y registros** (una sola sección): con `visitas_consultar` muestra las de todos
  (`GET /api/v1/visitas`); sin él, las **propias**: las que registró la persona y aquellas en las que
  figura en el personal (`GET /api/v1/visitas/mios`). El detalle, las fotos y el PDF siguen la misma
  regla (`visitasPropias` / `filtroVisitas` en `server/plumbing/contexto.ts`). Subir fotos y el PDF
  solo lo hace quien la registró.
- **Mi cuenta** y **cambiar contraseña**: los datos del propio usuario.

## Perfiles y permisos a la medida

Cada cuenta tiene **un perfil** (un rol): es la **plantilla** de sus permisos. En Administración →
Usuarios, al elegir el perfil se marcan sus permisos y después se puede marcar o desmarcar cada uno
(casillas agrupadas por módulo). Si los marcados no son exactamente los del perfil, la cuenta queda
**personalizada**: sus permisos se guardan en `usuario_permisos` y `usuarios.permisos_personalizados = 1`.

| Perfil | Rol | Permisos |
| --- | --- | --- |
| Técnico | `utcd_restauradores_tecnico` | visitas: registrar |
| Supervisor | `utcd_restauradores_supervisor` | visitas: registrar, consultar, exportar |
| Administrador | `utcd_restauradores_administrador` | todos |

- En SQL, «tiene permiso» se pregunta **solo** con `sqlTienePermiso` (`server/plumbing/sesion.ts`);
  nunca leyendo `rol_permisos` directo. La sesión toma los cambios al instante.
- Nadie se quita a sí mismo la gestión de usuarios ni desactiva su propia cuenta, y siempre queda al
  menos una cuenta activa que gestione usuarios.
- El historial de la cuenta muestra qué permisos se agregaron (+) y cuáles se quitaron (−).
- Las cuentas que tenían roles por módulo (0006) volvieron a un rol por perfil con exactamente los mismos
  permisos; las combinaciones que no coinciden con su perfil quedaron personalizadas (migración 0007).
- **Al migrar al SSO**: el SSO asigna permisos por rol; cada combinación personalizada necesitaría su rol
  en el SSO, salvo que TI permita permisos por persona. Consultar con TI.

## Personal de la inspección

El técnico #1 es quien inspecciona. Al agregar personal se ofrecen las cuentas activas del **mismo nivel
o menor** que **registran inspecciones** (`nivel` del perfil en `shared/permisos.ts`: técnico 1,
supervisor 2, administrador 3). El cargo de cada persona es el de su cuenta (Administración → Usuarios), elegido del catálogo de cargos (Administración → Catálogos → Cargos).

## Estado de la inspección

Por ahora una inspección tiene un solo estado: **registrada** (`registros.estado`, con restricción en la
base). Los demás estados se agregarán cuando el área usuaria los defina.
