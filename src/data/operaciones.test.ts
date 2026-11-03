// De punta a punta con el almacén del demo: el mes de ejemplo produce números coherentes.
import { beforeEach, describe, expect, it } from 'vitest';
import { crearAlmacenLocal } from './almacenLocal';
import { calcularDecisiones, calcularNumeros } from './operaciones';
import { rangoDe } from '../lib/fechas';

beforeEach(() => {
  const m = new Map<string, string>();
  const ls = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    }
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
});

describe('mes de ejemplo', () => {
  it('alimenta todas las herramientas de decisión', async () => {
    const a = crearAlmacenLocal();
    await a.cargarSemanaDeEjemplo();
    const d = await calcularDecisiones(a);

    expect(d.er4Semanas.numVentas).toBeGreaterThan(500);
    expect(d.margen).toBeGreaterThan(0);
    expect(d.margen).toBeLessThan(1);

    // 1. Ganancia por producto: los que tienen receta tienen costo; el agua fresca no
    const bistec = d.productos.find((p) => p.producto.nombre === 'Taco de bistec')!;
    expect(bistec.costo).toBeGreaterThan(0);
    expect(bistec.ganancia).toBeLessThan(bistec.producto.precio);
    expect(d.productos.find((p) => p.producto.nombre === 'Agua fresca')!.costo).toBeNull();

    // 2. La carne subió de 210 a 245 hace dos días
    const alerta = d.alertas.find((x) => x.insumo.nombre === 'Bistec de res')!;
    expect(alerta.ahora).toBeCloseTo(245, 0);
    expect(alerta.cambio).toBeGreaterThan(0.1); // la compra de anteayer ya fue a 245 y sube un poco el promedio
    expect(alerta.productos[0].precioSugerido).toBeGreaterThan(25);

    // 3. Apps: queda menos que en mostrador por la comisión
    const mostrador = d.canales.find((c) => c.canal === 'mostrador')!;
    for (const c of d.canales.filter((x) => x.canal !== 'mostrador')) expect(c.porCada100).toBeLessThan(mostrador.porCada100);

    // 4 y 6. Gastos fijos anotados → equilibrio y apartar
    expect(d.fijos.fuente).toBe('anotados');
    expect(d.equilibrio!.diario).toBeGreaterThan(0);
    expect(d.apartar.find((x) => x.concepto === 'renta')!.monto).toBe(250);

    // 5. Fin de semana vende más que entre semana
    const dias = d.patron.porDia;
    expect(dias[5].promedio).toBeGreaterThan(dias[2].promedio);
    expect(d.uso[0].total).toBeGreaterThan(0);

    // 7. Merma: tortilla tirada y uso arriba de la receta
    expect(d.merma.valorTirado).toBeGreaterThan(0);
    expect(d.merma.valorDiferencia).toBeGreaterThan(0);

    // 8. Meta de 9000 por semana
    expect(d.meta!.meta).toBe(9000);

    // Y el balance sigue cuadrando con todo esto
    const n = await calcularNumeros(a, rangoDe('mes'));
    expect(Math.abs(n.balance.diferencia)).toBeLessThan(0.01);
    expect(n.er.merma).toBeGreaterThanOrEqual(0);
  });
});
