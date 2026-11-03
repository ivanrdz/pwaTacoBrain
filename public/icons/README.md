# `public/icons` — iconos de la app

| Archivo | Para qué |
| --- | --- |
| `icon.svg` | Icono de la pestaña del navegador (se ve nítido a cualquier tamaño). |
| `icon-192.png`, `icon-512.png` | Iconos de la PWA instalada en Android y del splash al abrir. |
| `icon-maskable-512.png` | Versión "maskable": el dibujo va más al centro y el fondo llena todo, para que Android lo recorte en círculo o en gota sin cortar el taco. |
| `apple-touch-icon.png` | Icono de 180 px para "Agregar a pantalla de inicio" en iPhone (iOS no usa el manifiesto). Fondo sólido porque iOS no respeta transparencias. |

El dibujo es una tortilla con salsa sobre fondo barro (`#B4410F`, el color principal de la app). Es genérico a propósito: cuando se venda a cada taquería, se puede cambiar por su logo sin tocar código, reemplazando estos archivos con los mismos nombres y tamaños.
