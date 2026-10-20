import { useCallback, useEffect, useState } from 'react';
import { almacen } from '../data/almacen';
import { NOMBRE_UNIDAD, type Insumo, type MovInventario } from '../data/tipos';
import { dinero } from '../lib/dinero';
import { fechaISO } from '../lib/fechas';
import { valuarInventario, type Valuacion } from '../lib/finanzas';
import { nuevoId } from '../lib/id';
import { Encabezado } from '../componentes/Encabezado';
import { Icono } from '../componentes/Icono';
import { TecladoNumerico } from '../componentes/TecladoNumerico';

const cantidadBonita = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, ''));

/** Lo que hay en existencia y la opción de sacar lo que se usó en el día. */
export function Inventario({ regresar, irFoto }: { regresar: () => void; irFoto: () => void }) {
  const a = almacen();
  const [val, setVal] = useState<Valuacion | null>(null);
  const [bajasHoy, setBajasHoy] = useState<MovInventario[]>([]);
  const [sacando, setSacando] = useState<{ insumo: Insumo; existencia: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const hoy = new Date();
      const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
      const [insumos, movs] = await Promise.all([a.listarInsumos(), a.movsInventario(manana)]);
      setVal(valuarInventario(insumos, movs));
      const iso = fechaISO(hoy);
      setBajasHoy(movs.filter((m) => m.tipo === 'baja' && m.fecha === iso).sort((x, y) => y.creadoEn.localeCompare(x.creadoEn)));
    } catch {
      setAviso('No pude cargar el inventario. Revisa el internet.');
    }
  }, [a]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  async function sacar(insumo: Insumo, cantidad: number) {
    setSacando(null);
    try {
      await a.registrarMovInventario({ id: nuevoId(), insumoId: insumo.id, tipo: 'baja', cantidad, costo: 0, fecha: fechaISO(new Date()), creadoEn: new Date().toISOString() });
      navigator.vibrate?.(60);
      setAviso(`Sacaste ${cantidadBonita(cantidad)} ${insumo.unidad} de ${insumo.nombre}`);
      await recargar();
    } catch {
      setAviso('No se pudo guardar. Intenta otra vez.');
    }
  }

  async function deshacer(m: MovInventario) {
    await a.borrarMovInventario(m.id);
    setAviso('Listo, se regresó al inventario');
    await recargar();
  }

  const nombre = (id: string) => val?.porInsumo.find((x) => x.insumo.id === id)?.insumo;

  return (
    <main className="pantalla inventario">
      <Encabezado titulo="Inventario" onRegresar={regresar} />

      {val && val.porInsumo.length > 0 && (
        <section className="tarjeta-hoy" aria-label="Valor del inventario">
          <div className="etiqueta">Lo que tienes guardado vale</div>
          <div className="cifra-grande">{dinero(val.valorTotal)}</div>
          <div className="detalle">Toca "Sacar" en lo que usaste hoy</div>
        </section>
      )}

      {aviso && (
        <div className="aviso aviso-ok" aria-live="polite">
          <Icono nombre="palomita" tam={22} grosor={2.6} />
          <span>{aviso}</span>
        </div>
      )}

      {val === null && <div className="cargando">Cargando…</div>}

      {val && val.porInsumo.length === 0 && (
        <div className="vacio">
          <Icono nombre="caja" tam={56} grosor={1.6} />
          <p>Todavía no hay nada en tu inventario. Cuando tomes foto a un ticket de insumos y agregues lo que compraste, aparece aquí.</p>
          <button type="button" className="btn btn-acento btn-ancho" onClick={irFoto}>
            Tomar foto a un ticket
          </button>
        </div>
      )}

      <section className="lista-inventario" aria-label="Existencias">
        {val?.porInsumo.map(({ insumo, existencia, valor }) => (
          <div key={insumo.id} className={existencia > 0 ? 'fila-inventario' : 'fila-inventario agotado'}>
            <div className="fila-inventario-info">
              <span className="fila-inventario-nombre">{insumo.nombre}</span>
              <span className="fila-inventario-cantidad">
                {existencia > 0 ? `${cantidadBonita(existencia)} ${NOMBRE_UNIDAD[insumo.unidad]}` : 'Se acabó'}
                {existencia > 0 && <span className="fila-inventario-valor"> · {dinero(valor)}</span>}
              </span>
            </div>
            <button type="button" className="btn btn-acento btn-sacar" onClick={() => setSacando({ insumo, existencia })} disabled={existencia <= 0}>
              Sacar
            </button>
          </div>
        ))}
      </section>

      {bajasHoy.length > 0 && (
        <section className="seccion seccion-extra" aria-label="Lo que sacaste hoy">
          <div className="seccion-titulo">Hoy sacaste</div>
          {bajasHoy.map((m) => {
            const ins = nombre(m.insumoId);
            return (
              <div key={m.id} className="fila-baja">
                <span>
                  {cantidadBonita(m.cantidad)} {ins?.unidad} de {ins?.nombre ?? 'insumo'}
                </span>
                <button type="button" className="btn-texto" onClick={() => deshacer(m)}>
                  Deshacer
                </button>
              </div>
            );
          })}
        </section>
      )}

      {sacando && (
        <TecladoNumerico
          titulo={`¿Cuánto sacaste de ${sacando.insumo.nombre}? Hay ${cantidadBonita(sacando.existencia)} ${sacando.insumo.unidad}`}
          formato="cantidad"
          unidad={NOMBRE_UNIDAD[sacando.insumo.unidad]}
          valorInicial={null}
          onCancelar={() => setSacando(null)}
          onListo={(n) => sacar(sacando.insumo, Math.min(n, sacando.existencia))}
        />
      )}
    </main>
  );
}
