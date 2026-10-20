import { describe, expect, it } from 'vitest';
import { balanceGeneral, buscarInsumo, costosDeRenglones, estadoResultados, valuarInventario } from './finanzas';
import { CONFIG_INICIAL, porcentajeComision, type ConfigFinanzas, type Gasto, type Insumo, type MovDinero, type MovInventario, type Venta } from '../data/tipos';

const venta = (id: string, total: number, metodo: Venta['metodo'], canal: Venta['canal'], comision: number): Venta => ({
  id,
  total,
  metodo,
  canal,
  comision,
  creadaEn: '2026-10-20T20:00:00.000Z',
  items: [{ productoId: 'p', nombre: 'Taco', precio: total, cantidad: 1 }]
});

const gasto = (id: string, total: number, categoria: Gasto['categoria'], cuenta: Gasto['cuenta'], items: Gasto['items'] = []): Gasto => ({
  id,
  total,
  categoria,
  cuenta,
  items,
  proveedor: 'X',
  fecha: '2026-10-20',
  creadoEn: '2026-10-20T10:00:00.000Z'
});

const bistec: Insumo = { id: 'b', nombre: 'Bistec', unidad: 'kg' };
const mov = (id: string, tipo: 'entrada' | 'baja', cantidad: number, costo: number, fecha: string): MovInventario => ({
  id,
  insumoId: 'b',
  tipo,
  cantidad,
  costo,
  fecha,
  creadoEn: `${fecha}T10:00:00.000Z`
});

describe('comisiones', () => {
  it('usa la comisión de la app cuando el pedido viene de delivery', () => {
    expect(porcentajeComision(CONFIG_INICIAL.comisiones, 'app', 'uber')).toBe(30);
    expect(porcentajeComision(CONFIG_INICIAL.comisiones, 'tarjeta', 'mostrador')).toBe(3.5);
    expect(porcentajeComision(CONFIG_INICIAL.comisiones, 'efectivo', 'mostrador')).toBe(0);
  });
});

describe('valuarInventario', () => {
  it('valúa a costo promedio y cobra las bajas del periodo', () => {
    const movs = [
      mov('1', 'entrada', 10, 2000, '2026-10-18'), // 200/kg
      mov('2', 'entrada', 10, 2400, '2026-10-19'), // promedio 220/kg
      mov('3', 'baja', 5, 0, '2026-10-19'),
      mov('4', 'baja', 5, 0, '2026-10-20')
    ];
    const v = valuarInventario([bistec], movs, '2026-10-20');
    expect(v.porInsumo[0].existencia).toBe(10);
    expect(v.porInsumo[0].valor).toBe(2200);
    expect(v.costoBajas).toBe(1100); // solo la baja del 20
    expect(valuarInventario([bistec], movs).costoBajas).toBe(2200);
  });

  it('no deja el inventario en negativo y avisa', () => {
    const v = valuarInventario([bistec], [mov('1', 'entrada', 2, 400, '2026-10-20'), mov('2', 'baja', 5, 0, '2026-10-20')]);
    expect(v.porInsumo[0].existencia).toBe(0);
    expect(v.costoBajas).toBe(400);
    expect(v.sinExistencia).toEqual(['Bistec']);
  });
});

describe('costosDeRenglones', () => {
  it('reparte el total del ticket en proporción a cada renglón', () => {
    expect(costosDeRenglones([{ nombre: 'a', cantidad: 1, unidad: 'kg', total: 100 }, { nombre: 'b', cantidad: 1, unidad: 'kg', total: 300 }], 400)).toEqual([100, 300]);
    expect(costosDeRenglones([{ nombre: 'a', cantidad: 1, unidad: 'kg', total: 0 }, { nombre: 'b', cantidad: 1, unidad: 'kg', total: 0 }, { nombre: 'c', cantidad: 1, unidad: 'kg', total: 0 }], 100)).toEqual([33.33, 33.33, 33.34]);
  });
  it('encuentra el insumo sin importar acentos', () => {
    expect(buscarInsumo([{ id: '1', nombre: 'Cebolla Blanca', unidad: 'kg' }], ' cebolla  blanca ')?.id).toBe('1');
  });
});

describe('estado de resultados', () => {
  it('separa comisiones, costo de ventas y gastos de operación', () => {
    const ventas = [venta('1', 1000, 'efectivo', 'mostrador', 0), venta('2', 1000, 'tarjeta', 'mostrador', 35), venta('3', 400, 'app', 'rappi', 100)];
    const gastos = [
      gasto('g1', 500, 'insumos', 'efectivo', [{ nombre: 'Bistec', cantidad: 2, unidad: 'kg', total: 500 }]), // va al inventario
      gasto('g2', 200, 'insumos', 'efectivo'), // sin desglose: costo directo
      gasto('g3', 300, 'renta', 'banco'),
      gasto('g4', 100, 'gas', 'efectivo')
    ];
    const er = estadoResultados(ventas, gastos, 250);
    expect(er.ventasBrutas).toBe(2400);
    expect(er.comisionesBanco).toBe(35);
    expect(er.comisionesApps).toBe(100);
    expect(er.ventasNetas).toBe(2265);
    expect(er.costoVentas).toBe(450);
    expect(er.utilidadBruta).toBe(1815);
    expect(er.totalGastosOperacion).toBe(400);
    expect(er.utilidadNeta).toBe(1415);
    expect(er.porCanal.rappi).toBe(400);
    expect(er.porMetodo.tarjeta).toBe(1000);
    expect(er.comprasInsumos).toBe(700);
  });
});

describe('balance general', () => {
  it('cuadra: activos = pasivos + capital', () => {
    const config: ConfigFinanzas = {
      ...CONFIG_INICIAL,
      cajaInicial: 2000,
      bancoInicial: 5000,
      equipo: [{ id: 'e', nombre: 'Plancha', valor: 8000 }],
      deudas: [{ id: 'd', nombre: 'Carnicería', saldoInicial: 3000 }]
    };
    const ventas = [venta('1', 1000, 'efectivo', 'mostrador', 0), venta('2', 1000, 'tarjeta', 'mostrador', 35), venta('3', 400, 'app', 'uber', 120)];
    const gastos = [
      gasto('g1', 600, 'insumos', 'efectivo', [{ nombre: 'Bistec', cantidad: 3, unidad: 'kg', total: 600 }]),
      gasto('g2', 150, 'insumos', 'efectivo'),
      gasto('g3', 300, 'luz', 'banco')
    ];
    const movsInv = [mov('1', 'entrada', 3, 600, '2026-10-20'), mov('2', 'baja', 1, 0, '2026-10-20')];
    const movsDin: MovDinero[] = [
      { id: 'r', tipo: 'retiro', monto: 500, cuenta: 'efectivo', fecha: '2026-10-20', creadoEn: '' },
      { id: 'a', tipo: 'abono', monto: 1000, cuenta: 'banco', deudaId: 'd', fecha: '2026-10-20', creadoEn: '' }
    ];
    const inv = valuarInventario([bistec], movsInv);
    const er = estadoResultados(ventas, gastos, inv.costoBajas);
    const b = balanceGeneral({ config, ventas, gastos, movs: movsDin, valorInventario: inv.valorTotal, utilidadAcumulada: er.utilidadNeta });

    expect(b.caja).toBe(2000 + 1000 - 600 - 150 - 500);
    expect(b.banco).toBe(5000 + 965 + 280 - 300 - 1000);
    expect(b.inventario).toBe(400);
    expect(b.deudas).toEqual([{ nombre: 'Carnicería', saldo: 2000 }]);
    expect(b.capitalAportado).toBe(2000 + 5000 + 8000 - 3000);
    expect(b.diferencia).toBe(0);
    expect(b.totalActivos).toBe(b.totalPasivos + b.totalCapital);
  });
});
