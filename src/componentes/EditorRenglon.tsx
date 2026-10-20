import { useState } from 'react';
import { NOMBRE_UNIDAD, UNIDADES, type Insumo, type ItemCompra } from '../data/tipos';
import { dinero } from '../lib/dinero';
import { Icono } from './Icono';
import { TecladoNumerico } from './TecladoNumerico';

/** Hoja para escribir un renglón del ticket: qué, cuánto y cuánto costó. */
export function EditorRenglon({
  inicial,
  insumos,
  onGuardar,
  onBorrar,
  onCancelar
}: {
  inicial: ItemCompra | null;
  insumos: Insumo[];
  onGuardar: (r: ItemCompra) => void;
  onBorrar?: () => void;
  onCancelar: () => void;
}) {
  const [r, setR] = useState<ItemCompra>(inicial ?? { nombre: '', cantidad: 0, unidad: 'kg', total: 0 });
  const [teclado, setTeclado] = useState<'cantidad' | 'total' | null>(null);
  const sugerencias = insumos.filter((i) => i.nombre.toLowerCase().includes(r.nombre.trim().toLowerCase()) && i.nombre !== r.nombre).slice(0, 6);
  const valido = r.nombre.trim().length > 0 && r.cantidad > 0;

  if (teclado) {
    return (
      <TecladoNumerico
        titulo={teclado === 'cantidad' ? `¿Cuánto ${r.nombre || 'compraste'}?` : `¿Cuánto costó ${r.nombre || 'esto'}?`}
        formato={teclado === 'cantidad' ? 'cantidad' : 'dinero'}
        unidad={NOMBRE_UNIDAD[r.unidad]}
        valorInicial={teclado === 'cantidad' ? r.cantidad || null : r.total || null}
        onCancelar={() => setTeclado(null)}
        onListo={(n) => {
          setR({ ...r, [teclado]: n });
          setTeclado(null);
        }}
      />
    );
  }

  return (
    <div className="teclado-fondo" role="dialog" aria-modal="true" aria-label="Lo que compraste">
      <div className="teclado">
        <div className="teclado-titulo">{inicial ? 'Cambiar renglón' : '¿Qué compraste?'}</div>
        <label className="campo">
          <span className="campo-etiqueta">Producto</span>
          <input className="campo-input" value={r.nombre} onChange={(e) => setR({ ...r, nombre: e.target.value })} placeholder="Ej. Bistec de res" autoFocus={!inicial} />
        </label>
        {sugerencias.length > 0 && (
          <div className="chips">
            {sugerencias.map((i) => (
              <button key={i.id} type="button" className="chip" onClick={() => setR({ ...r, nombre: i.nombre, unidad: i.unidad })}>
                {i.nombre}
              </button>
            ))}
          </div>
        )}
        <div className="campo">
          <span className="campo-etiqueta">Se mide en</span>
          <div className="segmentos" role="radiogroup" aria-label="Unidad">
            {UNIDADES.map((u) => (
              <button key={u} type="button" role="radio" aria-checked={r.unidad === u} className={r.unidad === u ? 'segmento elegido' : 'segmento'} onClick={() => setR({ ...r, unidad: u })}>
                {NOMBRE_UNIDAD[u]}
              </button>
            ))}
          </div>
        </div>
        <div className="dos-columnas">
          <div className="campo">
            <span className="campo-etiqueta">Cantidad</span>
            <button type="button" className="campo-precio" onClick={() => setTeclado('cantidad')}>
              {r.cantidad > 0 ? `${r.cantidad} ${r.unidad}` : 'Escribir'}
              <Icono nombre="lapiz" tam={20} />
            </button>
          </div>
          <div className="campo">
            <span className="campo-etiqueta">Costó</span>
            <button type="button" className="campo-precio" onClick={() => setTeclado('total')}>
              {r.total > 0 ? dinero(r.total) : 'Escribir'}
              <Icono nombre="lapiz" tam={20} />
            </button>
          </div>
        </div>
        <div className="teclado-acciones">
          <button type="button" className="btn btn-claro" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-verde" disabled={!valido} onClick={() => onGuardar({ ...r, nombre: r.nombre.trim() })}>
            Listo
          </button>
        </div>
        {onBorrar && (
          <button type="button" className="btn-texto-peligro" onClick={onBorrar}>
            Quitar este renglón
          </button>
        )}
      </div>
    </div>
  );
}
