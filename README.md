# Inspección de Restauradores (UTCD)

Hojas de visita para la inspección de restauradores: captura en campo (con o sin señal), fotos en
resolución original, ficha PDF y consulta / exportación de las visitas.

- **Stack**: Cloudflare Pages (React + TypeScript + Vite) + Functions (API `/api/v1`) + D1 + R2.
- **Lineamientos**: UTCD · Apps en la nube, con las excepciones E1–E4 descritas en `CLAUDE.md`.

| Documento | Contenido |
| --- | --- |
| [docs/arquitectura.md](docs/arquitectura.md) | Estructura, módulos y decisiones |
| [docs/permisos.md](docs/permisos.md) | Permisos, roles y lo que cada quien ve |
| [docs/despliegue.md](docs/despliegue.md) | Publicar, primer administrador y desarrollo local |

```bash
npm ci
npm run verificar
```
