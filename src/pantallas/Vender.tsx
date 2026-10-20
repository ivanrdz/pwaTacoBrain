import { useEffect, useMemo, useRef, useState } from 'react';
import { almacen } from '../data/almacen';
import { CONFIG_INICIAL, NOMBRE_CANAL, NOMBRE_METODO, porcentajeComision, type Canal, type Comisiones, type MetodoPago, type Producto, type Venta } from '../data/tipos';
import { dinero } from '../lib/dinero';
import { nuevoId } from '../lib/id';
import { Encabezado } from '../componentes/Encabezado';
import { Icono } from '../componentes/Icono';

type Aviso = { tipo: 'ok'; texto: string; ventaId: string } | { tipo: 'error'; texto: string };

function textoClaro(color: string): boolean {
  // Elige letra blanca u oscura según el fondo del botón
  const c = color.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.55;
}

export function Vender({ regresar, ir }: { regresar: () => void; ir: (p: 'productos') => void }) {
  const a = almacen();
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [orden, setOrden] = useState<Record<string, number>>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [hojaCobro, setHojaCobro] = useState(false);
  const [comisiones, setComisiones] = useState<Comisiones>(CONFIG_INICIAL.comisiones);
  const temporizador = useRef<number | undefined>(undefined);

  useEffect(() => {
    a.listarProductos().then(setProductos).catch(() => setProductos([]));
    a.config()
      .then((c) => setComisiones(c.comisiones))
      .catch(() => undefined);
    return () => window.clearTimeout(temporizador.current);
  }, [a]);

  const { piezas, total } = useMemo(() => {
    let piezas = 0;
    let total = 0;
    for (const p of productos ?? []) {
      const c = orden[p.id] ?? 0;
      piezas += c;
      total += c * p.precio;
    }
    return { piezas, total };
  }, [orden, productos]);

  function mostrar(av: Aviso, ms: number) {
    setAviso(av);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setAviso(null), ms);
  }

  function cambiar(id: string, delta: number) {
    setOrden((o) => {
      const n = Math.max(0, (o[id] ?? 0) + delta);
      const copia = { ...o };
      if (n === 0) delete copia[id];
      else copia[id] = n;
      return copia;
    });
    if (aviso?.tipo === 'error') setAviso(null);
  }

  async function cobrar(metodo: MetodoPago, canal: Canal) {
    if (!productos || piezas === 0 || guardando) return;
    const pct = porcentajeComision(comisiones, metodo, canal);
    const venta: Venta = {
      id: nuevoId(),
      total,
      creadaEn: new Date().toISOString(),
      metodo,
      canal,
      comision: Math.round(total * pct) / 100,
      items: productos.filter((p) => orden[p.id]).map((p) => ({ productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: orden[p.id] }))
    };
    setHojaCobro(false);
    setGuardando(true);
    try {
      await a.registrarVenta(venta);
      setOrden({});
      navigator.vibrate?.(60);
      const como = canal === 'mostrador' ? NOMBRE_METODO[metodo] : NOMBRE_CANAL[canal];
      mostrar({ tipo: 'ok', texto: `Venta de ${dinero(total)} guardada · ${como}`, ventaId: venta.id }, 6000);
    } catch {
      mostrar({ tipo: 'error', texto: 'No se pudo guardar. Intenta otra vez.' }, 5000);
    } finally {
      setGuardando(false);
    }
  }

  async function deshacer(ventaId: string) {
    try {
      await a.borrarVenta(ventaId);
      mostrar({ tipo: 'error', texto: 'Venta cancelada' }, 2500);
    } catch {
      mostrar({ tipo: 'error', texto: 'No se pudo cancelar la venta' }, 4000);
    }
  }

  return (
    <main className="pantalla vender">
      <Encabezado titulo="Vender" onRegresar={regresar} />

      <div className="aviso-zona" aria-live="polite">
        {aviso && (
          <div className={aviso.tipo === 'ok' ? 'aviso aviso-ok' : 'aviso aviso-error'}>
            {aviso.tipo === 'ok' && <Icono nombre="palomita" tam={24} grosor={2.6} />}
            <span>{aviso.texto}</span>
            {aviso.tipo === 'ok' && (
              <button type="button" className="aviso-deshacer" onClick={() => deshacer(aviso.ventaId)}>
                Deshacer
              </button>
            )}
          </div>
        )}
      </div>

      <div className="rejilla-productos">
        {productos === null && <div className="cargando">Cargando…</div>}
        {productos?.length === 0 && (
          <div className="vacio">
            <p>Todavía no tienes productos.</p>
            <button type="button" className="btn btn-acento" onClick={() => ir('productos')}>
              Agregar productos
            </button>
          </div>
        )}
        {productos?.map((p) => {
          const c = orden[p.id] ?? 0;
          return (
            <div key={p.id} className="producto">
              <button type="button" className="producto-btn" style={{ background: p.color, color: textoClaro(p.color) ? '#FFFFFF' : '#1E2328' }} onClick={() => cambiar(p.id, 1)}>
                <span className="producto-nombre">{p.nombre}</span>
                <span className="producto-precio">{dinero(p.precio)}</span>
              </button>
              {c > 0 && (
                <>
                  <span className="producto-cantidad" aria-label={`${c} en la orden`}>
                    {c}
                  </span>
                  <button type="button" className="producto-menos" onClick={() => cambiar(p.id, -1)} aria-label={`Quitar un ${p.nombre}`}>
                    <Icono nombre="menos" tam={22} grosor={3} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <footer className="barra-orden">
        <div className="barra-orden-fila">
          <span className="barra-orden-piezas">{piezas === 0 ? 'Toca un producto' : piezas === 1 ? '1 producto' : `${piezas} productos`}</span>
          <span className="barra-orden-total">{dinero(total)}</span>
        </div>
        <div className="barra-orden-acciones">
          <button type="button" className="btn-limpiar" onClick={() => setOrden({})} disabled={piezas === 0} aria-label="Borrar la orden">
            <Icono nombre="basura" tam={28} />
          </button>
          <button type="button" className="btn btn-verde btn-cobrar" onClick={() => setHojaCobro(true)} disabled={piezas === 0 || guardando}>
            {guardando ? 'Guardando…' : 'Cobrar'}
          </button>
        </div>
      </footer>

      {hojaCobro && (
        <div className="teclado-fondo" role="dialog" aria-modal="true" aria-label="¿Cómo te pagaron?">
          <div className="teclado">
            <div className="hoja-cobro-arriba">
              <span className="teclado-titulo">¿Cómo te pagaron?</span>
              <span className="hoja-cobro-total">{dinero(total)}</span>
            </div>
            <button type="button" className="metodo metodo-principal" onClick={() => cobrar('efectivo', 'mostrador')}>
              <Icono nombre="billete" tam={36} />
              Efectivo
            </button>
            <div className="metodos">
              <button type="button" className="metodo" onClick={() => cobrar('transferencia', 'mostrador')}>
                <Icono nombre="transferencia" tam={30} />
                Transferencia
              </button>
              <button type="button" className="metodo" onClick={() => cobrar('tarjeta', 'mostrador')}>
                <Icono nombre="tarjeta" tam={30} />
                Tarjeta
              </button>
            </div>
            <div className="teclado-titulo hoja-cobro-sub">
              <Icono nombre="moto" tam={22} /> Pedido de app
            </div>
            <div className="metodos metodos-3">
              {(['rappi', 'uber', 'didi'] as const).map((c) => (
                <button key={c} type="button" className={`metodo metodo-app app-${c}`} onClick={() => cobrar('app', c)}>
                  {NOMBRE_CANAL[c]}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-claro" onClick={() => setHojaCobro(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
