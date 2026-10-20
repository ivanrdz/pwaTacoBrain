import { describe, expect, it } from 'vitest';
import { entenderPregunta, respuestaHablada, resumir } from './reportes';
import { rangoDe } from './fechas';
import { dinero } from './dinero';
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

describe('resumir y respuestaHablada', () => {
  const ventas: Venta[] = [
    { id: '1', total: 75, creadaEn: '', items: [{ productoId: 'a', nombre: 'Taco de bistec', precio: 25, cantidad: 3 }] },
    { id: '2', total: 47, creadaEn: '', items: [{ productoId: 'b', nombre: 'Taco al pastor', precio: 22, cantidad: 1 }, { productoId: 'a', nombre: 'Taco de bistec', precio: 25, cantidad: 1 }] }
  ];
  const gastos: Gasto[] = [{ id: 'g', proveedor: 'Carnes', fecha: '2026-10-10', total: 100, creadoEn: '' }];

  it('suma ventas, gastos y producto más vendido', () => {
    const r = resumir(ventas, gastos);
    expect(r.ventas).toBe(122);
    expect(r.gastos).toBe(100);
    expect(r.ganancia).toBe(22);
    expect(r.masVendido).toEqual({ nombre: 'Taco de bistec', cantidad: 4 });
  });

  it('arma la frase completa', () => {
    const texto = respuestaHablada(resumir(ventas, gastos), rangoDe('semana'), 'todo');
    expect(texto).toBe('Esta semana vendiste 122 pesos en 2 ventas, gastaste 100 pesos y te quedaron 22 pesos de ganancia. Lo que más vendiste fue taco de bistec, 4 piezas.');
  });

  it('en pantalla usa formato de dinero', () => {
    const texto = respuestaHablada(resumir(ventas, gastos), rangoDe('semana'), 'ganancia', dinero);
    expect(texto).toBe(`Esta semana te quedaron ${dinero(22)} de ganancia.`);
  });

  it('avisa cuando hay pérdida', () => {
    const texto = respuestaHablada(resumir([], gastos), rangoDe('hoy'), 'ganancia');
    expect(texto).toBe('Hoy perdiste 100 pesos, porque gastaste más de lo que vendiste.');
  });
});
