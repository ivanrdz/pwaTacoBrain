# TacoBrain

PWA para taquerías: **vender con botones grandes**, **tomar foto a los tickets de compra** y **preguntar por voz cómo cerró la semana**.

Pensada para gente con poca escolaridad y en un lugar con mucho ruido:

- La operación diaria (vender, registrar gastos) es **solo con botones**, nada de voz.
- Los reportes se piden **por voz** y la app **responde hablando**. También hay botones rápidos (Hoy, Esta semana, Semana pasada, Este mes) por si el micrófono no está disponible.
- Si se cae el internet, las ventas y gastos se guardan en el celular y se suben solos cuando regresa la señal.

## Pantallas

| Pantalla | Qué hace |
| --- | --- |
| Inicio | Lo vendido y gastado hoy, y tres botones: Vender, Foto al ticket, ¿Cómo me fue? |
| Vender | Un botón por producto. Cada toque suma uno; el botón − quita uno. "Cobrar" guarda la venta y deja 6 segundos para "Deshacer". |
| Foto al ticket | Abre la cámara, lee proveedor, fecha y total con IA, y pide confirmar. El total se corrige con un teclado numérico grande. |
| ¿Cómo me fue? | Toca el micrófono y pregunta: "¿cómo me fue esta semana?", "¿cuánto gasté ayer?", "¿qué fue lo que más vendí este mes?". |
| Mis productos | Nombre de la taquería, productos con precio y color del botón. |

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

Pruebas y revisión de tipos:

```bash
npm test
npm run typecheck
```

## Modo nube (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Crea las tablas: copia `supabase/migrations/20261010000000_inicio.sql` en el **SQL Editor** y ejecútalo. (O con la CLI: `supabase link --project-ref <ref>` y `supabase db push`.)
3. Publica la función que lee los tickets y guarda la llave del modelo de visión:

   ```bash
   supabase functions deploy leer-ticket
   supabase secrets set PROVEEDOR_IA=anthropic ANTHROPIC_API_KEY=sk-ant-...
   # o con OpenAI:
   # supabase secrets set PROVEEDOR_IA=openai OPENAI_API_KEY=sk-...
   # Opcional, para cambiar de modelo: supabase secrets set MODELO_IA=<modelo>
   ```

4. Copia `.env.example` a `.env.local` y pon la URL y la anon key del proyecto (Project Settings → API).
5. `npm run dev`. La app pedirá correo y contraseña una sola vez; la sesión queda guardada en el celular.

Cada taquería es una cuenta. Las políticas RLS hacen que cada cuenta vea solo sus productos, ventas y gastos, así que la misma instalación sirve para vender el sistema a varias taquerías.

Si no quieres que cualquiera cree cuentas, desactiva el registro en Supabase (Authentication → Providers → Email → "Allow new users to sign up") y crea tú las cuentas de tus clientes.

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
  pantallas/              Inicio, Vender, FotoTicket, Reporte, Productos, Entrar
  componentes/            Icono, Encabezado, TecladoNumerico
  data/
    tipos.ts              tipos y la interfaz Almacen
    almacen.ts            elige demo o nube según el .env
    almacenLocal.ts       modo demo (localStorage)
    almacenNube.ts        Supabase + cola para cuando no hay internet
  lib/
    reportes.ts           cuentas de la semana y la frase que se dice en voz
    fechas.ts             hoy, ayer, semana (de lunes a domingo), mes
    voz.ts                reconocimiento y síntesis de voz del navegador
    imagen.ts             comprime la foto antes de subirla
supabase/
  migrations/             tablas, RLS y bucket de fotos
  functions/leer-ticket/  lee el ticket con un modelo de visión
```

## Notas y límites del MVP

- **Voz:** usa el reconocimiento de voz del navegador. Funciona en Chrome para Android y en Safari para iPhone, y necesita internet. Si no está disponible, quedan los botones rápidos.
- **Sin internet:** ventas y gastos se encolan y se suben solos. Leer un ticket con IA sí necesita internet; sin señal, la app pide escribir el total a mano. Los productos se cargan de la nube, así que la primera vez del día conviene abrir la app con señal.
- **Semana:** va de lunes a domingo.
- **Fuera del MVP:** inventario, varios empleados, cortes de caja, facturación, Uber Eats y Rappi.
