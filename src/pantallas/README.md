# `src/pantallas` — pantallas de la app

Cada archivo es una pantalla completa. Carga sus propios datos con `almacen()` y las funciones de `data/operaciones.ts`; no hay estado global.

## Principios de diseño (por qué se ven así)

El usuario es un taquero con poca escolaridad, con prisa, las manos ocupadas y mucho ruido alrededor. Por eso:

- **Botones grandes** (mínimo 44 px, la mayoría 60–110 px) y texto de 17 px o más. Se tiene que poder tocar con un dedo con salsa sin atinarle al de al lado.
- **Nada de teclado del celular para números:** precios, totales, cantidades y porcentajes se escriben con `TecladoNumerico`, un teclado grande de calculadora.
- **Un toque por acción y siempre confirmación visible:** aviso verde con lo que se guardó, vibración corta, y "Deshacer" o "Quitar" donde equivocarse es fácil.
- **Lenguaje de la calle, no contable:** "Te entró de verdad", "Lo que tienes", "Lo que debes", "Se echó a perder". El lenguaje contable formal queda solo en el PDF para el contador.
- **Voz solo para preguntar**, nunca para operar (por el ruido).
- **Los avisos no mueven los botones:** el aviso de "venta guardada" flota encima de la barra de cobrar; si empujara la cuadrícula, el siguiente toque caería en otro producto.

## Pantallas

| Archivo | Pantalla | Qué hace |
| --- | --- | --- |
| `Inicio.tsx` | Inicio | Lo vendido y gastado hoy, barra de "te faltan $X para cubrir tus gastos de hoy", y botones a Vender, Foto al ticket, Inventario, ¿Cómo me fue? y Mi negocio. El engrane abre Mis productos. |
| `Vender.tsx` | Vender | Un botón por producto (con su color); cada toque suma uno y el "−" quita uno. "Cobrar" pregunta cómo pagaron: Efectivo (el botón más grande, porque es lo más común), Transferencia, Tarjeta o pedido de Rappi/Uber Eats/DiDi Food. Calcula y guarda la comisión. 6 segundos para "Deshacer". |
| `FotoTicket.tsx` | Foto al ticket | Abre la cámara trasera, manda la foto a leer y muestra proveedor, fecha, total, tipo de gasto y renglones para confirmar. Si no se pudo leer (demo, sin internet o límite diario), abre directo el teclado para escribir el total. Se elige qué se pagó y con qué (efectivo o banco). Los renglones de insumos se editan con `EditorRenglon` y entran al inventario. |
| `Inventario.tsx` | Inventario | Existencia y valor de cada insumo. "Sacar" da de baja lo que se usó (no deja sacar más de lo que hay) y "Se echó a perder" anota merma. Lista lo de hoy con "Deshacer". |
| `Reporte.tsx` | ¿Cómo me fue? | Botón de micrófono y botones rápidos (Hoy, Esta semana, Semana pasada, Este mes). Responde hablando y en pantalla: vendiste, costos y gastos, ganancia. Botones "Repetir" y "Preguntar". Liga a Mis números. |
| `Numeros.tsx` | Mis números | Estado de resultados y balance general por periodo, explicados sencillo. Avisa si se compraron insumos y no se registró nada sacado, porque así la ganancia saldría inflada. "PDF para el contador" imprime una hoja formal (con `@media print`). |
| `MiNegocio.tsx` | Mi negocio | Las 8 herramientas para decidir: meta de la semana, para no perder dinero (punto de equilibrio), aparta cada día, precios de tus compras, lo que te deja cada producto, ¿te conviene vender por apps?, tus mejores días y horas, lo que se pierde. Cada tarjeta tiene una frase en lenguaje sencillo y, si falta un dato, un botón para ir a anotarlo. |
| `Dinero.tsx` | Caja y cuentas | "Saqué dinero para mí" (retiro del dueño), con cuánto empezó (caja y banco), gastos fijos al mes, días que abre, equipo, deudas con "Abonar", comisiones por método y app, y lista de retiros y abonos con "Quitar". |
| `Productos.tsx` | Mis productos | Nombre de la taquería, productos (nombre, precio, color, **receta** en gramos/mililitros/piezas con costo y ganancia por pieza), cargar productos de ejemplo, ir a Caja y cuentas. En demo: llenar un mes de ejemplo y borrar datos; en nube: cerrar sesión (avisa si hay movimientos sin subir). |
| `Entrar.tsx` | Entrar | Correo y contraseña, solo en modo nube. Sin "crear cuenta": las cuentas las crea el administrador. El error es el mismo si el correo no existe o la contraseña está mal, para no revelar qué correos tienen cuenta. |

## Decisiones

- **Recetas en gramos, no en kilos:** "80 gramos de carne" es como piensa el taquero; "0.08 kg" no. Se guarda en la unidad del insumo y se convierte solo al mostrar.
- **Cobro en un paso extra mínimo:** elegir el método de pago agrega un toque por venta, pero sin él no hay comisiones ni caja vs. banco. Efectivo es el botón grande para que el caso común sea el más fácil.
- **Fecha del ticket editable:** a veces se registra al día siguiente; la fecha que vale es la del ticket.
- **Consejos de "Mi negocio" en pesos enteros:** "$1,709 al día" se entiende mejor que "$1,708.63". Los costos por pieza sí llevan centavos, porque ahí la diferencia importa.
- **Reportes por periodo con chips** (Esta semana, Semana pasada, Este mes, Mes pasado) en vez de un calendario: cubren lo que se pregunta y no requieren saber usar un selector de fechas.
