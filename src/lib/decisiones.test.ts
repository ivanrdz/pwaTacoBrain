import { describe, expect, it } from 'vitest';
import {
  alertasDePrecio,
  apartarPorDia,
  avanceMeta,
  compararCanales,
  costoPorPieza,
  gastosFijosEfectivos,
  margenContribucion,
  merma,
  patronVentas,
  puntoEquilibrio,
  rentabilidadProductos,
  usoPorDia
} from './decisiones';
import { estadoResultados } from './finanzas';
import type { Insumo, MovInventario, Producto, Venta } from '../data/tipos';

const bistec: Insumo = { id: 'b', nombre: 'Bistec', unidad: 'kg' };
const tortilla: Insumo = { id: 't', nombre: 'Tortilla', unidad: 'kg' };
const costos = new Map([
  ['b', 200], // $200 el kg
  ['t', 25]
]);
const tacoBistec: Producto = { id: 'tb', nombre: 'Taco de bistec', precio: 25, color: '', orden: 0, receta: [{ insumoId: 'b', cantidad: 0.08 }, { insumoId: 't', cantidad: 0.06 }] };
const refresco: Producto = { id: 'r', nombre: 'Refresco', precio: 25, color: '', orden: 1 };

const venta = (id: string, cuando: string, items: [Producto, number][], extra: Partial<Venta> = {}): Venta => ({
  id,
  creadaEn: cuando,
  metodo: 'efectivo',
  canal: 'mostrador',
  comision: 0,
  items: items.map(([p, cantidad]) => ({ productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad })),
  total: items.reduce((s, [p, c]) => s + p.precio * c, 0),
  ...extra
});

const mov = (id: string, insumoId: string, tipo: 'entrada' | 'baja', cantidad: number, costo: number, fecha: string, motivo?: 'uso' | 'merma'): MovInventario => ({ id, insumoId, tipo, cantidad, costo, fecha, creadoEn: `${fecha}T10:00:00Z`, motivo });

describe('cuánto deja cada producto', () => {
  it('calcula el costo por pieza con la receta', () => {
    expect(costoPorPieza(tacoBistec, costos)).toBe(17.5); // 0.08×200 + 0.06×25
    expect(costoPorPieza(refresco, costos)).toBeNull();
    expect(costoPorPieza(tacoBistec, new Map([['b', 200]]))).toBeNull(); // falta el costo de la tortilla
  });

  it('ordena por lo que dejó en el periodo', () => {
    const ventas = [venta('1', '2026-11-02T20:00:00', [[tacoBistec, 10], [refresco, 3]])];
    const r = rentabilidadProductos([refresco, tacoBistec], ventas, costos);
    expect(r[0].producto.id).toBe('tb');
    expect(r[0].ganancia).toBe(7.5);
    expect(r[0].gananciaTotal).toBe(75);
    expect(r[0].margen).toBeCloseTo(0.3);
    expect(r[1]).toMatchObject({ producto: refresco, costo: null, vendidos: 3 });
  });
});

describe('alertas de precios', () => {
  it('avisa cuando la carne subió y sugiere el nuevo precio', () => {
    const movs = [mov('1', 'b', 'entrada', 10, 2000, '2026-10-25'), mov('2', 'b', 'entrada', 10, 2000, '2026-10-30'), mov('3', 'b', 'entrada', 10, 2400, '2026-11-02')];
    const [a] = alertasDePrecio({ insumos: [bistec, tortilla], movs, productos: [tacoBistec, refresco], costos, hoy: '2026-11-03' });
    expect(a.insumo.id).toBe('b');
    expect(a.antes).toBe(200);
    expect(a.ahora).toBe(240);
    expect(a.cambio).toBeCloseTo(0.2);
    const [imp] = a.productos;
    expect(imp.gananciaAntes).toBe(7.5);
    expect(imp.gananciaAhora).toBe(4.3); // 25 − (0.08×240 + 1.5)
    expect(imp.precioSugerido).toBe(30); // mismo 30 % de margen: 20.7 / 0.7 = 29.57 → 30
  });

  it('no avisa si el cambio es chico o la compra es vieja', () => {
    const chico = [mov('1', 'b', 'entrada', 10, 2000, '2026-10-30'), mov('2', 'b', 'entrada', 10, 2040, '2026-11-02')];
    expect(alertasDePrecio({ insumos: [bistec], movs: chico, productos: [], costos, hoy: '2026-11-03' })).toEqual([]);
    const vieja = [mov('1', 'b', 'entrada', 10, 2000, '2026-09-01'), mov('2', 'b', 'entrada', 10, 3000, '2026-09-10')];
    expect(alertasDePrecio({ insumos: [bistec], movs: vieja, productos: [], costos, hoy: '2026-11-03' })).toEqual([]);
  });
});

describe('¿le conviene cada app?', () => {
  it('resta comisión e insumos para comparar contra el mostrador', () => {
    const ventas = [venta('1', '2026-11-02T20:00:00', [[tacoBistec, 4]]), venta('2', '2026-11-02T21:00:00', [[tacoBistec, 4]], { canal: 'uber', metodo: 'app', comision: 30 })];
    const [mostrador, uber] = compararCanales(ventas, [tacoBistec], costos, 0.4);
    expect(mostrador).toMatchObject({ canal: 'mostrador', ventas: 100, costo: 70, queda: 30, porCada100: 30 });
    expect(uber).toMatchObject({ canal: 'uber', ventas: 100, comision: 30, costo: 70, queda: 0, porCada100: 0 });
  });

  it('para productos sin receta usa la proporción de costo del periodo', () => {
    const [r] = compararCanales([venta('1', '2026-11-02T20:00:00', [[refresco, 4]])], [refresco], costos, 0.4);
    expect(r.costo).toBe(40);
  });
});

describe('punto de equilibrio y apartar', () => {
  const er = estadoResultados([venta('1', '', [[tacoBistec, 400]])], [{ id: 'g', proveedor: '', fecha: '2026-11-01', total: 6000, creadoEn: '', categoria: 'insumos', cuenta: 'efectivo', items: [] }], 0);

  it('calcula el margen de contribución', () => {
    expect(margenContribucion(er)).toBeCloseTo(0.4); // (10000 − 6000) / 10000
  });

  it('cuánto vender al mes y al día para cubrir los gastos fijos', () => {
    expect(puntoEquilibrio(10400, 26, 0.4)).toEqual({ mensual: 26000, diario: 1000 });
    expect(puntoEquilibrio(10400, 26, null)).toBeNull();
    expect(puntoEquilibrio(0, 26, 0.4)).toBeNull();
  });

  it('usa los gastos registrados si no anotó gastos fijos', () => {
    const anotados = { renta: 6000, gas: 2000, luz: 800, sueldos: 0, otro: 0 };
    expect(gastosFijosEfectivos(anotados, er.gastosOperacion).fuente).toBe('anotados');
    expect(gastosFijosEfectivos({ renta: 0, gas: 0, luz: 0, sueldos: 0, otro: 0 }, { renta: 5000, gas: 0, luz: 0, sueldos: 0, otro: 0 })).toEqual({
      fijos: { renta: 5000, gas: 0, luz: 0, sueldos: 0, otro: 0 },
      fuente: 'registrados'
    });
    expect(apartarPorDia(anotados, 26)).toEqual([
      { concepto: 'renta', monto: 231 },
      { concepto: 'gas', monto: 77 },
      { concepto: 'luz', monto: 31 }
    ]);
  });
});

describe('mejores días y horas', () => {
  it('promedia por cada vez que tocó ese día', () => {
    // Del lunes 26 oct al domingo 8 nov: dos sábados (31 oct y 7 nov)
    const ventas = [
      venta('1', new Date(2026, 9, 31, 20, 15).toISOString(), [[tacoBistec, 40]]), // sábado 1000
      venta('2', new Date(2026, 10, 7, 21, 0).toISOString(), [[tacoBistec, 20]]), // sábado 500
      venta('3', new Date(2026, 9, 27, 20, 30).toISOString(), [[tacoBistec, 10]]) // martes 250
    ];
    const p = patronVentas(ventas, new Date(2026, 9, 26), new Date(2026, 10, 9));
    expect(p.porDia[5].promedio).toBe(750);
    expect(p.porDia[1].promedio).toBe(125);
    expect(p.mejorDia).toBe(5);
    expect(p.peorDia).toBe(1);
    expect(p.mejorHora).toBe(20);
  });

  it('cuánto se usa de cada insumo por día de la semana (sin contar merma)', () => {
    const movs = [mov('1', 'b', 'baja', 9, 0, '2026-10-31'), mov('2', 'b', 'baja', 7, 0, '2026-11-07'), mov('3', 'b', 'baja', 2, 0, '2026-11-07', 'merma')];
    const [u] = usoPorDia([bistec], movs, new Date(2026, 9, 26), new Date(2026, 10, 9));
    expect(u.porDia[5]).toBe(8);
  });
});

describe('merma', () => {
  it('suma lo tirado y lo que se usó de más contra las recetas', () => {
    const ventas = [venta('1', '2026-11-02T20:00:00', [[tacoBistec, 100]])]; // receta: 8 kg de bistec
    const movs = [mov('1', 'b', 'baja', 9, 0, '2026-11-02'), mov('2', 'b', 'baja', 0.5, 0, '2026-11-02', 'merma')];
    const m = merma({ insumos: [bistec, tortilla], movs, productos: [tacoBistec], ventas, costos, desde: '2026-11-01', hasta: '2026-11-04' });
    expect(m.porInsumo[0]).toMatchObject({ insumo: bistec, tirado: 0.5, sacado: 9, esperado: 8, diferencia: 1, valorPerdido: 300 });
    expect(m.valorTirado).toBe(100);
    expect(m.valorDiferencia).toBe(200);
  });
});

describe('meta de la semana', () => {
  it('dice cuánto falta y cuánto vender al día', () => {
    const jueves = new Date(2026, 10, 5);
    const a = avanceMeta(5000, 3000, 0.4, jueves)!;
    expect(a).toMatchObject({ falta: 2000, diasRestantes: 4, lograda: false, ventaDiariaNecesaria: 1250 });
    expect(a.avance).toBeCloseTo(0.6);
    expect(avanceMeta(5000, 6000, 0.4, jueves)!.lograda).toBe(true);
    expect(avanceMeta(0, 100, 0.4, jueves)).toBeNull();
  });
});
