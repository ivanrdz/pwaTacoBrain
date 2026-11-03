# `supabase/functions` — funciones en el servidor (Edge Functions)

Código que corre en los servidores de Supabase (Deno), no en el celular.

| Función | Qué hace |
| --- | --- |
| `leer-ticket/` | Recibe la foto de un ticket y regresa proveedor, fecha, total, tipo de gasto y renglones. → ver `leer-ticket/README.md` |

## Por qué solo una

Casi todo lo hace la app directo contra la base, protegida por RLS. **Solo se usa una función cuando hace falta un secreto** (aquí, la llave del modelo de IA) o un control que no puede vivir en el celular (el límite diario de uso). Menos funciones = menos que desplegar y mantener.

En la fase 2 (API en .NET) esta lógica pasa a la API, junto con los cálculos financieros y las integraciones (Telegram, apps de delivery).

Para publicar: `supabase functions deploy leer-ticket`.
