// Edge Function: recibe la foto de un ticket y regresa { proveedor, fecha, total, categoria, items }.
// Regresa también la categoría sugerida y los renglones del ticket (para el inventario).
// La llave del modelo de visión vive aquí (secretos de Supabase), nunca en el celular.
//
// Secretos:
//   PROVEEDOR_IA   = "anthropic" (por defecto) | "openai"
//   ANTHROPIC_API_KEY / OPENAI_API_KEY
//   MODELO_IA      = opcional; por defecto claude-haiku-5-5 u gpt-4o-mini
//
// Supabase verifica el JWT del usuario antes de llegar aquí (verify_jwt = true por defecto),
// así que solo cuentas con sesión pueden gastar llamadas al modelo.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

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

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Solo POST' }, 405);

  try {
    const { imagen, tipo = 'image/jpeg' } = await req.json();
    if (typeof imagen !== 'string' || imagen.length < 100) return responder({ error: 'Falta la imagen' }, 400);
    if (imagen.length > 8_000_000) return responder({ error: 'La imagen es muy grande' }, 413);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(tipo)) return responder({ error: 'Tipo de imagen no soportado' }, 400);

    const proveedor = (Deno.env.get('PROVEEDOR_IA') ?? 'anthropic').toLowerCase();
    const lectura = proveedor === 'openai' ? await conOpenAI(imagen, tipo) : await conAnthropic(imagen, tipo);
    return responder(lectura);
  } catch (e) {
    console.error(e);
    return responder({ error: 'No se pudo leer el ticket' }, 502);
  }
});
