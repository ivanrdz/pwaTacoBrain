import { useState } from 'react';
import { dinero } from '../lib/dinero';
import { Icono } from './Icono';

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'borrar'] as const;

export type FormatoTeclado = 'dinero' | 'cantidad' | 'porcentaje';

function mostrar(valor: number, texto: string, formato: FormatoTeclado, unidad?: string): string {
  if (formato === 'dinero') return dinero(valor);
  const t = texto || '0';
  return formato === 'porcentaje' ? `${t} %` : `${t} ${unidad ?? ''}`.trim();
}

/** Teclado grande para escribir números sin usar el teclado del celular. */
export function TecladoNumerico({
  titulo,
  valorInicial,
  onListo,
  onCancelar,
  formato = 'dinero',
  unidad,
  permitirCero = false
}: {
  titulo: string;
  valorInicial: number | null;
  onListo: (n: number) => void;
  onCancelar: () => void;
  formato?: FormatoTeclado;
  unidad?: string;
  permitirCero?: boolean;
}) {
  const [texto, setTexto] = useState(valorInicial ? String(valorInicial) : '');
  const decimales = formato === 'cantidad' ? 3 : 2;

  function tocar(t: (typeof TECLAS)[number]) {
    if (t === 'borrar') return setTexto((s) => s.slice(0, -1));
    setTexto((s) => {
      if (t === '.' && s.includes('.')) return s;
      const nuevo = s === '0' && t !== '.' ? t : s === '' && t === '.' ? '0.' : s + t;
      const [, dec] = nuevo.split('.');
      if (dec && dec.length > decimales) return s;
      if (nuevo.replace('.', '').length > 8) return s;
      return nuevo;
    });
  }

  const valor = Number(texto || '0');
  const valido = permitirCero ? valor >= 0 && (formato !== 'porcentaje' || valor <= 100) : valor > 0;

  return (
    <div className="teclado-fondo" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="teclado">
        <div className="teclado-titulo">{titulo}</div>
        <div className="teclado-pantalla" aria-live="polite">
          {mostrar(valor, texto, formato, unidad)}
        </div>
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
          <button type="button" className="btn btn-verde" onClick={() => onListo(valor)} disabled={!valido}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
