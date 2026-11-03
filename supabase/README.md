# `supabase` — backend del modo nube

Supabase da, en un solo servicio: base de datos Postgres, inicio de sesión, almacenamiento de fotos y funciones en el servidor.

```
supabase/
  config.toml            configuración para la CLI (registro cerrado, función con JWT)
  migrations/            tablas, seguridad y cambios de la base, en orden → ver migrations/README.md
  functions/leer-ticket/ lee la foto del ticket con IA → ver functions/README.md
```

## Por qué Supabase en el MVP

- **Menos piezas que mantener:** login, base, fotos y funciones sin montar un servidor. Para entregar el MVP en semanas era lo más rápido.
- **Postgres estándar:** las tablas y reglas son SQL normal; en la fase 2 una API en .NET puede usar la misma base (o migrarla) sin rehacer el modelo.
- **Seguridad en la base (RLS):** cada fila tiene `owner_id` y las políticas dejan a cada cuenta ver y escribir solo lo suyo. Aunque alguien tenga la *anon key* (que es pública por diseño), no puede leer datos de otra taquería.
- **La app habla directo con la base** para lo simple (guardar ventas, leer productos) y **solo la lectura de tickets pasa por una función**, porque necesita una llave secreta.

## `config.toml`

- `[auth] enable_signup = false`: no hay registro abierto; las cuentas las crea el administrador. Esto aplica a la CLI y a un Supabase local; **en el proyecto en la nube hay que apagarlo también en el panel** (Authentication → Sign In / Providers).
- `[functions.leer-ticket] verify_jwt = true`: Supabase rechaza cualquier llamada a la función sin una sesión válida antes de que llegue al código.

## Comandos

```bash
supabase link --project-ref <ref>   # conectar la CLI con tu proyecto
supabase db push                    # aplicar las migraciones pendientes
supabase functions deploy leer-ticket
supabase secrets set ANTHROPIC_API_KEY=<llave> ORIGENES_PERMITIDOS=https://<tu-app>.vercel.app
```

Las llaves van **solo** en `supabase secrets`, nunca en archivos del repo.
