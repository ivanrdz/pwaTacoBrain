# `src/componentes` — piezas que se reusan entre pantallas

| Archivo | Qué hace |
| --- | --- |
| `TecladoNumerico.tsx` | Teclado grande de calculadora en una hoja que sube desde abajo. Tres formatos: `dinero` ("$1,850"), `cantidad` ("2.5 kg", hasta 3 decimales) y `porcentaje` ("3.5 %", máximo 100). `permitirCero` para datos que pueden ser 0, como caja inicial o comisión de efectivo. El botón "Listo" se apaga si el número no es válido. |
| `EditorRenglon.tsx` | Hoja para capturar un renglón del ticket: producto (con sugerencias de insumos que ya existen), unidad (kg, piezas, paquetes, litros), cantidad y lo que costó. Usa `TecladoNumerico` para los números. |
| `Encabezado.tsx` | Botón grande de regresar más el título de la pantalla. Tiene versión oscura para el reporte. |
| `Icono.tsx` | Iconos en SVG dibujados en el código (vender, cámara, micrófono, inventario, billete, tarjeta, moto, reloj, foco…). `NombreIcono` es el tipo con los nombres válidos. |

## Decisiones

- **Teclado propio en vez del teclado del celular:** el del celular cambia según el modelo, tapa la mitad de la pantalla, deja escribir letras y tiene teclas chicas. El propio siempre es igual, grande y solo acepta números válidos.
- **La primera tecla reemplaza el valor**, como en una calculadora. Antes se agregaba al final: una meta de 9000 cambiada a "7000" quedaba en 90007000. Borrar con el primer toque deja el campo vacío.
- **Iconos en el código** y no una fuente de iconos o imágenes: funcionan sin internet, no hacen peticiones extra (la CSP solo permite recursos propios), toman el color del texto y pesan casi nada. Llevan `aria-hidden` porque cada botón ya dice en texto lo que hace.
- **Hojas que suben desde abajo** (`teclado-fondo`) para todo lo modal: quedan al alcance del pulgar y se parecen a lo que el usuario ya conoce de WhatsApp.
