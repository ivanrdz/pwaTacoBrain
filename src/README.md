# `src` — código de la app (React + TypeScript)

```
src/
  main.tsx        arranque: fuentes, estilos, service worker y montaje de <App/>
  App.tsx         sesión y navegación entre pantallas
  estilos.css     todos los estilos (tokens de color, pantallas, impresión del PDF)
  pantallas/      una pantalla por archivo                → ver pantallas/README.md
  componentes/    piezas que se reusan (teclado, iconos)  → ver componentes/README.md
  data/           tipos, almacenamiento demo/nube, operaciones → ver data/README.md
  lib/            reglas del negocio y utilidades (puras, con pruebas) → ver lib/README.md
```

## Capas y por qué

```
pantallas  →  data/operaciones  →  lib (cálculos puros)
    │                │
    └──────→  data/almacen  →  almacenLocal (demo) | almacenNube (Supabase)
```

- Las **pantallas** muestran y capturan; no calculan dinero ni hablan directo con Supabase.
- **`data`** decide dónde se guarda y junta lo que cada pantalla necesita.
- **`lib`** tiene las reglas (inventario, estado de resultados, balance, consejos) sin depender de nada más.

Así cada regla se prueba sola, el backend se puede cambiar (fase 2 con .NET) sin tocar pantallas, y quien llegue nuevo sabe dónde buscar.

## Archivos de este folder

### `main.tsx`

- Carga las fuentes **desde el propio paquete** (`@fontsource`, solo alfabeto latino) y no desde Google Fonts: funcionan sin internet, la política de seguridad (CSP) no tiene que permitir otros dominios y pesan menos.
- Registra el service worker con actualización automática (`registerSW({ immediate: true })`): cuando publicas una versión nueva, el celular la toma solo, sin que el taquero tenga que hacer nada.

### `App.tsx`

- **Sesión:** en modo nube, si no hay sesión muestra `Entrar`; en demo entra directo.
- **Navegación sin librería de rutas:** la pantalla actual es un estado (`Pantalla`). Al entrar a una pantalla se agrega una entrada al historial (`history.pushState`), para que **el botón "atrás" de Android regrese** en lugar de cerrar la app. Son 10 pantallas sin URLs que compartir, así que React Router sería peso sin beneficio en el MVP. En la fase 2, con más pantallas y quizá enlaces desde Telegram, conviene cambiar a un router.

### `estilos.css`

- Un solo archivo con **variables de color** en `:root` (barro, masa, carbón, verde) y secciones por pantalla.
- **Sin Tailwind ni librería de componentes:** pocas pantallas y un diseño muy específico (botones enormes, alto contraste); CSS directo es más fácil de leer y no agrega dependencias.
- **`@media print`** esconde la app y muestra la hoja contable: así "PDF para el contador" usa la función de imprimir del celular ("Guardar como PDF") sin librerías de PDF.
- Colores con contraste suficiente para leer al sol; el verde de "guardado" y el rojo de "resta" también se distinguen por texto e iconos, no solo por color.
