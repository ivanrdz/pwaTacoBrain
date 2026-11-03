# `leer-ticket` — lectura de tickets con IA

Recibe `{ imagen: <base64>, tipo: "image/jpeg" }` y regresa:

```json
{
  "proveedor": "Carnes El Norte",
  "fecha": "2026-11-02",
  "total": 1850,
  "categoria": "insumos",
  "items": [{ "nombre": "Bistec de res", "cantidad": 6, "unidad": "kg", "total": 1500 }]
}
```

Cualquier dato que no se lea con seguridad llega como `null` (o `items` vacío) y la app pide capturarlo.

## Flujo

1. **Origen:** si la llamada viene de un navegador, el dominio debe estar en `ORIGENES_PERMITIDOS` (más `localhost` para desarrollo). Si no, responde 403.
2. **Sesión:** Supabase ya validó el JWT (`verify_jwt = true`); además se exige el encabezado `Authorization`.
3. **Tamaño y tipo:** máximo ~8 MB y solo JPEG, PNG o WebP.
4. **Límite diario:** llama a `consumir_lectura_ia` con el token del usuario. Si ya pasó `LIMITE_LECTURAS_DIA` (50 por defecto), responde 429 y la app pide escribir el total. **Se cuenta antes de llamar al modelo**, para que un abuso no genere costo.
5. **Modelo:** manda la imagen y las instrucciones a Anthropic (por defecto) u OpenAI.
6. **Validación:** extrae el JSON de la respuesta y limpia todo (números, fecha `YYYY-MM-DD`, categoría y unidad de listas permitidas, nombres recortados, máximo 30 renglones). Nunca se confía en lo que diga el modelo tal cual.
7. **Errores:** se registran en el servidor; al celular solo llega "No se pudo leer el ticket", sin detalles internos.

## Secretos

| Secreto | Para qué |
| --- | --- |
| `ANTHROPIC_API_KEY` | Llave de la consola de desarrolladores de Anthropic (pago por uso, aparte de cualquier suscripción de Claude). |
| `PROVEEDOR_IA` | `anthropic` (por defecto) u `openai`. |
| `OPENAI_API_KEY` | Solo si `PROVEEDOR_IA=openai`. |
| `MODELO_IA` | Opcional. Por defecto `claude-haiku-5-5` (o `gpt-4o-mini` con OpenAI). |
| `ORIGENES_PERMITIDOS` | Dominios de la app separados por coma, ej. `https://tacobrain.vercel.app`. |
| `LIMITE_LECTURAS_DIA` | Lecturas por cuenta al día. Por defecto 50. |

`SUPABASE_URL` y `SUPABASE_ANON_KEY` los pone Supabase solo.

## Decisiones

- **Un modelo de visión y no OCR tradicional** (como Tesseract): el OCR saca texto, pero no sabe cuál número es el total y cuál el subtotal o el cambio, ni separa renglones ni adivina la categoría. El modelo entiende el ticket completo por centavos por lectura.
- **Modelo rápido y barato por defecto** (Haiku): leer un ticket impreso de ticketera no necesita el modelo más grande; importa la velocidad y el costo por lectura.
- **Proveedor intercambiable** con una variable: si cambia el precio o la calidad, se cambia sin tocar la app.
- **Instrucciones específicas de México:** fechas DD/MM/AAAA, "TOTAL" contra subtotal, IVA, cambio y "efectivo", nombres genéricos de insumos ("Bistec de res") para que coincidan con el inventario.
- **La foto se comprime en el celular** antes de mandarla (ver `src/lib/imagen.ts`): sube más rápido y el modelo cobra menos.
