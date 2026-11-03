# `.github` — automatización en GitHub

> Este archivo no se llama `README.md` a propósito: GitHub muestra en la portada del repo el `README.md` de `.github/` antes que el de la raíz, y aquí queremos que se vea el principal.

| Archivo | Qué hace |
| --- | --- |
| `workflows/ci.yml` | Revisa cada push a `main` y cada pull request → ver `workflows/README.md`. |
| `dependabot.yml` | Abre pull requests con actualizaciones de dependencias: npm cada lunes (las menores y parches agrupadas en una sola) y las acciones de GitHub cada mes. |

## Por qué

- **Dependabot:** la mayoría de los hackeos a apps web entran por dependencias viejas con fallas conocidas. Con pull requests automáticos, actualizar es revisar y aceptar; el CI corre sobre cada una antes, así se ve si algo se rompe.
- **Agrupar menores y parches** evita una avalancha de pull requests chicas; las mayores llegan solas porque pueden romper cosas.
