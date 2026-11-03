# `src/data` — tipos, almacenamiento y operaciones

Todo lo que entra y sale de la app pasa por aquí: el modelo de datos, dónde se guarda (celular o Supabase) y las operaciones que combinan varias partes.

## Por qué así

- **Una interfaz, dos almacenes.** Las pantallas solo conocen la interfaz `Almacen` (en `tipos.ts`). Detrás hay dos implementaciones:
  - `almacenLocal.ts` — **modo demo**: todo en el navegador, sin backend.
  - `almacenNube.ts` — **modo nube**: Supabase, con cola para cuando no hay internet.

  `almacen.ts` elige uno según haya o no `VITE_SUPABASE_URL`. Así se le pudo dar un demo funcional al cliente antes de tener backend, y en la fase 2 (API en .NET) basta con agregar un `almacenApi.ts` que cumpla la misma interfaz, **sin tocar las pantallas**.
- **El modelo es contable desde el inicio:** cada venta guarda método de pago, canal y comisión; cada gasto su categoría y de qué cuenta salió; el inventario es una lista de movimientos (entradas y bajas), no un número que se sobrescribe. Con movimientos se puede reconstruir cualquier fecha, auditar y corregir.
- **Copias en el momento de la venta:** `ItemVenta` guarda nombre y precio del producto tal como estaban. Si mañana sube el taco, las ventas de ayer no cambian.

## Archivos

### `tipos.ts`

Tipos del dominio y valores por defecto:

- **Catálogo:** `Producto` (con `receta` opcional: lista de `Ingrediente` con cantidad en la unidad del insumo), `COLORES_PRODUCTO`, `PRODUCTOS_EJEMPLO`.
- **Ventas:** `Venta`, `ItemVenta`, `MetodoPago` (efectivo, transferencia, tarjeta, app), `Canal` (mostrador, rappi, uber, didi).
- **Gastos:** `Gasto` con `Categoria` (insumos, renta, gas, luz, sueldos, otro), `Cuenta` (efectivo o banco) e `ItemCompra` (renglones del ticket). `LecturaTicket` es lo que regresa la IA.
- **Inventario:** `Insumo` (con `Unidad`: kg, pza, paq, lt) y `MovInventario` (entrada o baja; las bajas llevan `motivo`: uso o merma).
- **Dinero:** `Equipo`, `Deuda`, `MovDinero` (retiros del dueño y abonos a deudas), `Comisiones`, `GastosFijos`, `ConfigFinanzas` y `CONFIG_INICIAL`.
- **Funciones:** `porcentajeComision(comisiones, metodo, canal)`, `completarConfig` y `normalizarVenta`/`normalizarGasto`, que completan con valores por defecto los datos guardados antes de que existieran esos campos. Gracias a eso, una actualización de la app nunca rompe los datos viejos del celular.
- **`Almacen`:** la interfaz que cumplen ambos almacenes.

Decisiones:

- **Comisiones como porcentaje guardado en cada venta** (no recalculado después): si el banco cambia su tarifa, el historial queda con lo que realmente se cobró.
- **Comisiones de referencia** (tarjeta 3.5 %, Rappi 25 %, Uber 30 %, DiDi 25 %) solo como punto de partida; cada taquería pone las de su contrato.
- **Gastos fijos, días abiertos y meta en la configuración** (un solo documento por negocio), porque son pocos datos que cambian rara vez.

### `almacen.ts`

Crea el cliente de Supabase **solo si hay URL y anon key** y regresa el almacén que corresponde. La sesión se guarda en el celular y se renueva sola, para que el taquero entre una sola vez.

### `almacenLocal.ts` — modo demo

Guarda en `localStorage` con claves `tb:*`. La lectura de tickets no existe en demo: pide escribir el total (o inventa una lectura con `VITE_LECTOR_SIMULADO=1`, solo para enseñar cómo se ve). `cargarSemanaDeEjemplo()` llena **4 semanas** de datos realistas: más venta el fin de semana, hora fuerte en la noche, recetas, compras diarias con un alza reciente de la carne, consumo un poco arriba de las recetas, algo de merma, gastos fijos y una meta. `borrarDatosDemo()` limpia todo.

Decisión: **localStorage y no IndexedDB** en el MVP porque es síncrono, simple y alcanza para el volumen de una taquería en un demo. Para producción con meses de datos sin internet, la fase 2 contempla IndexedDB.

### `almacenNube.ts` — modo nube

Implementa `Almacen` con Supabase:

- **Cola sin internet:** si una escritura falla por red, se guarda en `tb:cola:<usuario>` y se reintenta al volver la señal (`online`) o al iniciar sesión. Las lecturas mezclan lo del servidor con lo que sigue en la cola, para que el reporte del día salga completo aunque no haya señal.
- **Escrituras idempotentes:** todo se manda con `upsert` por id; subir dos veces lo mismo no duplica.
- **Errores de datos no atoran la cola:** si el servidor rechaza un movimiento (no por red), se aparta en `tb:cola-fallidos:<usuario>` y la cola sigue.
- **Paginación:** PostgREST regresa máximo 1000 filas; `todas()` pide por páginas.
- **Fotos:** se suben al bucket privado `tickets/<usuario>/<gasto>.jpg` antes de guardar el gasto.
- **Productos que se quitan se desactivan** (`activo = false`), no se borran, para no romper ventas pasadas.
- **`cerrarSesion()`** cierra la sesión y borra todo lo guardado en el celular.

Decisión de seguridad: **la cola es por usuario.** Antes era una sola; si alguien salía con pendientes y entraba otra cuenta en el mismo celular, esos pendientes se subían a la cuenta nueva. `almacenNube.test.ts` comprueba que ya no pasa.

### `operaciones.ts`

Operaciones que tocan varias partes del almacén:

| Función | Qué hace |
| --- | --- |
| `guardarCompra(almacen, gasto, foto)` | Guarda el gasto y, si es de insumos con renglones, crea los insumos que no existan (por nombre) y mete cada renglón como entrada al inventario con su costo repartido. |
| `calcularNumeros(almacen, rango)` | Estado de resultados del periodo y balance general al cierre (con todo el historial). Lo usan *Mis números* y el reporte por voz. |
| `calcularDecisiones(almacen)` | Junta las últimas 4 semanas, la semana en curso y los últimos 30 días de gastos, y llama a todas las funciones de `lib/decisiones.ts`. Lo usan *Mi negocio* y la barra de equilibrio del inicio. |

Límite conocido: `calcularNumeros` trae todo el historial para el balance. Con meses de datos conviene guardar cierres mensuales o calcular en el servidor (fase 2).

## Pruebas

- `almacenNube.test.ts` — la cola no se mezcla entre cuentas y se borra al salir.
- `operaciones.test.ts` — con el mes de ejemplo, todas las herramientas dan resultados coherentes y el balance cuadra.
