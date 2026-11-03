// Operaciones que tocan varias partes del almacén a la vez.
import { fechaISO, rangoDe, type Rango } from '../lib/fechas';
import { balanceGeneral, buscarInsumo, costosDeRenglones, estadoResultados, valuarInventario, type BalanceGeneral, type EstadoResultados, type Valuacion } from '../lib/finanzas';
import { nuevoId } from '../lib/id';
import { masVendido, type Resumen } from '../lib/reportes';
import {
  alertasDePrecio,
  apartarPorDia,
  avanceMeta,
  compararCanales,
  gastosFijosEfectivos,
  margenContribucion,
  merma,
  patronVentas,
  puntoEquilibrio,
  rentabilidadProductos,
  sumaFijos,
  usoPorDia,
  type AlertaPrecio,
  type AvanceMeta,
  type PatronVentas,
  type PuntoEquilibrio,
  type RentabilidadProducto,
  type ResultadoCanal
} from '../lib/decisiones';
import type { Almacen, ConfigFinanzas, Gasto, GastosFijos, Insumo } from './tipos';

/** Guarda el gasto y, si es de insumos con desglose, mete cada renglón al inventario. */
export async function guardarCompra(a: Almacen, g: Gasto, foto?: Blob): Promise<void> {
  await a.registrarGasto(g, foto);
  if (g.categoria !== 'insumos' || !g.items.length) return;
  const insumos = await a.listarInsumos();
  const costos = costosDeRenglones(g.items, g.total);
  for (const [i, it] of g.items.entries()) {
    let insumo = buscarInsumo(insumos, it.nombre);
    if (!insumo) {
      insumo = { id: nuevoId(), nombre: it.nombre.trim(), unidad: it.unidad };
      await a.guardarInsumo(insumo);
      insumos.push(insumo);
    }
    await a.registrarMovInventario({
      id: nuevoId(),
      insumoId: insumo.id,
      tipo: 'entrada',
      cantidad: it.cantidad,
      costo: costos[i],
      fecha: g.fecha,
      creadoEn: g.creadoEn,
      gastoId: g.id
    });
  }
}

export interface Numeros {
  rango: Rango;
  er: EstadoResultados;
  balance: BalanceGeneral;
  inventario: Valuacion;
  resumen: Resumen;
}

const DESDE_SIEMPRE = new Date(2000, 0, 1);

/** Estado de resultados del periodo y balance general al cierre del periodo. */
export async function calcularNumeros(a: Almacen, rango: Rango): Promise<Numeros> {
  const [config, ventas, gastos, insumos, movsInv, movsDin] = await Promise.all([
    a.config(),
    a.ventasEntre(DESDE_SIEMPRE, rango.hasta),
    a.gastosEntre(DESDE_SIEMPRE, rango.hasta),
    a.listarInsumos(),
    a.movsInventario(rango.hasta),
    a.movsDinero(rango.hasta)
  ]);
  const desde = fechaISO(rango.desde);
  const ventasPeriodo = ventas.filter((v) => new Date(v.creadaEn).getTime() >= rango.desde.getTime());
  const gastosPeriodo = gastos.filter((g) => g.fecha >= desde);

  const inventarioPeriodo = valuarInventario(insumos, movsInv, desde);
  const inventarioTotal = valuarInventario(insumos, movsInv);
  const er = estadoResultados(ventasPeriodo, gastosPeriodo, inventarioPeriodo.costoBajas, inventarioPeriodo.costoMerma);
  const erAcumulado = estadoResultados(ventas, gastos, inventarioTotal.costoBajas, inventarioTotal.costoMerma);
  const balance = balanceGeneral({
    config,
    ventas,
    gastos,
    movs: movsDin,
    valorInventario: inventarioTotal.valorTotal,
    utilidadAcumulada: erAcumulado.utilidadNeta
  });
  return { rango, er, balance, inventario: inventarioPeriodo, resumen: { er, masVendido: masVendido(ventasPeriodo) } };
}

// ---------- Herramientas para decidir ----------

export interface Decisiones {
  config: ConfigFinanzas;
  /** Ventana de análisis: las últimas 4 semanas */
  desde: Date;
  hasta: Date;
  er4Semanas: EstadoResultados;
  margen: number | null;
  ventasHoy: number;
  productos: RentabilidadProducto[];
  alertas: AlertaPrecio[];
  canales: ResultadoCanal[];
  fijos: { fijos: GastosFijos; total: number; fuente: 'anotados' | 'registrados' | 'ninguno' };
  equilibrio: PuntoEquilibrio | null;
  apartar: { concepto: keyof GastosFijos; monto: number }[];
  patron: PatronVentas;
  uso: { insumo: Insumo; porDia: number[]; total: number }[];
  merma: ReturnType<typeof merma>;
  meta: AvanceMeta | null;
  semana: EstadoResultados;
}

/** Junta lo de las últimas 4 semanas (y la semana en curso) para las herramientas de decisión. */
export async function calcularDecisiones(a: Almacen, ahora: Date = new Date()): Promise<Decisiones> {
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 28);
  const hace30 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 30);
  const semana = rangoDe('semana', ahora);
  const inicio = desde < semana.desde ? desde : semana.desde;

  const [config, productos, insumos, movs, ventas, gastos] = await Promise.all([
    a.config(),
    a.listarProductos(),
    a.listarInsumos(),
    a.movsInventario(hasta),
    a.ventasEntre(inicio, hasta),
    a.gastosEntre(hace30 < inicio ? hace30 : inicio, hasta)
  ]);
  const iso = { desde: fechaISO(desde), hasta: fechaISO(hasta), semana: fechaISO(semana.desde), hace30: fechaISO(hace30), hoy: fechaISO(hoy) };
  const ventas4 = ventas.filter((v) => new Date(v.creadaEn) >= desde);
  const ventasSemana = ventas.filter((v) => new Date(v.creadaEn) >= semana.desde);

  const valTotal = valuarInventario(insumos, movs);
  const costos = new Map(valTotal.porInsumo.map((x) => [x.insumo.id, x.costoPromedio]));
  const val4 = valuarInventario(insumos, movs, iso.desde);
  const er4Semanas = estadoResultados(ventas4, gastos.filter((g) => g.fecha >= iso.desde), val4.costoBajas, val4.costoMerma);
  const margen = margenContribucion(er4Semanas);
  const proporcionCosto = er4Semanas.ventasBrutas > 0 ? er4Semanas.costoVentas / er4Semanas.ventasBrutas : 0;

  const er30 = estadoResultados([], gastos.filter((g) => g.fecha >= iso.hace30), 0);
  const fijos = gastosFijosEfectivos(config.gastosFijos, er30.gastosOperacion);
  const totalFijos = sumaFijos(fijos.fijos);

  const valSemana = valuarInventario(insumos, movs, iso.semana);
  const erSemana = estadoResultados(ventasSemana, gastos.filter((g) => g.fecha >= iso.semana), valSemana.costoBajas, valSemana.costoMerma);

  return {
    config,
    desde,
    hasta,
    er4Semanas,
    margen,
    ventasHoy: ventas.filter((v) => new Date(v.creadaEn) >= hoy).reduce((s, v) => s + v.total, 0),
    productos: rentabilidadProductos(productos, ventas4, costos),
    alertas: alertasDePrecio({ insumos, movs, productos, costos, hoy: iso.hoy }),
    canales: compararCanales(ventas4, productos, costos, proporcionCosto),
    fijos: { ...fijos, total: totalFijos },
    equilibrio: puntoEquilibrio(totalFijos, config.diasAbiertosMes, margen),
    apartar: apartarPorDia(fijos.fijos, config.diasAbiertosMes),
    patron: patronVentas(ventas4, desde, hasta),
    uso: usoPorDia(insumos, movs, desde, hasta),
    merma: merma({ insumos, movs, productos, ventas: ventas4, costos, desde: iso.desde, hasta: iso.hasta }),
    meta: avanceMeta(config.metaSemanal, erSemana.utilidadNeta, margen, ahora),
    semana: erSemana
  };
}
