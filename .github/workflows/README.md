# `.github/workflows` — CI

`ci.yml` corre en cada push a `main` y en cada pull request, con dos trabajos en paralelo:

**Tipos, pruebas y build**

1. `npm ci` — instala exactamente lo de `package-lock.json`.
2. `npm run secretos` — secretlint busca llaves en todos los archivos.
3. `npm run typecheck` — TypeScript estricto.
4. `npm test` — todas las pruebas de Vitest.
5. `npm run build` — que la app compile para producción.
6. `npm audit --omit=dev --audit-level=high` — falla si una dependencia de producción tiene una vulnerabilidad alta o crítica.

**Llaves en todo el historial**

- `gitleaks` revisa **todos los commits**, no solo los archivos actuales: una llave borrada en un commit posterior sigue en el historial y sigue siendo un riesgo.

## Decisiones

- **`permissions: contents: read`:** el CI solo puede leer el repo; aunque una dependencia maliciosa corriera ahí, no podría escribir ni publicar nada.
- **Dos escáneres de llaves** (secretlint en el pre-commit y en el CI, gitleaks en el historial): con el repo privado, el escaneo de secretos de GitHub es de pago, así que el proyecto trae el suyo. El pre-commit evita que la llave salga de la compu; el CI atrapa lo que se haya saltado el pre-commit (por ejemplo, con `git commit --no-verify`).
- **Las vulnerabilidades solo de dependencias de producción**: las de desarrollo (Vite, Vitest) no llegan al celular del taquero.
