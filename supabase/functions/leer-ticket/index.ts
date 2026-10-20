// Edge Function: recibe la foto de un ticket y regresa { proveedor, fecha, total, categoria, items }.
// Regresa también la categoría sugerida y los renglones del ticket (para el inventario).
// La llave del modelo de visión vive aquí (secretos de Supabase), nunca en el celular.
//
// Secretos (supabase secrets set ...; nunca en el código ni en el repo):
//   PROVEEDOR_IA          = "anthropic" (por defecto) | "openai"
//   ANTHROPIC_API_KEY / OPENAI_API_KEY
//   MODELO_IA             = opcional; por defecto claude-haiku-5-5 u gpt-4o-mini
//   ORIGENES_PERMITIDOS   = dominios de la app separados por coma, ej. https://tacobrain.vercel.app
//   LIMITE_LECTURAS_DIA   = lecturas por cuenta al día (por defecto 50)
// SUPABASE_URL y SUPABASE_ANON_KEY los pone Supabase solo.
//
// Seguridad:
// - Supabase verifica el JWT del usuario antes de llegar aquí (verify_jwt = true), así que
//   solo cuentas con sesión pueden llamar.
// - Solo se aceptan llamadas desde los dominios de ORIGENES_PERMITIDOS (más localhost para desarrollo).
// - Cada cuenta tiene un límite diario, contado en la base ANTES de pagar al modelo.
// - Los errores del modelo se registran aquí pero al celular solo llega un mensaje genérico.

const ORIGENES_DESARROLLO = ['http://localhost:5173', 'http://localhost:4173'];

function origenesPermitidos(): string[] {
  const env = (Deno.env.get('ORIGENES_PERMITIDOS') ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [...env, ...ORIGENES_DESARROLLO];
}

function encabezadosCors(origen: string | null): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
  if (origen && origenesPermitidos().includes(origen)) base['Access-Control-Allow-Origin'] = origen;
  return base;
}

/** Suma una lectura a la cuenta (con su propio token) y dice si sigue dentro del límite. */
async function dentroDelLimite(autorizacion: string): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
  const limite = Number(Deno.env.get('LIMITE_LECTURAS_DIA') ?? '50');
  const r = await fetch(`${url}/rest/v1/rpc/consumir_lectura_ia`, {
    method: 'POST',
    headers: { apikey: anon, authorization: autorizacion, 'content-type': 'application/json' },
    body: JSON.stringify({ p_limite: Number.isFinite(limite) ? limite : 50 })
  });
  if (!r.ok) throw new Error(`Límite ${r.status}: ${await r.text()}`);
  return (await r.json()) === true;
}

const INSTRUCCIONES = `Eres un lector de tickets de compra de una taquería en México (carnicerías, tortillerías, abarrotes, mercados, gas, renta, luz).
Lee la foto y responde SOLO con un objeto JSON, sin texto extra, con esta forma:
{"proveedor": string | null, "fecha": "YYYY-MM-DD" | null, "total": number | null,
 "categoria": "insumos" | "renta" | "gas" | "luz" | "sueldos" | "otro" | null,
 "items": [{"nombre": string, "cantidad": number, "unidad": "kg" | "pza" | "paq" | "lt", "total": number}]}
Reglas:
- "total" es el TOTAL a pagar (no el subtotal, ni el IVA, ni el cambio, ni "efectivo"). Número sin signo de pesos ni comas.
- Las fechas en México suelen venir como DD/MM/AAAA o DD-MM-AA. Conviértelas a YYYY-MM-DD.
- "proveedor" es el nombre del negocio que vende (normalmente arriba del ticket), corto y legible.
- "categoria": "insumos" para comida, bebidas, desechables y todo lo que se usa para preparar o vender; "gas" para gas; "luz" para luz o agua; "renta" para renta; "otro" para lo demás.
- "items": solo si categoria es "insumos". Un renglón por producto con su cantidad, unidad e importe. Nombres cortos y genéricos ("Bistec de res", "Tortilla", "Cebolla"). Si no se ven los renglones, lista vacía.
- Si no puedes leer un dato con seguridad, ponlo en null. No inventes.`;

const CATEGORIAS = ['insumos', 'renta', 'gas', 'luz', 'sueldos', 'otro'];
const UNIDADES = ['kg', 'pza', 'paq', 'lt'];

interface Renglon {
  nombre: string;
  cantidad: number;
  unidad: string;
  total: number;
}

interface Lectura {
  proveedor: string | null;
  fecha: string | null;
  total: number | null;
  categoria: string | null;
  items: Renglon[];
}

function responder(cuerpo: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const numero = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, '')));

function extraerJSON(texto: string): Lectura {
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio < 0 || fin < inicio) throw new Error('El modelo no regresó JSON');
  const crudo = JSON.parse(texto.slice(inicio, fin + 1));
  const total = numero(crudo.total);
  const fecha = typeof crudo.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(crudo.fecha) ? crudo.fecha : null;
  const categoria = CATEGORIAS.includes(crudo.categoria) ? crudo.categoria : null;
  const items: Renglon[] = Array.isArray(crudo.items)
    ? crudo.items
        .map((it: Record<string, unknown>) => ({
          nombre: typeof it?.nombre === 'string' ? it.nombre.trim().slice(0, 60) : '',
          cantidad: numero(it?.cantidad),
          unidad: UNIDADES.includes(String(it?.unidad)) ? String(it.unidad) : 'pza',
          total: numero(it?.total)
        }))
        .filter((it: Renglon) => it.nombre && Number.isFinite(it.cantidad) && it.cantidad > 0)
        .map((it: Renglon) => ({ ...it, total: Number.isFinite(it.total) && it.total > 0 ? Math.round(it.total * 100) / 100 : 0 }))
        .slice(0, 30)
    : [];
  return {
    proveedor: typeof crudo.proveedor === 'string' && crudo.proveedor.trim() ? crudo.proveedor.trim().slice(0, 80) : null,
    fecha,
    total: Number.isFinite(total) && total > 0 ? Math.round(total * 100) / 100 : null,
    categoria,
    items: categoria === 'insumos' || categoria === null ? items : []
  };
}

async function conAnthropic(imagen: string, tipo: string): Promise<Lectura> {
  const llave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!llave) throw new Error('Falta ANTHROPIC_API_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': llave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('MODELO_IA') ?? 'claude-haiku-5-5',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: tipo, data: imagen } },
            { type: 'text', text: INSTRUCCIONES }
          ]
        }
      ]
    })
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const datos = await r.json();
  const texto = (datos.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');
  return extraerJSON(texto);
}

async function conOpenAI(imagen: string, tipo: string): Promise<Lectura> {
  const llave = Deno.env.get('OPENAI_API_KEY');
  if (!llave) throw new Error('Falta OPENAI_API_KEY');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${llave}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('MODELO_IA') ?? 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: INSTRUCCIONES },
            { type: 'image_url', image_url: { url: `data:${tipo};base64,${imagen}` } }
          ]
        }
      ]
    })
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const datos = await r.json();
  return extraerJSON(datos.choices?.[0]?.message?.content ?? '');
}

Deno.serve(async (req) => {
  const origen = req.headers.get('origin');
  const cors = encabezadosCors(origen);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  // Un navegador desde otro sitio no puede usar la función (las apps nativas no mandan Origin).
  if (origen && !cors['Access-Control-Allow-Origin']) return responder({ error: 'Origen no permitido' }, 403, cors);
  if (req.method !== 'POST') return responder({ error: 'Solo POST' }, 405, cors);
  if (Number(req.headers.get('content-length') ?? '0') > 8_500_000) return responder({ error: 'La imagen es muy grande' }, 413, cors);
  const autorizacion = req.headers.get('authorization');
  if (!autorizacion?.startsWith('Bearer ')) return responder({ error: 'Sin sesión' }, 401, cors);

  try {
    const { imagen, tipo = 'image/jpeg' } = await req.json();
    if (typeof imagen !== 'string' || imagen.length < 100) return responder({ error: 'Falta la imagen' }, 400, cors);
    if (imagen.length > 8_000_000) return responder({ error: 'La imagen es muy grande' }, 413, cors);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(tipo)) return responder({ error: 'Tipo de imagen no soportado' }, 400, cors);

    if (!(await dentroDelLimite(autorizacion))) return responder({ error: 'limite-diario' }, 429, cors);

    const proveedor = (Deno.env.get('PROVEEDOR_IA') ?? 'anthropic').toLowerCase();
    const lectura = proveedor === 'openai' ? await conOpenAI(imagen, tipo) : await conAnthropic(imagen, tipo);
    return responder(lectura, 200, cors);
  } catch (e) {
    console.error(e);
    return responder({ error: 'No se pudo leer el ticket' }, 502, cors);
  }
});
