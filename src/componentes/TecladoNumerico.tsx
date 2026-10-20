import { useState } from 'react';
import { dinero } from '../lib/dinero';
import { Icono } from './Icono';

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'borrar'] as const;

/** Teclado grande para escribir montos sin usar el teclado del celular. */
export function TecladoNumerico({ titulo, valorInicial, onListo, onCancelar }: { titulo: string; valorInicial: number | null; onListo: (n: number) => void; onCancelar: () => void }) {
  const [texto, setTexto] = useState(valorInicial ? String(valorInicial) : '');

  function tocar(t: (typeof TECLAS)[number]) {
    if (t === 'borrar') return setTexto((s) => s.slice(0, -1));
    setTexto((s) => {
      if (t === '.' && s.includes('.')) return s;
      const nuevo = s === '0' && t !== '.' ? t : s + t;
      const [, dec] = nuevo.split('.');
      if (dec && dec.length > 2) return s;
      if (nuevo.replace('.', '').length > 7) return s;
      return nuevo;
    });
  }

  const valor = Number(texto || '0');

  return (
    <div className="teclado-fondo" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="teclado">
        <div className="teclado-titulo">{titulo}</div>
        <div className="teclado-pantalla" aria-live="polite">{dinero(valor)}</div>
        <div className="teclado-teclas">
          {TECLAS.map((t) => (
            <button key={t} type="button" className="tecla" onClick={() => tocar(t)} aria-label={t === 'borrar' ? 'Borrar un número' : t === '.' ? 'Punto' : t}>
              {t === 'borrar' ? <Icono nombre="borrarTecla" tam={30} /> : t}
            </button>
          ))}
        </div>
        <div className="teclado-acciones">
          <button type="button" className="btn btn-claro" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-verde" onClick={() => onListo(valor)} disabled={valor <= 0}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
