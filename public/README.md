# `public` — archivos que se publican tal cual

Vite copia esta carpeta sin procesar a la raíz del sitio (`dist/`).

- `icons/` — iconos de la app para el navegador, Android e iPhone → ver `icons/README.md`.

El manifiesto de la PWA (nombre, colores, iconos, orientación vertical) no vive aquí: lo genera `vite-plugin-pwa` desde `vite.config.ts`, para tenerlo junto con la configuración del service worker.

Los `README.md` de esta carpeta **no se publican**: `vite.config.ts` los borra de `dist/` al compilar, para no servir documentación interna en el sitio.
