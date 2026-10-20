// MODO DEMO: todo vive en el celular (localStorage). Sirve para enseñarle la app
// a un cliente sin tener Supabase configurado. La lectura de tickets es simulada.
import { fechaISO } from '../lib/fechas';
import { nuevoId } from '../lib/id';
import { PRODUCTOS_EJEMPLO, type Almacen, type Gasto, type LecturaTicket, type Producto, type Venta } from './tipos';

const K = {
  negocio: 'tb:negocio',
  productos: 'tb:productos',
  ventas: 'tb:ventas',
  gastos: 'tb:gastos'
};

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // almacenamiento lleno o bloqueado: en demo no es crítico
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function crearAlmacenLocal(): Almacen & { cargarSemanaDeEjemplo(): Promise<void> } {
  return {
    modo: 'demo',

    async nombreNegocio() {
      return leer(K.negocio, 'Mi taquería');
    },
    async guardarNombreNegocio(nombre) {
      escribir(K.negocio, nombre);
    },

    async listarProductos() {
      let productos = leer<Producto[] | null>(K.productos, null);
      if (!productos) {
        productos = PRODUCTOS_EJEMPLO.map((p) => ({ ...p, id: nuevoId() }));
        escribir(K.productos, productos);
      }
      return [...productos].sort((a, b) => a.orden - b.orden);
    },
    async guardarProducto(p) {
      const lista = leer<Producto[]>(K.productos, []);
      const i = lista.findIndex((x) => x.id === p.id);
      if (i >= 0) lista[i] = p;
      else lista.push(p);
      escribir(K.productos, lista);
    },
    async borrarProducto(id) {
      escribir(K.productos, leer<Producto[]>(K.productos, []).filter((p) => p.id !== id));
    },

    async registrarVenta(v) {
      escribir(K.ventas, [...leer<Venta[]>(K.ventas, []), v]);
    },
    async borrarVenta(id) {
      escribir(K.ventas, leer<Venta[]>(K.ventas, []).filter((v) => v.id !== id));
    },
    async registrarGasto(g) {
      escribir(K.gastos, [...leer<Gasto[]>(K.gastos, []), g]);
    },

    async ventasEntre(desde, hasta) {
      const a = desde.getTime();
      const b = hasta.getTime();
      return leer<Venta[]>(K.ventas, []).filter((v) => {
        const t = new Date(v.creadaEn).getTime();
        return t >= a && t < b;
      });
    },
    async gastosEntre(desde, hasta) {
      const a = fechaISO(desde);
      const b = fechaISO(hasta);
      return leer<Gasto[]>(K.gastos, []).filter((g) => g.fecha >= a && g.fecha < b);
    },

    async leerTicket(): Promise<LecturaTicket> {
      // Sin Supabase no hay quién lea el ticket: se pide escribir el total.
      // Con VITE_LECTOR_SIMULADO=1 se inventa una lectura, solo para enseñar cómo se ve.
      if (import.meta.env.VITE_LECTOR_SIMULADO !== '1') {
        await esperar(600);
        throw new Error('sin-lector');
      }
      await esperar(1500);
      const montos = [1850, 960, 2340, 415, 1275];
      return {
        proveedor: 'Carnes El Norte',
        fecha: fechaISO(new Date()),
        total: montos[Math.floor(Math.random() * montos.length)]
      };
    },

    /** Llena los últimos 7 días con ventas y compras inventadas, para la demo. */
    async cargarSemanaDeEjemplo() {
      const productos = await this.listarProductos();
      const ventas: Venta[] = [];
      const gastos: Gasto[] = [];
      const hoy = new Date();
      for (let d = 1; d <= 7; d++) {
        const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - d);
        const numVentas = 25 + Math.floor(Math.random() * 20);
        for (let n = 0; n < numVentas; n++) {
          const items = productos
            .filter(() => Math.random() < 0.45)
            .map((p) => ({ productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 + Math.floor(Math.random() * 4) }));
          if (!items.length) continue;
          const hora = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 18 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 60));
          ventas.push({ id: nuevoId(), items, total: items.reduce((s, i) => s + i.precio * i.cantidad, 0), creadaEn: hora.toISOString() });
        }
        if (d % 2 === 1) gastos.push({ id: nuevoId(), proveedor: 'Carnes El Norte', fecha: fechaISO(dia), total: 1800 + Math.floor(Math.random() * 900), creadoEn: dia.toISOString() });
        if (d % 3 === 0) gastos.push({ id: nuevoId(), proveedor: 'Tortillería La Esperanza', fecha: fechaISO(dia), total: 350 + Math.floor(Math.random() * 150), creadoEn: dia.toISOString() });
      }
      escribir(K.ventas, [...leer<Venta[]>(K.ventas, []), ...ventas]);
      escribir(K.gastos, [...leer<Gasto[]>(K.gastos, []), ...gastos]);
    }
  };
}

export function borrarDatosDemo(): void {
  Object.values(K).forEach((k) => localStorage.removeItem(k));
}
