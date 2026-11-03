# TacoBrain

App para taquerías que se instala en el celular (PWA). Sirve para **vender con botones grandes**, **registrar compras tomando foto al ticket**, **llevar el inventario**, **saber cuánto se ganó** (estado de resultados y balance general) y **recibir consejos para decidir**: qué producto deja más, cuándo subir precios, si conviene vender por apps y cuánto vender al día para no perder.

**Para quién:** el dueño de una taquería, muchas veces con poca escolaridad, que trabaja con prisa, con las manos ocupadas y mucho ruido alrededor. Un mismo sistema sirve para varias taquerías: cada una es una cuenta y solo ve lo suyo.

**Principios:**

- **Operar con botones, preguntar con la voz.** Vender, registrar gastos e inventario es solo con toques: con el ruido de la plancha y la calle, la voz se equivoca. Los reportes sí se piden por voz y la app contesta hablando.
- **Nada de teclear.** Números con un teclado grande de calculadora; la IA lee los tickets.
- **Lenguaje de la calle.** "Te entró de verdad", "Lo que tienes", "Se echó a perder". El lenguaje contable formal queda solo en el PDF para el contador.
- **Funciona sin internet.** Lo que se registra sin señal se sube solo cuando regresa.

## Contenido

- [Funcionalidades](#funcionalidades)
- [Cómo se calculan los números](#cómo-se-calculan-los-números)
- [Arquitectura y documentación por carpeta](#arquitectura-y-documentación-por-carpeta)
- [Arrancar en tu compu (modo demo)](#arrancar-en-tu-compu-modo-demo)
- [Modo nube (Supabase)](#modo-nube-supabase)
- [Publicar (Vercel)](#publicar-vercel)
- [Seguridad](#seguridad)
- [Calidad: pruebas y CI](#calidad-pruebas-y-ci)
- [Límites del MVP y siguientes pasos](#límites-del-mvp-y-siguientes-pasos)

## Funcionalidades

### 1. Inicio

- Lo **vendido** y lo **gastado hoy**, y cuántas ventas se cobraron.
- **Barra de punto de equilibrio:** "Te faltan $1,379 para cubrir tus gastos de hoy" o "¡Hoy ya cubriste tus gastos!".
- Botones grandes: **Vender**, **Foto al ticket**, **Inventario**, **¿Cómo me fue?** y **Mi negocio**. El engrane abre *Mis productos* y los ajustes.
- En modo demo avisa que los datos se guardan solo en ese celular.

### 2. Vender (punto de venta)

- Un botón grande por producto, con su color y precio. Cada toque suma una pieza a la orden; el botón **−** quita una.
- Total de la orden siempre visible; el bote de basura borra la orden.
- **Cobrar** pregunta **cómo pagaron**, con un toque:
  - **Efectivo** (el botón más grande, porque es lo más común), **Transferencia** o **Tarjeta**;
  - o si fue **pedido de app**: **Rappi**, **Uber Eats** o **DiDi Food**.
- Cada venta guarda método, canal y **comisión** (según el porcentaje configurado).
- Aviso verde "Venta de $130 guardada · Tarjeta" con **Deshacer** durante 6 segundos. El aviso flota encima de la barra de cobrar para no mover los botones.

### 3. Foto al ticket (compras y gastos)

- Abre la cámara trasera. La IA lee **proveedor, fecha, total, tipo de gasto y renglones** (qué se compró, cuánto y a cuánto).
- Pantalla de confirmación: "¿Está bien lo que leí?". Todo se puede corregir:
  - total con el teclado grande y fecha con el calendario;
  - **qué se pagó**: Insumos, Renta, Gas, Luz y agua, Sueldos u Otro gasto;
  - **con qué se pagó**: Efectivo o Banco/tarjeta;
  - **renglones** (solo insumos): producto con sugerencias de lo que ya hay en inventario, unidad (kg, piezas, paquetes, litros), cantidad e importe.
- Los renglones de insumos **entran al inventario**. El total del ticket se reparte entre ellos para que el inventario valga exactamente lo que se pagó.
- Si no se pudo leer (sin internet, demo o límite diario de lecturas), abre directo el teclado para escribir el total y se guarda igual.
- En modo nube la foto se guarda comprimida en un almacenamiento privado, como respaldo.

### 4. Inventario

- Cada insumo con su **existencia** ("9.4 kg") y lo que **vale** a costo promedio, más el valor total de lo guardado.
- **Sacar:** registra lo que se usó en el día para vender. Es el costo de lo vendido. No deja sacar más de lo que hay.
- **Se echó a perder:** registra la merma (lo que se tiró).
- "Hoy sacaste" con **Deshacer** por cada movimiento.

### 5. Recetas y costo por producto

- En *Mis productos*, cada producto puede tener su **receta**: qué lleva cada pieza, en **gramos**, mililitros o piezas ("80 g de bistec, 60 g de tortilla").
- Con la receta, la app muestra al editar: "Cada uno te cuesta $19.71 y te deja $5.29 (21 %)".
- Las recetas alimentan las alertas de precios, la comparación de apps y la merma.

### 6. ¿Cómo me fue? (reporte por voz)

- Botón de micrófono: se pregunta hablando y la app **contesta en voz alta** y en pantalla. Entiende, por ejemplo:
  - "¿Cómo me fue esta semana?"
  - "¿Cuánto gasté ayer?"
  - "¿Cuánto me quedó este mes?"
  - "¿Qué fue lo que más vendí la semana pasada?"
- Botones rápidos por si el micrófono no está disponible: **Hoy**, **Esta semana**, **Semana pasada**, **Este mes**.
- Muestra vendiste, costos y gastos, y ganancia (o pérdida). Botones **Repetir** y **Preguntar**.

### 7. Mis números: estado de resultados y balance general

Por periodo (esta semana, semana pasada, este mes, mes pasado):

- **Estado de resultados:** ventas (desglosadas por efectivo, transferencia, tarjeta y cada app), comisiones del banco, comisiones de apps, lo que "te entró de verdad", insumos que usaste, lo que se echó a perder, ganancia antes de gastos, renta/gas/luz/sueldos/otros y **ganancia o pérdida** del periodo.
- **Balance general:** lo que tienes (efectivo en caja, dinero en el banco, inventario, equipo), lo que debes (cada deuda) y lo que es tuyo (lo que pusiste al empezar, ganancias acumuladas, lo que sacaste para ti). Muestra que **cuadra**.
- **Avisos:** si se compraron insumos pero no se registró nada sacado (la ganancia saldría inflada), o si falta anotar caja inicial, equipo y deudas.
- **PDF para el contador:** dos hojas tamaño carta con formato contable (Ventas netas, Costo de ventas, Utilidad bruta, Activo, Pasivo, Capital contable), con nota de método.

### 8. Mi negocio: herramientas para decidir

Con las últimas 4 semanas, en frases sencillas:

1. **Tu meta de la semana:** el dueño pone cuánto quiere ganar; ve cuánto lleva, cuánto le falta y cuánto vender al día los días que quedan.
2. **Para no perder dinero:** cuánto vender al día y al mes para cubrir los gastos fijos, con la barra de hoy.
3. **Aparta cada día:** cuánto guardar diario para renta, gas, luz, sueldos y otros.
4. **Precios de tus compras:** "Bistec subió 16 %: de $212 a $245 el kg. Al taco de bistec ahora le ganas $3.95 (antes $6.62). Para ganar lo mismo, cóbralo a $29."
5. **Lo que te deja cada producto:** costo, ganancia por pieza, piezas vendidas y lo que dejó cada uno; cuál deja más y cuál menos. Señala los productos sin receta.
6. **¿Te conviene vender por apps?:** de cada $100 vendidos, cuánto queda en mostrador, Rappi, Uber y DiDi después de comisión e insumos, y cuánto se pierde contra el mostrador.
7. **Tus mejores días y horas:** venta promedio por día de la semana (gráfica), horas más fuertes, y cuánto se usa de cada insumo según el día (para saber cuánto comprar).
8. **Lo que se pierde:** lo que se tiró, más lo que se sacó del inventario por encima de lo que dicen las recetas (porciones grandes, cosas sin cobrar o sin anotar), por insumo.

### 9. Caja y cuentas

- **Saqué dinero para mí:** retiros del dueño (no son gasto del negocio; se restan del capital). Pregunta si salió de la caja o del banco.
- **Con cuánto empezaste:** efectivo en caja y dinero en el banco el día que se empezó a usar la app.
- **Gastos fijos al mes** (renta, gas, luz y agua, sueldos, otros) y **días que abres al mes**: base del punto de equilibrio y de "aparta cada día".
- **Tu equipo:** plancha, trompo, refri… con su valor.
- **Lo que debes:** préstamos o fiado con proveedores, con **Abonar** (de caja o de banco) y saldo actualizado.
- **Comisiones:** porcentaje de la terminal, transferencias, Rappi, Uber Eats y DiDi Food.
- Lista de los últimos retiros y abonos, con **Quitar**.

### 10. Mis productos y ajustes

- Nombre de la taquería.
- Productos: nombre, precio, color del botón y receta. Agregar, editar y quitar (los quitados se desactivan para no romper ventas pasadas). Cargar productos de ejemplo.
- Acceso a *Caja y cuentas*.
- Demo: **Llenar con un mes de ejemplo** y **Borrar datos de la demo**. Nube: **Cerrar sesión** (avisa si hay movimientos sin subir).

### 11. Sin internet

- Ventas, gastos, inventario, retiros y abonos se guardan en el celular si no hay señal y **se suben solos** al regresar.
- Los reportes del día incluyen lo que todavía no se sube.
- Cada pendiente es de su cuenta: si entra otra cuenta en el mismo celular, no ve ni sube lo de la anterior.
- La app misma (pantallas, fuentes, iconos) queda guardada en el celular y abre sin señal.

### 12. Modo demo y modo nube

- **Demo** (sin configurar nada): todo vive en el navegador del celular. Sirve para enseñarla y para que un cliente la pruebe. Al tomar foto se escribe el total a mano (con `VITE_LECTOR_SIMULADO=1` se inventa una lectura, solo para presentaciones).
- **Nube** (con Supabase): datos en el servidor por cuenta, lectura real de tickets con IA y respaldo de fotos.

### 13. Cuentas y acceso

- Correo y contraseña una sola vez; la sesión queda guardada.
- **Sin registro abierto:** las cuentas de cada taquería las crea el administrador.

### 14. Instalar como app

- En el celular: abrir la página y "Agregar a pantalla de inicio". Abre en pantalla completa, con icono propio y en vertical.
- Las versiones nuevas se instalan solas.

## Cómo se calculan los números

- **Ventas:** lo que pagó el cliente. Cada venta guarda la comisión del banco o de la app según el porcentaje configurado (de referencia: tarjeta 3.5 %, transferencia 0 %, Rappi 25 %, Uber Eats 30 %, DiDi 25 %; se ajustan al contrato de cada taquería).
- **Estado de resultados:** ventas − comisiones = ventas netas; − costo de ventas = utilidad bruta; − renta, gas, luz y agua, sueldos y otros = utilidad neta.
- **Costo de ventas:** lo que se *saca* del inventario, valuado a **costo promedio**, más la merma, más las compras de insumos sin renglones (que cuentan directo como costo).
- **Balance general:** caja y banco (lo inicial + ventas netas − gastos − retiros − abonos), inventario y equipo; deudas (saldo inicial − abonos); capital = lo aportado + utilidades acumuladas − retiros. **Siempre cuadra.**
- **Mi negocio:**
  - Usa las últimas 4 semanas.
  - **Punto de equilibrio** = gastos fijos ÷ lo que queda de cada peso vendido después de insumos y comisiones, entre los días que abre.
  - **Alerta de precio:** la última compra (de los últimos 14 días) contra el promedio de los 30 días anteriores, si subió 5 % o más. El precio sugerido conserva el mismo porcentaje de ganancia.
- Sin depreciación de equipo y con IVA incluido. Es informativo; no sustituye a la contabilidad formal.

El detalle de cada regla, y por qué se eligió, está en [`src/lib/README.md`](src/lib/README.md).

## Arquitectura y documentación por carpeta

```
pantallas  →  data/operaciones  →  lib (cálculos puros, con pruebas)
    │                │
    └──────→  data/almacen  →  almacenLocal (demo, en el celular)
                               almacenNube  (Supabase + cola sin internet)
                                     │
                                     └→ supabase/functions/leer-ticket → modelo de IA
```

**Stack:** React 19 + TypeScript estricto + Vite, PWA con `vite-plugin-pwa`; Supabase (Postgres con RLS, Auth, Storage, Edge Functions); Vercel para publicar la app.

| Carpeta | Qué hay | Documentación |
| --- | --- | --- |
| `src/` | Código de la app: arranque, navegación, estilos | [`src/README.md`](src/README.md) |
| `src/pantallas/` | Una pantalla por archivo y principios de diseño | [`src/pantallas/README.md`](src/pantallas/README.md) |
| `src/componentes/` | Teclado numérico, editor de renglones, iconos | [`src/componentes/README.md`](src/componentes/README.md) |
| `src/data/` | Tipos, almacenes demo y nube, cola sin internet, operaciones | [`src/data/README.md`](src/data/README.md) |
| `src/lib/` | Inventario, estado de resultados, balance, consejos, voz, fechas | [`src/lib/README.md`](src/lib/README.md) |
| `public/` | Archivos que se publican tal cual | [`public/README.md`](public/README.md) |
| `public/icons/` | Iconos de la app | [`public/icons/README.md`](public/icons/README.md) |
| `supabase/` | Backend del modo nube | [`supabase/README.md`](supabase/README.md) |
| `supabase/migrations/` | Tablas, seguridad y cambios de la base, en orden | [`supabase/migrations/README.md`](supabase/migrations/README.md) |
| `supabase/functions/` | Funciones en el servidor | [`supabase/functions/README.md`](supabase/functions/README.md) |
| `supabase/functions/leer-ticket/` | Lectura de tickets con IA | [`supabase/functions/leer-ticket/README.md`](supabase/functions/leer-ticket/README.md) |
| `.github/` | Dependabot | [`.github/DOCUMENTACION.md`](.github/DOCUMENTACION.md) |
| `.github/workflows/` | CI | [`.github/workflows/README.md`](.github/workflows/README.md) |
| `.husky/` | Revisión de llaves antes de cada commit | [`.husky/README.md`](.husky/README.md) |

**Archivos de la raíz:**

| Archivo | Para qué |
| --- | --- |
| `vite.config.ts` | Compilación, manifiesto y service worker de la PWA, pruebas. |
| `vercel.json` | Encabezados de seguridad del sitio (CSP y otros). |
| `tsconfig.json` / `tsconfig.node.json` | TypeScript estricto para la app y para la configuración de Vite. |
| `.env.example` | Variables de entorno (sin valores). Se copia a `.env.local`, que nunca se sube. |
| `.secretlintrc.json` / `.secretlintignore` | Reglas del escáner de llaves. |
| `index.html` | Página base de la PWA. |

**Decisiones principales**

- **La lógica de negocio es pura y está separada** (`src/lib`): se prueba sin navegador ni base, y es la especificación a portar cuando el backend pase a .NET.
- **Una interfaz de almacenamiento con dos implementaciones** (demo y nube): permitió entregar un demo funcional sin backend, y en la fase 2 se agrega un almacén que hable con la API sin tocar las pantallas.
- **Supabase en el MVP:** login, base, fotos y funciones sin montar servidores. La seguridad por cuenta vive en la base (RLS).
- **Datos como movimientos** (ventas, gastos, entradas y bajas de inventario, retiros y abonos): se puede reconstruir cualquier fecha, auditar y corregir.
- **Ids creados en el celular:** permiten guardar sin internet y reintentar sin duplicar.
- **Sin librerías de rutas, estado ni estilos:** son 10 pantallas; menos dependencias significa menos que actualizar y menos superficie de ataque.

**Fase 2 (planeada):** monorepo con la app en React, una API en .NET para la lógica de negocio (lectura de tickets, cálculos financieros en el servidor, límites e integraciones) y Supabase como base, login y fotos.

## Arrancar en tu compu (modo demo)

Sin configurar nada, la app corre en **modo demo**.

```bash
npm install
npm run dev
```

Abre la dirección que aparece (por ejemplo `http://localhost:5173`). Para probarla en el celular, conéctalo a la misma red WiFi y abre la dirección "Network" que imprime Vite.

En **Mis productos → Llenar con un mes de ejemplo** se cargan 4 semanas de ventas, compras, recetas, inventario, merma y gastos fijos inventados, para que los reportes y *Mi negocio* tengan números.

> La cámara y el micrófono del celular solo funcionan en HTTPS (o en `localhost`). Para probarlos en el celular, publícala en Vercel (abajo) o usa un túnel como `cloudflared`.

Pruebas, tipos y búsqueda de llaves (lo mismo que corre el CI):

```bash
npm run revisar
```

## Modo nube (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Crea las tablas: en el **SQL Editor** ejecuta, en orden, los cuatro archivos de `supabase/migrations/` (`…_inicio.sql`, `…_finanzas_inventario.sql`, `…_seguridad.sql`, `…_decisiones.sql`). O con la CLI: `supabase link --project-ref <ref>` y `supabase db push`.
3. **Apaga el registro abierto:** Authentication → Sign In / Providers → desactiva "Allow new users to sign up". Las cuentas de cada taquería las creas tú en Authentication → Users → Add user.
4. Publica la función que lee los tickets y guarda sus secretos (en Supabase, nunca en el repo):

   ```bash
   supabase functions deploy leer-ticket
   supabase secrets set PROVEEDOR_IA=anthropic ANTHROPIC_API_KEY=<tu llave>
   supabase secrets set ORIGENES_PERMITIDOS=https://<tu-app>.vercel.app
   # Opcionales: LIMITE_LECTURAS_DIA=50 (por cuenta al día), MODELO_IA=<modelo>
   # Con OpenAI: PROVEEDOR_IA=openai OPENAI_API_KEY=<tu llave>
   ```

   La llave de Anthropic es de la consola de desarrolladores (pago por uso), no de una suscripción de Claude.

5. Copia `.env.example` a `.env.local` y pon la URL y la anon key del proyecto (Project Settings → API). `.env.local` nunca se sube al repo.
6. `npm run dev`. La app pedirá correo y contraseña una sola vez.

## Publicar (Vercel)

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa este repositorio de GitHub.
2. Vercel detecta Vite solo (build `npm run build`, carpeta `dist`).
3. **Demo para el cliente:** publica sin variables de entorno. Queda en modo demo, con HTTPS, así que la cámara y el micrófono ya funcionan en el celular.
4. **Versión real:** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Settings → Environment Variables y vuelve a publicar (Deployments → Redeploy).

En modo demo los datos viven solo en el navegador de ese celular: si el cliente borra los datos del navegador o cambia de teléfono, se pierden. Al pasar a la versión con Supabase empieza con datos nuevos.

## Seguridad

**Llaves**

- La llave del modelo de IA vive solo en los secretos de Supabase; el celular nunca la ve.
- La *anon key* de Supabase sí va en el frontend: es pública por diseño. Lo que protege los datos son las políticas RLS. La *service_role* nunca se usa en este proyecto: no la pongas en `.env` ni en Vercel.
- `.env`, `.env.local` y similares están en `.gitignore`.
- **Antes de cada commit** (husky + secretlint) se bloquea cualquier archivo `.env` y cualquier llave de Claude, OpenAI, Supabase, AWS o GitHub, llave privada o URL de base de datos con contraseña. Para revisar a mano: `npm run secretos`.
- **En GitHub Actions** cada push corre secretlint y gitleaks sobre todo el historial.
- Si una llave se llega a filtrar: **revócala de inmediato** en el panel del proveedor y crea otra. Borrarla del repo no basta.

**Datos**

- RLS en todas las tablas; el rol anónimo no tiene acceso a ninguna.
- Sin registro abierto: solo entran cuentas que tú creas.
- Fotos de tickets en un bucket privado, cada cuenta en su carpeta, máximo 5 MB y solo imágenes.
- La cola sin internet es por cuenta, y al cerrar sesión se borra todo lo guardado en el celular.
- El mensaje de error al entrar no revela qué correos tienen cuenta.

**Función de tickets**

- Solo acepta usuarios con sesión y llamadas desde los dominios de `ORIGENES_PERMITIDOS`.
- Límite diario de lecturas por cuenta, contado en la base antes de pagar al modelo.
- Valida tamaño y tipo de imagen, y valida y recorta todo lo que regresa el modelo.

**Navegador** (`vercel.json`)

- Content-Security-Policy estricta (solo scripts propios y conexiones a Supabase), sin iframes de terceros, HSTS, `nosniff`, y cámara y micrófono solo para la app.

## Calidad: pruebas y CI

- **Pruebas (Vitest):** cálculos de inventario, estado de resultados y balance (incluida la prueba de que cuadra), las 8 herramientas de *Mi negocio*, la frase del reporte por voz, la cola sin internet por cuenta y una prueba de punta a punta con el mes de ejemplo.
- **TypeScript estricto** en la app y en la configuración.
- **CI en GitHub Actions:** llaves, tipos, pruebas, build, vulnerabilidades de dependencias y gitleaks sobre el historial.
- **Dependabot:** actualizaciones semanales de dependencias.

## Límites del MVP y siguientes pasos

- **Voz:** usa el reconocimiento del navegador (Chrome en Android, Safari en iPhone) y necesita internet. Sin él, quedan los botones rápidos.
- **Sin internet:** leer un ticket con IA necesita señal; sin ella, se escribe el total. Los productos se cargan de la nube, así que conviene abrir la app con señal la primera vez del día.
- **Apps de delivery:** las ventas de Rappi, Uber Eats y DiDi se registran a mano al cobrar; no hay conexión con sus sistemas.
- **PDF:** usa "Imprimir → Guardar como PDF" del celular. En iPhone, si la app instalada no abre la impresión, ábrela desde Safari.
- **Merma contra recetas:** es confiable solo si todos los productos que usan un insumo tienen receta.
- **Escala:** el balance trae todo el historial en cada consulta; con muchos meses conviene guardar cierres mensuales o calcular en el servidor (fase 2).
- **Siguientes:** resumen semanal por Telegram; cierre del día con conteo de caja; varios usuarios por taquería (dueño y empleados); facturación; conexión directa con las apps de delivery; API en .NET.
