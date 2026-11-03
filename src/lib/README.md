# `src/lib` — reglas del negocio y utilidades

Aquí vive **todo el cálculo** de la app: inventario, estado de resultados, balance, consejos de *Mi negocio*, la frase que se dice en voz, fechas y dinero.

## Por qué así

- **Funciones puras.** Nada de este folder lee la base, toca la pantalla ni guarda en el celular: recibe datos y regresa resultados. Gracias a eso:
  - se prueba con Vitest sin navegador ni Supabase (`*.test.ts` junto a cada archivo);
  - la misma lógica sirve en modo demo y en modo nube;
  - en la fase 2 (API en .NET) estas funciones son la especificación a portar: cada regla está escrita una sola vez y tiene pruebas que dicen qué debe dar.
- **Nombres en español.** El dominio es contable y para una taquería en México; los nombres (`utilidadNeta`, `merma`, `puntoEquilibrio`) son los que usaría el contador o el dueño, y evitan traducir en la cabeza.
- **Redondeo a centavos al final**, no en cada paso, para que las sumas no se desvíen.

## Archivos

### `finanzas.ts` — inventario, estado de resultados y balance

| Función | Qué hace |
| --- | --- |
| `valuarInventario(insumos, movs, desde?)` | Recorre entradas y bajas en orden y regresa existencia y valor de cada insumo, el costo de lo sacado para vender (`costoBajas`) y lo que se echó a perder (`costoMerma`) desde una fecha. Avisa en `sinExistencia` si se sacó más de lo que había. |
| `costosDeRenglones(items, totalTicket)` | Reparte el total del ticket entre sus renglones en proporción a su importe (o en partes iguales si no traen importe) y ajusta los centavos en el último. |
| `buscarInsumo(insumos, nombre)` | Encuentra un insumo por nombre sin importar acentos, mayúsculas ni espacios dobles. |
| `estadoResultados(ventas, gastos, costoInventario, merma)` | Ventas por método y canal, comisiones del banco y de apps, ventas netas, costo de ventas, utilidad bruta, gastos de operación por categoría y utilidad neta. |
| `balanceGeneral({...})` | Caja, banco, inventario, equipo; deudas; capital aportado, utilidades acumuladas y retiros. Regresa `diferencia`, que siempre debe ser 0. |

Decisiones:

- **Costo promedio ponderado** para valuar el inventario. Es el método más simple de explicar al dueño ("lo que te costó en promedio") y está permitido por las normas mexicanas (NIF C-4). Primeras entradas, primeras salidas (PEPS) daría casi lo mismo en insumos que rotan diario, pero es más difícil de seguir.
- **Inventario perpetuo:** lo comprado con renglones entra al inventario (activo) y se vuelve costo solo cuando se *saca*. Así el estado de resultados de la semana no se infla ni se castiga por comprar mucha carne un día.
- **Compras de insumos sin renglones = costo directo.** Si el taquero no desglosa el ticket, no hay cantidades para el inventario. Contarlo como costo al momento es lo conservador: la ganancia nunca sale más alta de lo real.
- **La merma es costo de ventas, en renglón aparte**, para que el dueño vea cuánto pierde por desperdicio sin que se mezcle con lo que de verdad vendió.
- **Bajas mayores a la existencia:** solo se cobra lo que había y se avisa. Así el inventario nunca queda negativo y el balance sigue cuadrando.
- **El balance cuadra por construcción.** Cada movimiento afecta ambos lados (ver el comentario al inicio del archivo). El capital aportado se calcula con lo inicial (caja, banco y equipo menos deudas iniciales), y la prueba `balance general › cuadra` lo verifica.
- **Sin depreciación ni IVA desglosado:** el MVP es informativo para el dueño. El PDF lo dice para que el contador lo sepa.

### `decisiones.ts` — consejos de *Mi negocio*

| Función | Qué hace |
| --- | --- |
| `costoPorPieza(producto, costos)` | Costo de una pieza según su receta. `null` si no tiene receta o falta el costo de un insumo, para no mostrar un costo incompleto como si fuera real. |
| `rentabilidadProductos(productos, ventas, costos)` | Costo, ganancia por pieza, margen, piezas vendidas y lo que dejó cada producto. Ordena por lo que más dejó. |
| `alertasDePrecio({...})` | Compara la última compra de cada insumo (de los últimos 14 días) contra el promedio de los 30 días anteriores. Si subió 5 % o más, calcula cuánto baja la ganancia de cada producto que lo lleva y el **precio sugerido** para conservar el mismo porcentaje de ganancia, redondeado al peso hacia arriba. |
| `compararCanales(ventas, productos, costos, proporcionCosto)` | Por mostrador, Rappi, Uber y DiDi: ventas, comisión, costo de insumos y lo que queda **de cada $100**. |
| `gastosFijosEfectivos(config, gastosRegistrados)` | Usa los gastos fijos anotados; si no hay, los registrados en los últimos 30 días. |
| `margenContribucion(er)` | De cada peso vendido, cuánto queda después de insumos y comisiones. |
| `puntoEquilibrio(fijosMes, diasAbiertos, margen)` | Cuánto vender al mes y al día para cubrir los gastos fijos. |
| `apartarPorDia(fijos, diasAbiertos)` | Cuánto guardar cada día para renta, gas, luz, sueldos y otros. |
| `patronVentas(ventas, desde, hasta)` | Venta **promedio** por día de la semana (dividido entre las veces que tocó ese día) y venta por hora. |
| `usoPorDia(insumos, movs, desde, hasta)` | Cuánto se usa de cada insumo según el día, sin contar merma, para saber cuánto comprar. |
| `merma({...})` | Lo tirado más lo que se sacó por encima de lo que dicen las recetas para lo vendido. |
| `avanceMeta(meta, ganancia, margen, hoy)` | Avance de la meta semanal y cuánto vender al día los días que quedan. |

Decisiones:

- **Ventana de 4 semanas:** cubre cada día de la semana cuatro veces (los patrones salen estables) y es lo bastante reciente para reflejar precios actuales.
- **Umbral de 5 % y compras de 14 días** en las alertas: menos de 5 % es ruido normal entre proveedores, y una alerta de una compra vieja ya no sirve para decidir.
- **Precio sugerido que conserva el porcentaje**, no la ganancia en pesos: cuando el costo sube, mantener el margen protege el negocio. Se redondea al peso porque en la taquería no se cobran centavos.
- **Promedio por día, no total:** si en 4 semanas hubo 4 sábados y 3 lunes abiertos, comparar totales engañaría.
- **Merma "oculta" contra recetas:** el taquero casi nunca anota lo que se tira; comparar lo sacado contra lo que *debió* usarse según las ventas destapa porciones grandes, cosas sin cobrar o sin anotar. Solo es confiable si todos los productos tienen receta, y la pantalla lo dice.
- **Margen con comisiones incluidas** en el punto de equilibrio: una venta por Uber no aporta lo mismo que una de mostrador.

### `reportes.ts` — la respuesta del reporte por voz

| Función | Qué hace |
| --- | --- |
| `entenderPregunta(texto)` | Saca el periodo (hoy, ayer, esta semana, semana pasada, este mes, mes pasado) y el enfoque (todo, ventas, gastos, ganancia, producto) de una pregunta hablada. |
| `respuestaHablada(resumen, rango, enfoque, fmt)` | Arma la frase. Con `dineroVoz` se lee en voz alta ("1850 pesos"); con `dinero` se muestra en pantalla ("$1,850"). |
| `masVendido(ventas)` | El producto con más piezas vendidas. |

Decisión: **palabras clave, no IA**, para entender la pregunta. Funciona sin internet extra, no cuesta, siempre responde igual y cubre lo que un taquero pregunta. Si en campo aparecen preguntas que no entiende, se agregan palabras (hay pruebas para cada frase).

### `fechas.ts`

`rangoDe(periodo)` regresa `desde`/`hasta` (hasta exclusivo) y el nombre para la voz. `fechaISO` da `YYYY-MM-DD` en **hora local** y `fechaBonita` "Hoy", "Ayer" o "lunes 3 de noviembre".

- **La semana empieza en lunes**, como se acostumbra en México y en los cortes de negocio.
- **Hora local, no UTC:** una venta a las 11 pm es de ese día, no del siguiente.

### `dinero.ts`

`dinero(n)` → "$1,850" o "$40.90" (centavos solo si los hay). `dineroVoz(n)` → "1850 pesos", porque los lectores de voz leen mal "$1,850".

### `voz.ts`

`escuchar()` usa el reconocimiento de voz del navegador en `es-MX` y `hablar(texto)` lee la respuesta con una voz en español (prefiere es-MX, luego es-US, luego cualquier es). `puedeEscuchar()` permite ocultar el micrófono donde no hay soporte.

Decisión: **la voz solo se usa en reportes.** En la operación diaria hay demasiado ruido (plancha, calle, clientes) y equivocarse al vender cuesta dinero; para preguntar "¿cómo me fue?" en un momento tranquilo, la voz es lo más fácil para alguien que casi no lee.

### `imagen.ts`

`comprimirFoto` reduce la foto a 1600 px por lado en JPEG al 82 % y `aBase64` la prepara para la función. Una foto de celular pesa 3–5 MB; así baja a ~300 KB: sube rápido con mala señal, cabe en el límite del bucket y el modelo cobra menos por leerla, sin perder legibilidad del ticket.

### `id.ts`

`nuevoId()` genera un UUID en el celular (con respaldo para navegadores viejos). **Los ids se crean en el celular, no en la base**, para que una venta guardada sin internet tenga su id desde el inicio: al subirse varias veces (reintentos) no se duplica.

## Pruebas

```bash
npm test
```

`finanzas.test.ts`, `decisiones.test.ts` y `reportes.test.ts` documentan con ejemplos qué debe dar cada cálculo. Si cambias una regla, cambia primero la prueba.
