# TacoBrain

PWA para taquerías: **vender con botones grandes**, **tomar foto a los tickets de compra** y **preguntar por voz cómo cerró la semana**.

Pensada para gente con poca escolaridad y en un lugar con mucho ruido:

- La operación diaria (vender, registrar gastos) es **solo con botones**, nada de voz.
- Los reportes se piden **por voz** y la app **responde hablando**. También hay botones rápidos (Hoy, Esta semana, Semana pasada, Este mes) por si el micrófono no está disponible.
- Si se cae el internet, las ventas y gastos se guardan en el celular y se suben solos cuando regresa la señal.

## Pantallas

| Pantalla | Qué hace |
| --- | --- |
| Inicio | Lo vendido y gastado hoy, y botones grandes: Vender, Foto al ticket, Inventario, ¿Cómo me fue? |
| Vender | Un botón por producto. Cada toque suma uno; el botón − quita uno. "Cobrar" pregunta cómo pagaron (efectivo, transferencia, tarjeta) o si el pedido llegó por Rappi, Uber Eats o DiDi Food, y deja 6 segundos para "Deshacer". |
| Foto al ticket | Abre la cámara, lee proveedor, fecha, total, tipo de gasto y renglones con IA, y pide confirmar. Se elige qué se pagó (insumos, renta, gas, luz y agua, sueldos, otro) y con qué (efectivo o banco). Los renglones de insumos entran al inventario. |
| Inventario | Lo que hay guardado y cuánto vale. "Sacar" da de baja lo que se usó en el día; eso es el costo de lo vendido. |
| ¿Cómo me fue? | Toca el micrófono y pregunta: "¿cómo me fue esta semana?", "¿cuánto gasté ayer?", "¿qué fue lo que más vendí este mes?". |
| Mis números | Estado de resultados y balance general, explicados sencillo, y "PDF para el contador" con formato contable. |
| Caja y cuentas | Comisiones de banco y apps, con cuánto dinero se empezó, equipo, deudas (con abonos) y retiros del dueño. |
| Mis productos | Nombre de la taquería, productos con precio y color del botón. |

## Cómo se calculan los números

- **Ventas:** lo que pagó el cliente. Cada venta guarda la comisión del banco o de la app según el porcentaje configurado en *Caja y cuentas* (por defecto: tarjeta 3.5 %, transferencia 0 %, Rappi 25 %, Uber Eats 30 %, DiDi 25 %; ajústalos al contrato de cada taquería).
- **Estado de resultados:** Ventas − comisiones = ventas netas; − costo de ventas = utilidad bruta; − renta, gas, luz y agua, sueldos y otros = utilidad neta.
- **Costo de ventas:** lo que se *saca* del inventario, valuado a costo promedio. Las compras de insumos sin renglones cuentan directo como costo.
- **Balance general:** caja y banco (lo inicial + ventas netas − gastos − retiros − abonos), inventario, equipo; deudas (saldo inicial − abonos); capital = lo aportado + utilidades acumuladas − retiros. Siempre cuadra.
- Sin depreciación de equipo y con IVA incluido. Es informativo; no sustituye a la contabilidad formal.

## Arrancar en tu compu (modo demo)

Sin configurar nada, la app corre en **modo demo**: guarda todo en el navegador del celular. Como no hay quién lea el ticket, después de tomar la foto se escribe el total con el teclado grande; así el cliente la puede usar de verdad mientras se conecta Supabase.

Si solo quieres enseñar cómo se ve la lectura automática, pon `VITE_LECTOR_SIMULADO=1` en `.env.local`: la app inventará proveedor, fecha y total después de cada foto (no la uses así con datos reales).

```bash
npm install
npm run dev
```

Abre la dirección que aparece (por ejemplo `http://localhost:5173`). Para probarla en el celular, conéctalo a la misma red WiFi y abre la dirección "Network" que imprime Vite.

En **Mis productos → Llenar con una semana de ejemplo** se cargan ventas y gastos inventados para que el reporte tenga números.

> La cámara y el micrófono del celular solo funcionan en HTTPS (o en `localhost`). Para probarlos en el celular, publícala en Vercel (abajo) o usa un túnel como `cloudflared`.

Pruebas, tipos y búsqueda de llaves (lo mismo que corre el CI):

```bash
npm run revisar
```

## Modo nube (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Crea las tablas: en el **SQL Editor** ejecuta, en orden, los tres archivos de `supabase/migrations/` (`…_inicio.sql`, `…_finanzas_inventario.sql`, `…_seguridad.sql`). (O con la CLI: `supabase link --project-ref <ref>` y `supabase db push`.)
3. **Apaga el registro abierto:** Authentication → Sign In / Providers → desactiva "Allow new users to sign up". Las cuentas de cada taquería las creas tú en Authentication → Users → Add user.
4. Publica la función que lee los tickets y guarda sus secretos (en Supabase, nunca en el repo):

   ```bash
   supabase functions deploy leer-ticket
   supabase secrets set PROVEEDOR_IA=anthropic ANTHROPIC_API_KEY=<tu llave>
   supabase secrets set ORIGENES_PERMITIDOS=https://<tu-app>.vercel.app
   # Opcionales: LIMITE_LECTURAS_DIA=50 (por cuenta al día), MODELO_IA=<modelo>
   # Con OpenAI: PROVEEDOR_IA=openai OPENAI_API_KEY=<tu llave>
   ```

5. Copia `.env.example` a `.env.local` y pon la URL y la anon key del proyecto (Project Settings → API). `.env.local` nunca se sube al repo.
6. `npm run dev`. La app pedirá correo y contraseña una sola vez; la sesión queda guardada en el celular.

Cada taquería es una cuenta. Las políticas RLS hacen que cada cuenta vea solo sus productos, ventas y gastos, así que la misma instalación sirve para vender el sistema a varias taquerías.

## Seguridad

**Llaves**

- La llave del modelo de IA vive solo en los secretos de Supabase; el celular nunca la ve.
- La *anon key* de Supabase sí va en el frontend: es pública por diseño. Lo que protege los datos son las políticas RLS (cada cuenta solo ve lo suyo). La *service_role* nunca se usa en este proyecto: no la pongas en `.env` ni en Vercel.
- `.env`, `.env.local` y similares están en `.gitignore`.
- **Antes de cada commit** (husky + secretlint) se bloquea cualquier archivo `.env` y cualquier llave de Claude, OpenAI, Supabase, AWS, GitHub, llaves privadas o URLs de base de datos con contraseña. Para revisar a mano: `npm run secretos`.
- **En GitHub Actions** cada push corre secretlint y gitleaks sobre todo el historial, además de tipos, pruebas, build y `npm audit`.
- Si una llave se llega a filtrar: **revócala de inmediato** en el panel del proveedor y crea otra. Borrarla del repo no basta.

**Datos**

- RLS en todas las tablas; el rol anónimo no tiene acceso a ninguna.
- Sin registro abierto: solo entran cuentas que tú creas.
- Fotos de tickets en un bucket privado, cada cuenta en su carpeta, máximo 5 MB y solo imágenes.
- La cola sin internet es por cuenta: si entra otra cuenta en el mismo celular, nunca ve ni sube lo de la anterior. Al cerrar sesión se borra todo lo guardado en el celular (y avisa si hay movimientos sin subir).
- Mensajes de error genéricos al entrar, para no revelar qué correos tienen cuenta.

**Función de tickets**

- Solo acepta usuarios con sesión (JWT) y llamadas desde los dominios de `ORIGENES_PERMITIDOS`.
- Límite diario de lecturas por cuenta (`LIMITE_LECTURAS_DIA`, 50 por defecto), contado en la base antes de pagar al modelo.
- Valida tamaño y tipo de imagen, y valida y recorta todo lo que regresa el modelo.

**Navegador** (`vercel.json`)

- Content-Security-Policy estricta (solo scripts propios y conexiones a Supabase), sin iframes de terceros (`frame-ancestors 'none'`), HSTS, `nosniff`, y cámara y micrófono solo para la app.

**Pendiente en GitHub (manual):** con el repo privado, el escaneo de secretos de GitHub es de pago; por eso el proyecto trae su propio escáner (secretlint y gitleaks).

## Publicar (Vercel)

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa este repositorio de GitHub.
2. Vercel detecta Vite solo (build `npm run build`, carpeta `dist`).
3. **Demo para el cliente:** publica sin variables de entorno. Queda en modo demo, con HTTPS, así que la cámara y el micrófono ya funcionan en el celular.
4. **Versión real:** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Settings → Environment Variables y vuelve a publicar (Deployments → Redeploy).

En modo demo los datos viven solo en el navegador de ese celular: si el cliente borra los datos del navegador o cambia de teléfono, se pierden. Al pasar a la versión con Supabase empieza con datos nuevos.

En el celular, abre la página y elige **"Agregar a pantalla de inicio"** para instalarla como app.

## Estructura

```
src/
  App.tsx                 navegación entre pantallas y sesión
  pantallas/              Inicio, Vender, FotoTicket, Inventario, Reporte, Numeros, Dinero, Productos, Entrar
  componentes/            Icono, Encabezado, TecladoNumerico, EditorRenglon
  data/
    tipos.ts              tipos y la interfaz Almacen
    almacen.ts            elige demo o nube según el .env
    almacenLocal.ts       modo demo (localStorage)
    almacenNube.ts        Supabase + cola para cuando no hay internet
    operaciones.ts        guardar compras al inventario y calcular los números
  lib/
    finanzas.ts           inventario, estado de resultados y balance general
    reportes.ts           la frase que se dice en voz
    fechas.ts             hoy, ayer, semana (de lunes a domingo), mes
    voz.ts                reconocimiento y síntesis de voz del navegador
    imagen.ts             comprime la foto antes de subirla
supabase/
  migrations/             tablas, RLS, bucket de fotos, inventario y finanzas
  functions/leer-ticket/  lee el ticket con un modelo de visión
```

## Notas y límites del MVP

- **Voz:** usa el reconocimiento de voz del navegador. Funciona en Chrome para Android y en Safari para iPhone, y necesita internet. Si no está disponible, quedan los botones rápidos.
- **Sin internet:** ventas y gastos se encolan y se suben solos. Leer un ticket con IA sí necesita internet; sin señal, la app pide escribir el total a mano. Los productos se cargan de la nube, así que la primera vez del día conviene abrir la app con señal.
- **Semana:** va de lunes a domingo.
- **Apps de delivery:** las ventas de Rappi, Uber Eats y DiDi se registran a mano al cobrar (no hay conexión con sus sistemas todavía).
- **PDF:** "PDF para el contador" usa la opción de imprimir del celular → "Guardar como PDF". En iPhone, si la app está instalada en la pantalla de inicio y no abre la impresión, ábrela desde Safari.
- **Números:** cada consulta trae todas las ventas desde el inicio para armar el balance. Con muchos meses de datos convendrá guardar cierres mensuales.
- **Fuera del MVP:** varios empleados, cortes de caja, facturación y conexión directa con las apps de delivery.
