import { describe, expect, it } from 'vitest';
import { entenderPregunta, masVendido, respuestaHablada, type Resumen } from './reportes';
import { rangoDe } from './fechas';
import { dinero } from './dinero';
import { estadoResultados } from './finanzas';
import type { Gasto, Venta } from '../data/tipos';

describe('entenderPregunta', () => {
  it('por defecto pregunta por toda la semana', () => {
    expect(entenderPregunta('¿Cómo me fue?')).toEqual({ periodo: 'semana', enfoque: 'todo' });
  });
  it('entiende la semana pasada y los gastos', () => {
    expect(entenderPregunta('¿Cuánto gasté la semana pasada?')).toEqual({ periodo: 'semana-pasada', enfoque: 'gastos' });
  });
  it('entiende hoy y ventas', () => {
    expect(entenderPregunta('cuanto vendí hoy')).toEqual({ periodo: 'hoy', enfoque: 'ventas' });
  });
  it('entiende ganancia del mes', () => {
    expect(entenderPregunta('¿Cuánto me quedó este mes?')).toEqual({ periodo: 'mes', enfoque: 'ganancia' });
  });
  it('entiende lo más vendido de ayer', () => {
    expect(entenderPregunta('qué fue lo que más vendí ayer')).toEqual({ periodo: 'ayer', enfoque: 'producto' });
  });
});

describe('rangoDe', () => {
  it('la semana empieza en lunes', () => {
    const sabado = new Date(2026, 9, 10, 15, 0); // sábado 10 oct 2026
    const r = rangoDe('semana', sabado);
    expect(r.desde).toEqual(new Date(2026, 9, 5));
    expect(r.hasta).toEqual(new Date(2026, 9, 12));
  });
});

describe('respuestaHablada', () => {
  const base = { creadaEn: '', metodo: 'efectivo' as const, canal: 'mostrador' as const, comision: 0 };
  const ventas: Venta[] = [
    { ...base, id: '1', total: 75, items: [{ productoId: 'a', nombre: 'Taco de bistec', precio: 25, cantidad: 3 }] },
    { ...base, id: '2', total: 47, items: [{ productoId: 'b', nombre: 'Taco al pastor', precio: 22, cantidad: 1 }, { productoId: 'a', nombre: 'Taco de bistec', precio: 25, cantidad: 1 }] }
  ];
  const gastos: Gasto[] = [{ id: 'g', proveedor: 'Carnes', fecha: '2026-10-10', total: 100, creadoEn: '', categoria: 'insumos', cuenta: 'efectivo', items: [] }];
  const resumen = (v: Venta[], g: Gasto[]): Resumen => ({ er: estadoResultados(v, g, 0), masVendido: masVendido(v) });

  it('encuentra el producto más vendido', () => {
    expect(masVendido(ventas)).toEqual({ nombre: 'Taco de bistec', cantidad: 4 });
  });

  it('arma la frase completa', () => {
    const texto = respuestaHablada(resumen(ventas, gastos), rangoDe('semana'), 'todo');
    expect(texto).toBe('Esta semana vendiste 122 pesos en 2 ventas. Lo que usaste de insumos costó 100 pesos. Te quedaron 22 pesos de ganancia. Lo que más vendiste fue taco de bistec, 4 piezas.');
  });

  it('menciona comisiones cuando hay', () => {
    const conTarjeta: Venta[] = [{ ...ventas[0], metodo: 'tarjeta', comision: 5 }];
    const texto = respuestaHablada(resumen(conTarjeta, []), rangoDe('hoy'), 'todo');
    expect(texto).toBe('Hoy vendiste 75 pesos en 1 venta. Se fueron 5 pesos en comisiones. Te quedaron 70 pesos de ganancia. Lo que más vendiste fue taco de bistec, 3 piezas.');
  });

  it('en pantalla usa formato de dinero', () => {
    const texto = respuestaHablada(resumen(ventas, gastos), rangoDe('semana'), 'ganancia', dinero);
    expect(texto).toBe(`Esta semana te quedaron ${dinero(22)} de ganancia.`);
  });

  it('avisa cuando hay pérdida', () => {
    const texto = respuestaHablada(resumen([], gastos), rangoDe('hoy'), 'ganancia');
    expect(texto).toBe('Hoy perdiste 100 pesos, porque gastaste más de lo que vendiste.');
  });

  it('resume los gastos', () => {
    const texto = respuestaHablada(resumen(ventas, gastos), rangoDe('ayer'), 'gastos');
    expect(texto).toBe('Ayer compraste 100 pesos de insumos.');
  });
});
