import type { Venta } from '../data/tipos';
import { dineroVoz } from './dinero';
import type { Periodo, Rango } from './fechas';
import type { EstadoResultados } from './finanzas';

export interface Resumen {
  er: EstadoResultados;
  masVendido: { nombre: string; cantidad: number } | null;
}

export function masVendido(ventas: Venta[]): Resumen['masVendido'] {
  const piezas = new Map<string, number>();
  for (const v of ventas) {
    for (const it of v.items) piezas.set(it.nombre, (piezas.get(it.nombre) ?? 0) + it.cantidad);
  }
  let mejor: Resumen['masVendido'] = null;
  for (const [nombre, cantidad] of piezas) {
    if (!mejor || cantidad > mejor.cantidad) mejor = { nombre, cantidad };
  }
  return mejor;
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
  const { er } = r;
  const cuando = rango.nombre;
  const hayGastos = er.comprasInsumos > 0 || er.totalGastosOperacion > 0 || er.costoVentas > 0;
  if (er.numVentas === 0 && !hayGastos) {
    return `${frase(cuando)} todavía no tienes ventas ni gastos registrados.`;
  }
  const ventas = `${cuando} vendiste ${fmt(er.ventasBrutas)} en ${er.numVentas} ${er.numVentas === 1 ? 'venta' : 'ventas'}`;
  const ganancia =
    er.utilidadNeta >= 0
      ? `te quedaron ${fmt(er.utilidadNeta)} de ganancia`
      : `perdiste ${fmt(Math.abs(er.utilidadNeta))}, porque gastaste más de lo que vendiste`;
  const producto = r.masVendido
    ? `Lo que más vendiste fue ${r.masVendido.nombre.toLowerCase()}, ${r.masVendido.cantidad} ${r.masVendido.cantidad === 1 ? 'pieza' : 'piezas'}.`
    : '';

  switch (enfoque) {
    case 'ventas':
      return `${frase(ventas)}.`;
    case 'gastos': {
      const partes: string[] = [];
      if (er.comprasInsumos > 0) partes.push(`compraste ${fmt(er.comprasInsumos)} de insumos`);
      if (er.totalGastosOperacion > 0) partes.push(`pagaste ${fmt(er.totalGastosOperacion)} de otros gastos`);
      if (er.comisiones > 0) partes.push(`se fueron ${fmt(er.comisiones)} en comisiones`);
      if (!partes.length) return `${frase(cuando)} no registraste gastos.`;
      const unidas = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0];
      return `${frase(cuando)} ${unidas}.`;
    }
    case 'ganancia':
      return `${frase(cuando)} ${ganancia}.`;
    case 'producto':
      return producto || `${frase(cuando)} todavía no hay ventas.`;
    case 'todo': {
      const salidas: string[] = [];
      if (er.comisiones > 0) salidas.push(`se fueron ${fmt(er.comisiones)} en comisiones`);
      if (er.costoVentas > 0) salidas.push(`lo que usaste de insumos costó ${fmt(er.costoVentas)}`);
      if (er.totalGastosOperacion > 0) salidas.push(`tus otros gastos fueron ${fmt(er.totalGastosOperacion)}`);
      const medio = salidas.length ? ` ${frase(salidas.length > 1 ? `${salidas.slice(0, -1).join(', ')} y ${salidas[salidas.length - 1]}` : salidas[0])}.` : '';
      return `${frase(ventas)}.${medio} ${frase(ganancia)}. ${producto}`.trim();
    }
  }
}
