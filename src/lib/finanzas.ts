// Cuentas del negocio: inventario (costo promedio), estado de resultados y balance general.
// Todo es puro (sin pantallas ni almacenamiento) para poder probarlo.
//
// Reglas contables del MVP:
// - Ventas: lo que pagó el cliente. Comisiones del banco y de las apps se restan aparte.
// - Compras de insumos CON desglose entran al inventario (activo); se vuelven costo
//   cuando se "sacan" del inventario (bajas), valuadas a costo promedio.
// - Compras de insumos SIN desglose cuentan directo como costo de ventas.
// - Renta, gas, luz, sueldos y otros son gastos de operación.
// - El balance se arma con: caja y banco (iniciales + entradas − salidas), inventario,
//   equipo, deudas (saldo inicial − abonos) y capital (lo aportado + utilidades − retiros).
import type { Categoria, ConfigFinanzas, Gasto, Insumo, ItemCompra, MetodoPago, Canal, MovDinero, MovInventario, Venta } from '../data/tipos';

const redondear = (n: number) => Math.round(n * 100) / 100;

// ---------- Inventario ----------

export interface ExistenciaInsumo {
  insumo: Insumo;
  existencia: number;
  valor: number;
  costoPromedio: number;
}

export interface Valuacion {
  porInsumo: ExistenciaInsumo[];
  valorTotal: number;
  /** Costo de lo que se sacó con fecha >= desde */
  costoBajas: number;
  /** Insumos a los que se les sacó más de lo que había */
  sinExistencia: string[];
}

/** movs: todos los movimientos hasta la fecha de corte. desde: inicio del periodo (YYYY-MM-DD) para sumar el costo de bajas. */
export function valuarInventario(insumos: Insumo[], movs: MovInventario[], desde?: string): Valuacion {
  const estado = new Map<string, { cantidad: number; valor: number; ultimoCosto: number }>();
  for (const i of insumos) estado.set(i.id, { cantidad: 0, valor: 0, ultimoCosto: 0 });
  const orden = [...movs].sort((a, b) => (a.fecha === b.fecha ? a.creadoEn.localeCompare(b.creadoEn) : a.fecha.localeCompare(b.fecha)));
  let costoBajas = 0;
  const sinExistencia = new Set<string>();

  for (const m of orden) {
    let e = estado.get(m.insumoId);
    if (!e) {
      e = { cantidad: 0, valor: 0, ultimoCosto: 0 };
      estado.set(m.insumoId, e);
    }
    if (m.tipo === 'entrada') {
      e.cantidad += m.cantidad;
      e.valor += m.costo;
      if (m.cantidad > 0) e.ultimoCosto = m.costo / m.cantidad;
    } else {
      const disponible = Math.max(e.cantidad, 0);
      const usada = Math.min(m.cantidad, disponible);
      const promedio = disponible > 0 ? e.valor / disponible : 0;
      const costo = usada * promedio;
      if (m.cantidad > disponible + 1e-9) sinExistencia.add(m.insumoId);
      e.cantidad -= usada;
      e.valor -= costo;
      if (e.cantidad < 1e-9) {
        e.cantidad = 0;
        e.valor = 0;
      }
      if (!desde || m.fecha >= desde) costoBajas += costo;
    }
  }

  const porInsumo = insumos.map((insumo) => {
    const e = estado.get(insumo.id)!;
    return {
      insumo,
      existencia: Math.round(e.cantidad * 1000) / 1000,
      valor: redondear(e.valor),
      costoPromedio: e.cantidad > 0 ? redondear(e.valor / e.cantidad) : redondear(e.ultimoCosto)
    };
  });
  const nombres = new Map(insumos.map((i) => [i.id, i.nombre]));
  return {
    porInsumo,
    valorTotal: redondear(porInsumo.reduce((s, x) => s + x.valor, 0)),
    costoBajas: redondear(costoBajas),
    sinExistencia: [...sinExistencia].map((id) => nombres.get(id) ?? 'Insumo')
  };
}

function clave(nombre: string): string {
  return nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Busca el insumo por nombre (sin importar acentos ni mayúsculas). */
export function buscarInsumo(insumos: Insumo[], nombre: string): Insumo | undefined {
  const k = clave(nombre);
  return insumos.find((i) => clave(i.nombre) === k);
}

/**
 * Reparte el total del ticket entre sus renglones (para que el inventario valga
 * exactamente lo que se pagó) y regresa el costo de cada renglón.
 */
export function costosDeRenglones(items: ItemCompra[], totalTicket: number): number[] {
  if (!items.length) return [];
  const suma = items.reduce((s, it) => s + Math.max(it.total, 0), 0);
  const costos = items.map((it) => (suma > 0 ? (Math.max(it.total, 0) / suma) * totalTicket : totalTicket / items.length));
  // Ajuste de centavos al último renglón
  const redondeados = costos.map(redondear);
  const dif = redondear(totalTicket - redondeados.reduce((s, x) => s + x, 0));
  redondeados[redondeados.length - 1] = redondear(redondeados[redondeados.length - 1] + dif);
  return redondeados;
}

// ---------- Estado de resultados ----------

export type CategoriaOperacion = Exclude<Categoria, 'insumos'>;
export const CATEGORIAS_OPERACION: CategoriaOperacion[] = ['renta', 'gas', 'luz', 'sueldos', 'otro'];

export interface EstadoResultados {
  numVentas: number;
  ventasBrutas: number;
  porCanal: Record<Canal, number>;
  porMetodo: Record<MetodoPago, number>;
  comisionesBanco: number;
  comisionesApps: number;
  comisiones: number;
  ventasNetas: number;
  costoInventario: number;
  costoSinDesglose: number;
  costoVentas: number;
  utilidadBruta: number;
  gastosOperacion: Record<CategoriaOperacion, number>;
  totalGastosOperacion: number;
  utilidadNeta: number;
  /** Informativo: todo lo comprado de insumos en el periodo (entró o no al inventario) */
  comprasInsumos: number;
}

export function estadoResultados(ventas: Venta[], gastos: Gasto[], costoInventario: number): EstadoResultados {
  const porCanal: Record<Canal, number> = { mostrador: 0, rappi: 0, uber: 0, didi: 0 };
  const porMetodo: Record<MetodoPago, number> = { efectivo: 0, transferencia: 0, tarjeta: 0, app: 0 };
  let ventasBrutas = 0;
  let comisionesBanco = 0;
  let comisionesApps = 0;
  for (const v of ventas) {
    ventasBrutas += v.total;
    porCanal[v.canal] += v.total;
    porMetodo[v.metodo] += v.total;
    if (v.canal === 'mostrador') comisionesBanco += v.comision;
    else comisionesApps += v.comision;
  }
  const gastosOperacion: Record<CategoriaOperacion, number> = { renta: 0, gas: 0, luz: 0, sueldos: 0, otro: 0 };
  let costoSinDesglose = 0;
  let comprasInsumos = 0;
  for (const g of gastos) {
    if (g.categoria === 'insumos') {
      comprasInsumos += g.total;
      if (!g.items.length) costoSinDesglose += g.total;
    } else {
      gastosOperacion[g.categoria] += g.total;
    }
  }
  const comisiones = comisionesBanco + comisionesApps;
  const ventasNetas = ventasBrutas - comisiones;
  const costoVentas = costoInventario + costoSinDesglose;
  const utilidadBruta = ventasNetas - costoVentas;
  const totalGastosOperacion = CATEGORIAS_OPERACION.reduce((s, c) => s + gastosOperacion[c], 0);
  const r = (n: number) => redondear(n);
  return {
    numVentas: ventas.length,
    ventasBrutas: r(ventasBrutas),
    porCanal,
    porMetodo,
    comisionesBanco: r(comisionesBanco),
    comisionesApps: r(comisionesApps),
    comisiones: r(comisiones),
    ventasNetas: r(ventasNetas),
    costoInventario: r(costoInventario),
    costoSinDesglose: r(costoSinDesglose),
    costoVentas: r(costoVentas),
    utilidadBruta: r(utilidadBruta),
    gastosOperacion,
    totalGastosOperacion: r(totalGastosOperacion),
    utilidadNeta: r(utilidadBruta - totalGastosOperacion),
    comprasInsumos: r(comprasInsumos)
  };
}

// ---------- Balance general ----------

export interface BalanceGeneral {
  caja: number;
  banco: number;
  inventario: number;
  equipo: number;
  totalActivos: number;
  deudas: { nombre: string; saldo: number }[];
  totalPasivos: number;
  capitalAportado: number;
  utilidadAcumulada: number;
  retiros: number;
  totalCapital: number;
  /** Activos − (pasivos + capital); debe ser 0 */
  diferencia: number;
}

/**
 * ventas, gastos y movs: TODO lo registrado hasta la fecha de corte.
 * utilidadAcumulada: utilidad neta del estado de resultados de todo ese mismo periodo.
 */
export function balanceGeneral(p: {
  config: ConfigFinanzas;
  ventas: Venta[];
  gastos: Gasto[];
  movs: MovDinero[];
  valorInventario: number;
  utilidadAcumulada: number;
}): BalanceGeneral {
  const { config, ventas, gastos, movs } = p;
  let caja = config.cajaInicial;
  let banco = config.bancoInicial;
  for (const v of ventas) {
    const neto = v.total - v.comision;
    if (v.metodo === 'efectivo') caja += neto;
    else banco += neto;
  }
  for (const g of gastos) {
    if (g.cuenta === 'efectivo') caja -= g.total;
    else banco -= g.total;
  }
  let retiros = 0;
  const abonos = new Map<string, number>();
  let totalAbonos = 0;
  for (const m of movs) {
    if (m.cuenta === 'efectivo') caja -= m.monto;
    else banco -= m.monto;
    if (m.tipo === 'retiro') retiros += m.monto;
    else {
      totalAbonos += m.monto;
      if (m.deudaId) abonos.set(m.deudaId, (abonos.get(m.deudaId) ?? 0) + m.monto);
    }
  }
  const equipo = config.equipo.reduce((s, e) => s + e.valor, 0);
  const deudasIniciales = config.deudas.reduce((s, d) => s + d.saldoInicial, 0);
  const deudas = config.deudas.map((d) => ({ nombre: d.nombre, saldo: redondear(d.saldoInicial - (abonos.get(d.id) ?? 0)) }));
  const totalPasivos = deudasIniciales - totalAbonos;
  const totalActivos = caja + banco + p.valorInventario + equipo;
  const capitalAportado = config.cajaInicial + config.bancoInicial + equipo - deudasIniciales;
  const totalCapital = capitalAportado + p.utilidadAcumulada - retiros;
  return {
    caja: redondear(caja),
    banco: redondear(banco),
    inventario: redondear(p.valorInventario),
    equipo: redondear(equipo),
    totalActivos: redondear(totalActivos),
    deudas,
    totalPasivos: redondear(totalPasivos),
    capitalAportado: redondear(capitalAportado),
    utilidadAcumulada: redondear(p.utilidadAcumulada),
    retiros: redondear(retiros),
    totalCapital: redondear(totalCapital),
    diferencia: redondear(totalActivos - totalPasivos - totalCapital)
  };
}
