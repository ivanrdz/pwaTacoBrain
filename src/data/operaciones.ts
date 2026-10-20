// Operaciones que tocan varias partes del almacén a la vez.
import { fechaISO, type Rango } from '../lib/fechas';
import { balanceGeneral, buscarInsumo, costosDeRenglones, estadoResultados, valuarInventario, type BalanceGeneral, type EstadoResultados, type Valuacion } from '../lib/finanzas';
import { nuevoId } from '../lib/id';
import { masVendido, type Resumen } from '../lib/reportes';
import type { Almacen, Gasto } from './tipos';

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
  const er = estadoResultados(ventasPeriodo, gastosPeriodo, inventarioPeriodo.costoBajas);
  const erAcumulado = estadoResultados(ventas, gastos, inventarioTotal.costoBajas);
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
