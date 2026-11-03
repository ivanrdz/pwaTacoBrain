// Herramientas para que el dueño tome decisiones: cuánto deja cada producto, alertas de
// precios, si le conviene cada app, punto de equilibrio, mejores días y horas, cuánto
// apartar, merma y meta semanal. Todo es puro (sin pantallas ni almacenamiento).
import type { Canal, GastosFijos, Insumo, MovInventario, Producto, Venta } from '../data/tipos';
import type { CategoriaOperacion, EstadoResultados } from './finanzas';

const r2 = (n: number) => Math.round(n * 100) / 100;
const DIA_MS = 86_400_000;

/** Lunes = 0 … domingo = 6 */
export const diaSemana = (d: Date) => (d.getDay() + 6) % 7;
export const NOMBRE_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function fechaLocal(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function restarDias(iso: string, dias: number): string {
  const d = fechaLocal(iso);
  d.setDate(d.getDate() - dias);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ---------- 1. Cuánto cuesta y cuánto deja cada producto ----------

/** costos: insumoId → costo por unidad (kg, pza…) */
export type Costos = Map<string, number>;

/** Costo de una pieza según su receta. null si no tiene receta o falta el costo de algún insumo. */
export function costoPorPieza(p: Producto, costos: Costos): number | null {
  if (!p.receta?.length) return null;
  let total = 0;
  for (const ing of p.receta) {
    const c = costos.get(ing.insumoId);
    if (!c || c <= 0) return null;
    total += ing.cantidad * c;
  }
  return r2(total);
}

export interface RentabilidadProducto {
  producto: Producto;
  costo: number | null;
  /** Lo que deja cada pieza (precio − costo) */
  ganancia: number | null;
  /** 0 a 1 */
  margen: number | null;
  vendidos: number;
  vendido: number;
  /** Lo que dejó en el periodo */
  gananciaTotal: number | null;
}

export function rentabilidadProductos(productos: Producto[], ventas: Venta[], costos: Costos): RentabilidadProducto[] {
  const vendidos = new Map<string, { piezas: number; dinero: number }>();
  for (const v of ventas)
    for (const it of v.items) {
      const x = vendidos.get(it.productoId) ?? { piezas: 0, dinero: 0 };
      x.piezas += it.cantidad;
      x.dinero += it.precio * it.cantidad;
      vendidos.set(it.productoId, x);
    }
  return productos
    .map((producto) => {
      const costo = costoPorPieza(producto, costos);
      const ganancia = costo === null ? null : r2(producto.precio - costo);
      const v = vendidos.get(producto.id) ?? { piezas: 0, dinero: 0 };
      return {
        producto,
        costo,
        ganancia,
        margen: ganancia === null || producto.precio <= 0 ? null : ganancia / producto.precio,
        vendidos: v.piezas,
        vendido: r2(v.dinero),
        gananciaTotal: ganancia === null ? null : r2(ganancia * v.piezas)
      };
    })
    .sort((a, b) => (b.gananciaTotal ?? -Infinity) - (a.gananciaTotal ?? -Infinity) || (b.ganancia ?? -Infinity) - (a.ganancia ?? -Infinity));
}

// ---------- 2. Alertas de precios ----------

export interface ImpactoPrecio {
  producto: Producto;
  gananciaAntes: number;
  gananciaAhora: number;
  /** Precio para seguir ganando el mismo porcentaje, redondeado al peso hacia arriba */
  precioSugerido: number;
}

export interface AlertaPrecio {
  insumo: Insumo;
  antes: number;
  ahora: number;
  /** 0.15 = subió 15 % */
  cambio: number;
  fecha: string;
  productos: ImpactoPrecio[];
}

/**
 * Compara el precio de la última compra de cada insumo contra el promedio de las compras
 * de los 30 días anteriores. Avisa si subió al menos `umbral` y la compra es reciente.
 */
export function alertasDePrecio(p: {
  insumos: Insumo[];
  movs: MovInventario[];
  productos: Producto[];
  costos: Costos;
  hoy: string;
  umbral?: number;
}): AlertaPrecio[] {
  const umbral = p.umbral ?? 0.05;
  const alertas: AlertaPrecio[] = [];
  for (const insumo of p.insumos) {
    const entradas = p.movs
      .filter((m) => m.insumoId === insumo.id && m.tipo === 'entrada' && m.cantidad > 0)
      .sort((a, b) => (a.fecha === b.fecha ? a.creadoEn.localeCompare(b.creadoEn) : a.fecha.localeCompare(b.fecha)));
    const ultima = entradas.at(-1);
    if (!ultima || ultima.fecha < restarDias(p.hoy, 14)) continue;
    const desde = restarDias(ultima.fecha, 30);
    const previas = entradas.slice(0, -1).filter((m) => m.fecha >= desde);
    const cant = previas.reduce((s, m) => s + m.cantidad, 0);
    if (!cant) continue;
    const antes = previas.reduce((s, m) => s + m.costo, 0) / cant;
    const ahora = ultima.costo / ultima.cantidad;
    const cambio = ahora / antes - 1;
    if (cambio < umbral) continue;

    const productos: ImpactoPrecio[] = [];
    for (const producto of p.productos) {
      if (!producto.receta?.some((i) => i.insumoId === insumo.id)) continue;
      const costoAntes = costoPorPieza(producto, new Map([...p.costos, [insumo.id, antes]]));
      const costoAhora = costoPorPieza(producto, new Map([...p.costos, [insumo.id, ahora]]));
      if (costoAntes === null || costoAhora === null) continue;
      const gananciaAntes = producto.precio - costoAntes;
      const margen = producto.precio > 0 ? gananciaAntes / producto.precio : 0;
      const precioSugerido = margen > 0 && margen < 1 ? Math.ceil(costoAhora / (1 - margen)) : Math.ceil(producto.precio + (costoAhora - costoAntes));
      productos.push({ producto, gananciaAntes: r2(gananciaAntes), gananciaAhora: r2(producto.precio - costoAhora), precioSugerido });
    }
    alertas.push({ insumo, antes: r2(antes), ahora: r2(ahora), cambio, fecha: ultima.fecha, productos });
  }
  return alertas.sort((a, b) => b.cambio - a.cambio);
}

// ---------- 3. ¿Le conviene cada app? ----------

export interface ResultadoCanal {
  canal: Canal;
  numVentas: number;
  ventas: number;
  comision: number;
  costo: number;
  queda: number;
  /** De cada 100 pesos vendidos, cuántos le quedan después de comisión e insumos */
  porCada100: number;
}

/**
 * proporcionCosto: costo de insumos / ventas del periodo, para productos sin receta.
 */
export function compararCanales(ventas: Venta[], productos: Producto[], costos: Costos, proporcionCosto: number): ResultadoCanal[] {
  const porId = new Map(productos.map((p) => [p.id, p]));
  const acc = new Map<Canal, ResultadoCanal>();
  for (const v of ventas) {
    let costo = 0;
    for (const it of v.items) {
      const p = porId.get(it.productoId);
      const unitario = p ? costoPorPieza(p, costos) : null;
      costo += unitario !== null ? unitario * it.cantidad : it.precio * it.cantidad * proporcionCosto;
    }
    const r = acc.get(v.canal) ?? { canal: v.canal, numVentas: 0, ventas: 0, comision: 0, costo: 0, queda: 0, porCada100: 0 };
    r.numVentas++;
    r.ventas += v.total;
    r.comision += v.comision;
    r.costo += costo;
    acc.set(v.canal, r);
  }
  const orden: Canal[] = ['mostrador', 'rappi', 'uber', 'didi'];
  return orden
    .filter((c) => acc.has(c))
    .map((c) => {
      const r = acc.get(c)!;
      const queda = r.ventas - r.comision - r.costo;
      return { ...r, ventas: r2(r.ventas), comision: r2(r.comision), costo: r2(r.costo), queda: r2(queda), porCada100: r.ventas > 0 ? r2((queda / r.ventas) * 100) : 0 };
    });
}

// ---------- 4 y 6. Gastos fijos, punto de equilibrio y cuánto apartar ----------

const CATEGORIAS_FIJAS: (keyof GastosFijos & CategoriaOperacion)[] = ['renta', 'gas', 'luz', 'sueldos', 'otro'];

export function sumaFijos(f: GastosFijos): number {
  return CATEGORIAS_FIJAS.reduce((s, k) => s + (f[k] || 0), 0);
}

/**
 * Los gastos fijos que anotó el dueño; si no anotó nada, los que registró en los
 * últimos 30 días (renta, gas, luz, sueldos, otros).
 */
export function gastosFijosEfectivos(config: GastosFijos, ultimos30: EstadoResultados['gastosOperacion']): { fijos: GastosFijos; fuente: 'anotados' | 'registrados' | 'ninguno' } {
  if (sumaFijos(config) > 0) return { fijos: config, fuente: 'anotados' };
  const fijos: GastosFijos = { renta: ultimos30.renta, gas: ultimos30.gas, luz: ultimos30.luz, sueldos: ultimos30.sueldos, otro: ultimos30.otro };
  return { fijos, fuente: sumaFijos(fijos) > 0 ? 'registrados' : 'ninguno' };
}

/** De cada peso vendido, cuánto queda después de comisiones e insumos (0 a 1). */
export function margenContribucion(er: EstadoResultados): number | null {
  if (er.ventasBrutas <= 0) return null;
  return (er.ventasNetas - er.costoVentas) / er.ventasBrutas;
}

export interface PuntoEquilibrio {
  mensual: number;
  diario: number;
}

export function puntoEquilibrio(gastosFijosMes: number, diasAbiertosMes: number, margen: number | null): PuntoEquilibrio | null {
  if (margen === null || margen <= 0 || gastosFijosMes <= 0 || diasAbiertosMes <= 0) return null;
  const mensual = gastosFijosMes / margen;
  return { mensual: Math.ceil(mensual), diario: Math.ceil(mensual / diasAbiertosMes) };
}

export function apartarPorDia(fijos: GastosFijos, diasAbiertosMes: number): { concepto: keyof GastosFijos; monto: number }[] {
  if (diasAbiertosMes <= 0) return [];
  return CATEGORIAS_FIJAS.filter((k) => fijos[k] > 0).map((k) => ({ concepto: k, monto: Math.ceil(fijos[k] / diasAbiertosMes) }));
}

// ---------- 5. Mejores días y horas ----------

export interface PatronVentas {
  porDia: { dia: number; total: number; promedio: number }[];
  porHora: { hora: number; total: number }[];
  mejorDia: number | null;
  peorDia: number | null;
  mejorHora: number | null;
}

/** Ventas por día de la semana (promedio por cada vez que tocó ese día) y por hora. */
export function patronVentas(ventas: Venta[], desde: Date, hasta: Date): PatronVentas {
  const veces = Array(7).fill(0);
  for (let t = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()); t < hasta; t = new Date(t.getTime() + DIA_MS)) {
    veces[diaSemana(t)]++;
  }
  const totalDia = Array(7).fill(0);
  const totalHora = Array(24).fill(0);
  for (const v of ventas) {
    const d = new Date(v.creadaEn);
    totalDia[diaSemana(d)] += v.total;
    totalHora[d.getHours()] += v.total;
  }
  const porDia = totalDia.map((total, dia) => ({ dia, total: r2(total), promedio: veces[dia] ? r2(total / veces[dia]) : 0 }));
  const conVentas = porDia.filter((d) => d.total > 0);
  const porHora = totalHora.map((total, hora) => ({ hora, total: r2(total) })).filter((h) => h.total > 0);
  const mejor = <T,>(xs: T[], f: (x: T) => number, max = true) => (xs.length ? xs.reduce((a, b) => ((max ? f(b) > f(a) : f(b) < f(a)) ? b : a)) : null);
  return {
    porDia,
    porHora,
    mejorDia: mejor(conVentas, (d) => d.promedio)?.dia ?? null,
    peorDia: conVentas.length > 1 ? (mejor(conVentas, (d) => d.promedio, false)?.dia ?? null) : null,
    mejorHora: mejor(porHora, (h) => h.total)?.hora ?? null
  };
}

/** Cuánto se usa en promedio de cada insumo según el día de la semana (para saber cuánto comprar). */
export function usoPorDia(insumos: Insumo[], movs: MovInventario[], desde: Date, hasta: Date): { insumo: Insumo; porDia: number[]; total: number }[] {
  const veces = Array(7).fill(0);
  for (let t = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()); t < hasta; t = new Date(t.getTime() + DIA_MS)) veces[diaSemana(t)]++;
  return insumos
    .map((insumo) => {
      const suma = Array(7).fill(0);
      for (const m of movs) {
        if (m.insumoId !== insumo.id || m.tipo !== 'baja' || m.motivo === 'merma') continue;
        const f = fechaLocal(m.fecha);
        if (f < desde || f >= hasta) continue;
        suma[diaSemana(f)] += m.cantidad;
      }
      const total = suma.reduce((s, x) => s + x, 0);
      return { insumo, porDia: suma.map((x, i) => (veces[i] ? Math.round((x / veces[i]) * 100) / 100 : 0)), total };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

// ---------- 7. Merma ----------

export interface MermaInsumo {
  insumo: Insumo;
  /** Lo que se echó a perder o se tiró (cantidad) */
  tirado: number;
  /** Lo que se sacó para vender */
  sacado: number;
  /** Lo que según las recetas y lo vendido se debió usar */
  esperado: number;
  /** sacado − esperado (positivo: se usó más de lo que dicen las recetas) */
  diferencia: number;
  /** Valor de lo tirado + valor de la diferencia positiva */
  valorPerdido: number;
}

export function merma(p: { insumos: Insumo[]; movs: MovInventario[]; productos: Producto[]; ventas: Venta[]; costos: Costos; desde: string; hasta: string }): { porInsumo: MermaInsumo[]; valorTirado: number; valorDiferencia: number } {
  const esperado = new Map<string, number>();
  const porId = new Map(p.productos.map((x) => [x.id, x]));
  for (const v of p.ventas)
    for (const it of v.items) {
      for (const ing of porId.get(it.productoId)?.receta ?? []) esperado.set(ing.insumoId, (esperado.get(ing.insumoId) ?? 0) + ing.cantidad * it.cantidad);
    }
  const enRecetas = new Set(p.productos.flatMap((x) => (x.receta ?? []).map((i) => i.insumoId)));
  let valorTirado = 0;
  let valorDiferencia = 0;
  const porInsumo = p.insumos
    .map((insumo) => {
      let tirado = 0;
      let sacado = 0;
      for (const m of p.movs) {
        if (m.insumoId !== insumo.id || m.tipo !== 'baja' || m.fecha < p.desde || m.fecha >= p.hasta) continue;
        if (m.motivo === 'merma') tirado += m.cantidad;
        else sacado += m.cantidad;
      }
      const esp = enRecetas.has(insumo.id) ? (esperado.get(insumo.id) ?? 0) : 0;
      const diferencia = enRecetas.has(insumo.id) && sacado > 0 ? sacado - esp : 0;
      const costo = p.costos.get(insumo.id) ?? 0;
      const vt = tirado * costo;
      const vd = Math.max(diferencia, 0) * costo;
      valorTirado += vt;
      valorDiferencia += vd;
      const r3 = (n: number) => Math.round(n * 1000) / 1000;
      return { insumo, tirado: r3(tirado), sacado: r3(sacado), esperado: r3(esp), diferencia: r3(diferencia), valorPerdido: r2(vt + vd) };
    })
    .filter((x) => x.tirado > 0 || x.diferencia !== 0)
    .sort((a, b) => b.valorPerdido - a.valorPerdido);
  return { porInsumo, valorTirado: r2(valorTirado), valorDiferencia: r2(valorDiferencia) };
}

// ---------- 8. Meta de la semana ----------

export interface AvanceMeta {
  meta: number;
  llevas: number;
  /** 0 a 1 (puede pasar de 1) */
  avance: number;
  falta: number;
  lograda: boolean;
  /** Días que quedan en la semana contando hoy */
  diasRestantes: number;
  /** Cuánto vender al día los días que quedan para lograrla */
  ventaDiariaNecesaria: number | null;
}

export function avanceMeta(meta: number, gananciaSemana: number, margen: number | null, hoy: Date): AvanceMeta | null {
  if (meta <= 0) return null;
  const diasRestantes = 7 - diaSemana(hoy);
  const falta = Math.max(meta - gananciaSemana, 0);
  return {
    meta,
    llevas: r2(gananciaSemana),
    avance: gananciaSemana / meta,
    falta: r2(falta),
    lograda: falta === 0,
    diasRestantes,
    ventaDiariaNecesaria: falta > 0 && margen && margen > 0 ? Math.ceil(falta / margen / diasRestantes) : null
  };
}
