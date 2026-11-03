# `supabase/migrations` — la base de datos, en orden

Cada archivo es un cambio a la base. Se aplican **en orden de fecha** (el número al inicio del nombre) con `supabase db push`, o pegándolos en el SQL Editor uno por uno. Nunca se edita una migración ya aplicada: si algo cambia, se agrega otra.

> La CLI de Supabase solo toma los archivos `.sql` con fecha al inicio; este README lo ignora.

| Archivo | Qué hace |
| --- | --- |
| `20261010000000_inicio.sql` | Tablas base: `negocios` (nombre de la taquería), `productos`, `ventas`, `gastos`. RLS en todas. Bucket privado `tickets` para las fotos, con políticas por carpeta de cada cuenta. |
| `20261020000000_finanzas_inventario.sql` | Ventas con `metodo`, `canal` y `comision`. Gastos con `categoria`, `cuenta` e `items` (renglones). `negocios.config` (comisiones, caja y banco iniciales, equipo, deudas). Tablas `insumos`, `movs_inventario` (entradas y bajas) y `movs_dinero` (retiros y abonos), con RLS. |
| `20261020010000_seguridad.sql` | Tabla `uso_ia` y función `consumir_lectura_ia` para el límite diario de lecturas de tickets. Límite de 5 MB y solo imágenes en el bucket. Quita todo acceso al rol anónimo. `negocios.config` siempre debe ser un objeto. |
| `20261103000000_decisiones.sql` | `productos.receta` (qué lleva cada producto) y `movs_inventario.motivo` (uso o merma). Las bajas viejas quedan como "uso". |

## Decisiones

- **`owner_id uuid default auth.uid()` en cada tabla:** la app nunca manda de quién es la fila; la pone la base con la sesión. Así no se puede escribir a nombre de otra cuenta aunque se modifique la app.
- **Políticas con `(select auth.uid())`** en lugar de `auth.uid()` directo: Postgres lo calcula una vez por consulta y no una vez por fila. Es la recomendación de Supabase para que RLS no haga lentas las consultas grandes.
- **Ids generados en el celular** (`ventas.id`, `gastos.id`, etc. sin `default`): permite guardar sin internet y reintentar sin duplicar.
- **`items` y `receta` como `jsonb`:** los renglones de una venta o un ticket siempre se leen junto con su venta o su gasto, nunca solos, y son una copia del momento. Una tabla aparte sería más complejidad sin beneficio en el MVP.
- **Inventario como movimientos** (`movs_inventario`), no como una columna "existencia": se puede reconstruir el inventario de cualquier fecha y valuarlo a costo promedio.
- **Configuración en `negocios.config` (`jsonb`):** son pocos datos por negocio que cambian rara vez (comisiones, gastos fijos, equipo, deudas, meta); un documento evita varias tablas pequeñas. Se valida en la app con `completarConfig`.
- **Límite de IA dentro de la base:** `consumir_lectura_ia` es `security definer` y suma el uso de la cuenta que llama (`auth.uid()`), con `search_path` vacío para que no se pueda engañar con funciones falsas. Nadie puede escribir `uso_ia` directo. El día se cuenta en hora de México.
- **`revoke ... from anon`:** defensa en profundidad. Aunque alguien agregue una política por error, sin sesión no se puede tocar ninguna tabla.
- **Productos desactivados, no borrados** (`activo`): las ventas viejas siguen apuntando a productos que existen.
