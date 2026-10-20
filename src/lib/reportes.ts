import type { Gasto, Venta } from '../data/tipos';
import { dineroVoz } from './dinero';
import type { Periodo, Rango } from './fechas';

export interface Resumen {
  ventas: number;
  numVentas: number;
  gastos: number;
  numGastos: number;
  ganancia: number;
  masVendido: { nombre: string; cantidad: number } | null;
}

export function resumir(ventas: Venta[], gastos: Gasto[]): Resumen {
  const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.total, 0);
  const piezas = new Map<string, number>();
  for (const v of ventas) {
    for (const it of v.items) piezas.set(it.nombre, (piezas.get(it.nombre) ?? 0) + it.cantidad);
  }
  let masVendido: Resumen['masVendido'] = null;
  for (const [nombre, cantidad] of piezas) {
    if (!masVendido || cantidad > masVendido.cantidad) masVendido = { nombre, cantidad };
  }
  return {
    ventas: totalVentas,
    numVentas: ventas.length,
    gastos: totalGastos,
    numGastos: gastos.length,
    ganancia: totalVentas - totalGastos,
    masVendido
  };
}

export type Enfoque = 'todo' | 'ventas' | 'gastos' | 'ganancia' | 'producto';

export interface Pregunta {
  periodo: Periodo;
  enfoque: Enfoque;
}

function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Entiende preguntas habladas como "¿cuánto gasté la semana pasada?" */
export function entenderPregunta(texto: string): Pregunta {
  const t = normalizar(texto);
  let periodo: Periodo = 'semana';
  if (/semana pasada|semana anterior/.test(t)) periodo = 'semana-pasada';
  else if (/mes pasado|mes anterior/.test(t)) periodo = 'mes-pasado';
  else if (/\bayer\b/.test(t)) periodo = 'ayer';
  else if (/\bhoy\b|\bdia\b/.test(t)) periodo = 'hoy';
  else if (/\bmes\b/.test(t)) periodo = 'mes';

  let enfoque: Enfoque = 'todo';
  if (/mas vend|que se vende|que vendi mas|producto/.test(t)) enfoque = 'producto';
  else if (/gan(e|ancia|amos|o)|utilidad|quedo|sobro/.test(t)) enfoque = 'ganancia';
  else if (/gast|compr/.test(t)) enfoque = 'gastos';
  else if (/vend|venta/.test(t)) enfoque = 'ventas';
  return { periodo, enfoque };
}

function frase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Arma la respuesta. Con dineroVoz para leerla en voz alta; con dinero para mostrarla. */
export function respuestaHablada(r: Resumen, rango: Rango, enfoque: Enfoque, fmt: (n: number) => string = dineroVoz): string {
  const cuando = rango.nombre;
  if (r.numVentas === 0 && r.numGastos === 0) {
    return `${frase(cuando)} todavía no tienes ventas ni gastos registrados.`;
  }
  const ventas = `${cuando} vendiste ${fmt(r.ventas)} en ${r.numVentas} ${r.numVentas === 1 ? 'venta' : 'ventas'}`;
  const gastos = `gastaste ${fmt(r.gastos)}`;
  const ganancia =
    r.ganancia >= 0
      ? `te quedaron ${fmt(Math.abs(r.ganancia))} de ganancia`
      : `perdiste ${fmt(Math.abs(r.ganancia))}, porque gastaste más de lo que vendiste`;
  const producto = r.masVendido
    ? `Lo que más vendiste fue ${r.masVendido.nombre.toLowerCase()}, ${r.masVendido.cantidad} ${r.masVendido.cantidad === 1 ? 'pieza' : 'piezas'}.`
    : '';

  switch (enfoque) {
    case 'ventas':
      return `${frase(ventas)}.`;
    case 'gastos':
      return `${frase(cuando)} ${gastos}${r.numGastos ? ` en ${r.numGastos} ${r.numGastos === 1 ? 'compra' : 'compras'}` : ''}.`;
    case 'ganancia':
      return `${frase(cuando)} ${ganancia}.`;
    case 'producto':
      return producto || `${frase(cuando)} todavía no hay ventas.`;
    case 'todo':
      return `${frase(ventas)}, ${gastos} y ${ganancia}. ${producto}`.trim();
  }
}
