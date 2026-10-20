import { useEffect, useState } from 'react';
import { almacen, supabase } from '../data/almacen';
import { borrarDatosDemo, crearAlmacenLocal } from '../data/almacenLocal';
import { COLORES_PRODUCTO, PRODUCTOS_EJEMPLO, type Producto } from '../data/tipos';
import { dinero } from '../lib/dinero';
import { nuevoId } from '../lib/id';
import { Encabezado } from '../componentes/Encabezado';
import { Icono } from '../componentes/Icono';
import { TecladoNumerico } from '../componentes/TecladoNumerico';

type Edicion = Producto & { nuevo: boolean };

export function Productos({ regresar, irDinero }: { regresar: () => void; irDinero: () => void }) {
  const a = almacen();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombre, setNombre] = useState('');
  const [nombreGuardado, setNombreGuardado] = useState(true);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [teclado, setTeclado] = useState(false);
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
  }, []);

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
              Llenar con una semana de ejemplo
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
          <button type="button" className="btn btn-claro" onClick={() => supabase?.auth.signOut()}>
            Cerrar sesión
          </button>
        )}
      </section>

      {edicion && !teclado && (
        <div className="teclado-fondo" role="dialog" aria-modal="true" aria-label={edicion.nuevo ? 'Nuevo producto' : 'Editar producto'}>
          <div className="teclado hoja-producto">
            <div className="teclado-titulo">{edicion.nuevo ? 'Nuevo producto' : 'Editar producto'}</div>
            <label className="campo">
              <span className="campo-etiqueta">Nombre</span>
              <input className="campo-input" value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} placeholder="Ej. Taco de bistec" autoFocus={edicion.nuevo} />
            </label>
            <div className="campo">
              <span className="campo-etiqueta">Precio</span>
              <button type="button" className="campo-precio" onClick={() => setTeclado(true)}>
                {edicion.precio > 0 ? dinero(edicion.precio) : 'Escribir precio'}
                <Icono nombre="lapiz" tam={22} />
              </button>
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

      {edicion && teclado && (
        <TecladoNumerico
          titulo={`Precio de ${edicion.nombre || 'producto'}`}
          valorInicial={edicion.precio || null}
          onCancelar={() => setTeclado(false)}
          onListo={(n) => {
            setEdicion({ ...edicion, precio: n });
            setTeclado(false);
          }}
        />
      )}
    </main>
  );
}
