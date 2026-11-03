import { useEffect, useState } from 'react';
import { almacen } from '../data/almacen';
import { borrarDatosDemo, crearAlmacenLocal } from '../data/almacenLocal';
import { COLORES_PRODUCTO, PRODUCTOS_EJEMPLO, type Insumo, type Producto, type Unidad } from '../data/tipos';
import { costoPorPieza, type Costos } from '../lib/decisiones';
import { dinero } from '../lib/dinero';
import { valuarInventario } from '../lib/finanzas';
import { nuevoId } from '../lib/id';
import { Encabezado } from '../componentes/Encabezado';
import { Icono } from '../componentes/Icono';
import { TecladoNumerico } from '../componentes/TecladoNumerico';

type Edicion = Producto & { nuevo: boolean };

/** En la receta se escribe en gramos o mililitros, más fácil que fracciones de kilo. */
const UNIDAD_RECETA: Record<Unidad, { nombre: string; corto: string; factor: number }> = {
  kg: { nombre: 'gramos', corto: 'g', factor: 1000 },
  lt: { nombre: 'mililitros', corto: 'ml', factor: 1000 },
  pza: { nombre: 'piezas', corto: 'pza', factor: 1 },
  paq: { nombre: 'paquetes', corto: 'paq', factor: 1 }
};

const cantidadReceta = (cantidad: number, unidad: Unidad) => {
  const u = UNIDAD_RECETA[unidad];
  return `${Math.round(cantidad * u.factor * 100) / 100} ${u.corto}`;
};

type Teclado = null | { tipo: 'precio' } | { tipo: 'ingrediente'; insumoId: string };

export function Productos({ regresar, irDinero }: { regresar: () => void; irDinero: () => void }) {
  const a = almacen();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombre, setNombre] = useState('');
  const [nombreGuardado, setNombreGuardado] = useState(true);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [teclado, setTeclado] = useState<Teclado>(null);
  const [eligiendoInsumo, setEligiendoInsumo] = useState(false);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [costos, setCostos] = useState<Costos>(new Map());
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function recargar() {
    try {
      setProductos(await a.listarProductos());
    } catch {
      setMensaje('No pude cargar los productos.');
    }
  }

  useEffect(() => {
    void recargar();
    a.nombreNegocio().then(setNombre).catch(() => undefined);
    const hoy = new Date();
    Promise.all([a.listarInsumos(), a.movsInventario(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1))])
      .then(([ins, movs]) => {
        setInsumos(ins);
        setCostos(new Map(valuarInventario(ins, movs).porInsumo.map((x) => [x.insumo.id, x.costoPromedio])));
      })
      .catch(() => undefined);
  }, []);

  const insumo = (id: string) => insumos.find((i) => i.id === id);

  function ponerIngrediente(insumoId: string, cantidad: number) {
    if (!edicion) return;
    const receta = (edicion.receta ?? []).filter((r) => r.insumoId !== insumoId);
    setEdicion({ ...edicion, receta: cantidad > 0 ? [...receta, { insumoId, cantidad }] : receta });
  }

  async function guardarNombre() {
    await a.guardarNombreNegocio(nombre.trim() || 'Mi taquería');
    setNombreGuardado(true);
  }

  async function guardarProducto() {
    if (!edicion || !edicion.nombre.trim() || edicion.precio <= 0) return;
    const { nuevo: _nuevo, ...p } = edicion;
    try {
      await a.guardarProducto({ ...p, nombre: p.nombre.trim() });
      setEdicion(null);
      await recargar();
    } catch {
      setMensaje('No se pudo guardar el producto.');
    }
  }

  async function borrar(id: string) {
    await a.borrarProducto(id);
    setEdicion(null);
    await recargar();
  }

  async function cargarEjemplo() {
    const base = productos.length;
    for (const [i, p] of PRODUCTOS_EJEMPLO.entries()) await a.guardarProducto({ ...p, id: nuevoId(), orden: base + i });
    await recargar();
  }

  function nuevo() {
    setEdicion({ id: nuevoId(), nombre: '', precio: 0, color: COLORES_PRODUCTO[productos.length % COLORES_PRODUCTO.length], orden: productos.length, nuevo: true });
  }

  return (
    <main className="pantalla productos">
      <Encabezado titulo="Mis productos" onRegresar={regresar} />

      <section className="seccion">
        <label className="campo">
          <span className="campo-etiqueta">Nombre de la taquería</span>
          <input
            className="campo-input"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setNombreGuardado(false);
            }}
            onBlur={guardarNombre}
          />
        </label>
        {!nombreGuardado && (
          <button type="button" className="btn btn-acento" onClick={guardarNombre}>
            Guardar nombre
          </button>
        )}
      </section>

      {mensaje && <div className="aviso aviso-error">{mensaje}</div>}

      <section className="lista-productos" aria-label="Productos">
        {productos.map((p) => (
          <button key={p.id} type="button" className="fila-producto" onClick={() => setEdicion({ ...p, nuevo: false })}>
            <span className="muestra" style={{ background: p.color }} aria-hidden="true" />
            <span className="fila-producto-nombre">{p.nombre}</span>
            <span className="fila-producto-precio">{dinero(p.precio)}</span>
            <Icono nombre="lapiz" tam={22} />
          </button>
        ))}
        {productos.length === 0 && (
          <button type="button" className="btn btn-claro" onClick={cargarEjemplo}>
            Cargar productos de ejemplo
          </button>
        )}
        <button type="button" className="btn btn-acento btn-alto" onClick={nuevo}>
          <Icono nombre="mas" tam={28} grosor={2.6} />
          Agregar producto
        </button>
      </section>

      <section className="seccion seccion-extra">
        <button type="button" className="fila-producto" onClick={irDinero}>
          <Icono nombre="banco" tam={26} />
          <span className="fila-producto-nombre">Caja, equipo, deudas y comisiones</span>
          <Icono nombre="regresar" tam={20} />
        </button>
      </section>

      <section className="seccion seccion-extra">
        {a.modo === 'demo' ? (
          <>
            <div className="seccion-titulo">Modo demo</div>
            <p className="seccion-texto">Los datos viven solo en este celular. Para usarlo de verdad, conecta Supabase (ver README).</p>
            <button
              type="button"
              className="btn btn-claro"
              onClick={async () => {
                await crearAlmacenLocal().cargarSemanaDeEjemplo();
                setMensaje(null);
                regresar();
              }}
            >
              Llenar con un mes de ejemplo
            </button>
            <button
              type="button"
              className="btn btn-claro"
              onClick={() => {
                if (confirm('¿Borrar todas las ventas, gastos y productos de la demo?')) {
                  borrarDatosDemo();
                  location.reload();
                }
              }}
            >
              Borrar datos de la demo
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-claro"
            onClick={async () => {
              const n = a.pendientes();
              if (n > 0 && !confirm(`Hay ${n} ${n === 1 ? 'movimiento' : 'movimientos'} sin subir porque no hubo internet. Si sales ahora se pierden. ¿Salir de todos modos?`)) return;
              await a.cerrarSesion();
            }}
          >
            Cerrar sesión
          </button>
        )}
      </section>

      {edicion && !teclado && !eligiendoInsumo && (
        <div className="teclado-fondo" role="dialog" aria-modal="true" aria-label={edicion.nuevo ? 'Nuevo producto' : 'Editar producto'}>
          <div className="teclado hoja-producto">
            <div className="teclado-titulo">{edicion.nuevo ? 'Nuevo producto' : 'Editar producto'}</div>
            <label className="campo">
              <span className="campo-etiqueta">Nombre</span>
              <input className="campo-input" value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} placeholder="Ej. Taco de bistec" autoFocus={edicion.nuevo} />
            </label>
            <div className="campo">
              <span className="campo-etiqueta">Precio</span>
              <button type="button" className="campo-precio" onClick={() => setTeclado({ tipo: 'precio' })}>
                {edicion.precio > 0 ? dinero(edicion.precio) : 'Escribir precio'}
                <Icono nombre="lapiz" tam={22} />
              </button>
            </div>
            <div className="campo">
              <span className="campo-etiqueta">¿Qué lleva cada uno? (receta)</span>
              {(edicion.receta ?? []).map((r) => {
                const i = insumo(r.insumoId);
                return (
                  <div key={r.insumoId} className="fila-dato">
                    <span>{i?.nombre ?? 'Insumo'}</span>
                    <button type="button" className="fila-dato-valor btn-limpio" onClick={() => setTeclado({ tipo: 'ingrediente', insumoId: r.insumoId })}>
                      {i ? cantidadReceta(r.cantidad, i.unidad) : r.cantidad}
                    </button>
                    <button type="button" className="btn-icono-chico" aria-label={`Quitar ${i?.nombre ?? 'insumo'} de la receta`} onClick={() => ponerIngrediente(r.insumoId, 0)}>
                      <Icono nombre="basura" tam={20} />
                    </button>
                  </div>
                );
              })}
              {insumos.length > 0 ? (
                <button type="button" className="btn btn-claro" onClick={() => setEligiendoInsumo(true)}>
                  <Icono nombre="mas" tam={22} grosor={2.6} />
                  Agregar lo que lleva
                </button>
              ) : (
                <p className="nota">Cuando registres tus compras de insumos con foto al ticket, aquí podrás anotar cuánto lleva cada uno.</p>
              )}
              {(() => {
                const costo = costoPorPieza(edicion, costos);
                if (costo === null || edicion.precio <= 0) return null;
                const deja = edicion.precio - costo;
                return (
                  <p className={deja > 0 ? 'nota nota-fuerte' : 'nota nota-mala'}>
                    Cada uno te cuesta {dinero(costo)} y te deja {dinero(deja)} ({Math.round((deja / edicion.precio) * 100)} %).
                  </p>
                );
              })()}
            </div>
            <div className="campo">
              <span className="campo-etiqueta">Color del botón</span>
              <div className="colores" role="radiogroup" aria-label="Color del botón">
                {COLORES_PRODUCTO.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={edicion.color === c} aria-label={`Color ${c}`} className={edicion.color === c ? 'color elegido' : 'color'} style={{ background: c }} onClick={() => setEdicion({ ...edicion, color: c })} />
                ))}
              </div>
            </div>
            <div className="teclado-acciones">
              <button type="button" className="btn btn-claro" onClick={() => setEdicion(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-verde" onClick={guardarProducto} disabled={!edicion.nombre.trim() || edicion.precio <= 0}>
                Guardar
              </button>
            </div>
            {!edicion.nuevo && (
              <button type="button" className="btn-texto-peligro" onClick={() => confirm(`¿Quitar "${edicion.nombre}"?`) && borrar(edicion.id)}>
                Quitar este producto
              </button>
            )}
          </div>
        </div>
      )}

      {edicion && eligiendoInsumo && (
        <div className="teclado-fondo" role="dialog" aria-modal="true" aria-label="¿Qué lleva?">
          <div className="teclado">
            <div className="teclado-titulo">¿Qué lleva {edicion.nombre || 'este producto'}?</div>
            <div className="chips">
              {insumos
                .filter((i) => !(edicion.receta ?? []).some((r) => r.insumoId === i.id))
                .map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setEligiendoInsumo(false);
                      setTeclado({ tipo: 'ingrediente', insumoId: i.id });
                    }}
                  >
                    {i.nombre}
                  </button>
                ))}
            </div>
            <button type="button" className="btn btn-claro" onClick={() => setEligiendoInsumo(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {edicion && teclado?.tipo === 'precio' && (
        <TecladoNumerico
          titulo={`Precio de ${edicion.nombre || 'producto'}`}
          valorInicial={edicion.precio || null}
          onCancelar={() => setTeclado(null)}
          onListo={(n) => {
            setEdicion({ ...edicion, precio: n });
            setTeclado(null);
          }}
        />
      )}

      {edicion && teclado?.tipo === 'ingrediente' && (() => {
        const i = insumo(teclado.insumoId);
        if (!i) return null;
        const u = UNIDAD_RECETA[i.unidad];
        const actual = (edicion.receta ?? []).find((r) => r.insumoId === i.id)?.cantidad;
        return (
          <TecladoNumerico
            titulo={`¿Cuánto ${i.nombre} lleva cada ${edicion.nombre || 'producto'}? (en ${u.nombre})`}
            formato="cantidad"
            unidad={u.nombre}
            valorInicial={actual ? Math.round(actual * u.factor * 100) / 100 : null}
            onCancelar={() => setTeclado(null)}
            onListo={(n) => {
              ponerIngrediente(i.id, n / u.factor);
              setTeclado(null);
            }}
          />
        );
      })()}
    </main>
  );
}
