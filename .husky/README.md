# `.husky` — revisión antes de cada commit

`pre-commit` corre automáticamente en cada `git commit` (husky lo activa al hacer `npm install` en un clon del repo):

1. **Bloquea archivos `.env`**: si en el commit va un `.env`, `.env.local` o similar (excepto `.env.example`), el commit se cancela.
2. **Busca llaves** con secretlint en los archivos del commit: llaves de Anthropic (Claude), OpenAI, Supabase (`sb_secret_…` y tokens JWT), AWS, GitHub, Slack, npm, llaves privadas y URLs de base de datos con contraseña. Las reglas están en `.secretlintrc.json` en la raíz.

Si encuentra algo, el commit no se hace y muestra el archivo y la línea (con la llave tapada).

## Decisiones

- **Antes del commit y no solo en GitHub:** una vez que una llave llega a GitHub hay que darla por filtrada y revocarla. Lo mejor es que nunca salga de la compu.
- **secretlint y no gitleaks aquí:** secretlint se instala con npm junto con el proyecto y funciona igual en Windows, Mac y Linux; gitleaks es un programa aparte. En el CI se usan los dos.
- **Reglas propias** además del paquete recomendado: el paquete no reconocía las llaves de Anthropic, OpenAI ni Supabase, que son las que usa este proyecto (se probó con llaves falsas).
- **Solo archivos del commit** (no todo el repo) para que sea rápido.

> Este README no es un hook: husky solo ejecuta archivos con nombre de hook de git (`pre-commit`, `pre-push`…).
