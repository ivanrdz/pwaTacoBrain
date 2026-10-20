// MODO DEMO: todo vive en el celular (localStorage). Sirve para enseñarle la app
// a un cliente sin tener Supabase configurado.
import { fechaISO } from '../lib/fechas';
import { nuevoId } from '../lib/id';
import {
  CONFIG_INICIAL,
  normalizarGasto,
  normalizarVenta,
  porcentajeComision,
  PRODUCTOS_EJEMPLO,
  type Almacen,
  type ConfigFinanzas,
  type Gasto,
  type Insumo,
  type LecturaTicket,
  type MovDinero,
  type MovInventario,
  type Producto,
  type Venta
} from './tipos';

const K = {
  negocio: 'tb:negocio',
  config: 'tb:config',
  productos: 'tb:productos',
  ventas: 'tb:ventas',
  gastos: 'tb:gastos',
  insumos: 'tb:insumos',
  movsInv: 'tb:movs-inventario',
  movsDin: 'tb:movs-dinero'
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

function agregar<T>(clave: string, item: T): void {
  escribir(clave, [...leer<T[]>(clave, []), item]);
}

function quitar<T extends { id: string }>(clave: string, id: string): void {
  escribir(clave, leer<T[]>(clave, []).filter((x) => x.id !== id));
}

function reemplazar<T extends { id: string }>(clave: string, item: T): void {
  const lista = leer<T[]>(clave, []);
  const i = lista.findIndex((x) => x.id === item.id);
  if (i >= 0) lista[i] = item;
  else lista.push(item);
  escribir(clave, lista);
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
    async config() {
      const c = leer<Partial<ConfigFinanzas>>(K.config, {});
      return { ...CONFIG_INICIAL, ...c, comisiones: { ...CONFIG_INICIAL.comisiones, ...c.comisiones } };
    },
    async guardarConfig(c) {
      escribir(K.config, c);
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
      reemplazar(K.productos, p);
    },
    async borrarProducto(id) {
      quitar(K.productos, id);
    },

    async registrarVenta(v) {
      agregar(K.ventas, v);
    },
    async borrarVenta(id) {
      quitar(K.ventas, id);
    },
    async ventasEntre(desde, hasta) {
      const a = desde.getTime();
      const b = hasta.getTime();
      return leer<Venta[]>(K.ventas, [])
        .filter((v) => {
          const t = new Date(v.creadaEn).getTime();
          return t >= a && t < b;
        })
        .map(normalizarVenta);
    },

    async registrarGasto(g) {
      agregar(K.gastos, g);
    },
    async gastosEntre(desde, hasta) {
      const a = fechaISO(desde);
      const b = fechaISO(hasta);
      return leer<Gasto[]>(K.gastos, [])
        .filter((g) => g.fecha >= a && g.fecha < b)
        .map(normalizarGasto);
    },
    async leerTicket(): Promise<LecturaTicket> {
      // Sin Supabase no hay quién lea el ticket: se pide escribir el total.
      // Con VITE_LECTOR_SIMULADO=1 se inventa una lectura, solo para enseñar cómo se ve.
      if (import.meta.env.VITE_LECTOR_SIMULADO !== '1') {
        await esperar(600);
        throw new Error('sin-lector');
      }
      await esperar(1500);
      return {
        proveedor: 'Carnes El Norte',
        fecha: fechaISO(new Date()),
        total: 1850,
        categoria: 'insumos',
        items: [
          { nombre: 'Bistec de res', cantidad: 6, unidad: 'kg', total: 1500 },
          { nombre: 'Tripa', cantidad: 2, unidad: 'kg', total: 350 }
        ]
      };
    },

    async listarInsumos() {
      return leer<Insumo[]>(K.insumos, []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    },
    async guardarInsumo(i) {
      reemplazar(K.insumos, i);
    },
    async movsInventario(hasta) {
      const b = fechaISO(hasta);
      return leer<MovInventario[]>(K.movsInv, []).filter((m) => m.fecha < b);
    },
    async registrarMovInventario(m) {
      agregar(K.movsInv, m);
    },
    async borrarMovInventario(id) {
      quitar(K.movsInv, id);
    },

    async movsDinero(hasta) {
      const b = fechaISO(hasta);
      return leer<MovDinero[]>(K.movsDin, []).filter((m) => m.fecha < b);
    },
    async registrarMovDinero(m) {
      agregar(K.movsDin, m);
    },
    async borrarMovDinero(id) {
      quitar(K.movsDin, id);
    },

    /** Llena los últimos 7 días con ventas, compras, inventario y gastos inventados, para la demo. */
    async cargarSemanaDeEjemplo() {
      const productos = await this.listarProductos();
      const config = await this.config();
      if (!config.cajaInicial && !config.equipo.length) {
        await this.guardarConfig({
          ...config,
          cajaInicial: 3000,
          bancoInicial: 15000,
          equipo: [
            { id: nuevoId(), nombre: 'Plancha y trompo', valor: 18000 },
            { id: nuevoId(), nombre: 'Refrigerador', valor: 9000 }
          ],
          deudas: [{ id: nuevoId(), nombre: 'Préstamo para el local', saldoInicial: 12000 }]
        });
      }
      const comisiones = (await this.config()).comisiones;
      let insumos = await this.listarInsumos();
      const asegurar = (nombre: string, unidad: Insumo['unidad']) => {
        let i = insumos.find((x) => x.nombre === nombre);
        if (!i) {
          i = { id: nuevoId(), nombre, unidad };
          insumos = [...insumos, i];
          reemplazar(K.insumos, i);
        }
        return i;
      };
      const carne = asegurar('Bistec de res', 'kg');
      const tortilla = asegurar('Tortilla', 'kg');

      const ventas: Venta[] = [];
      const gastos: Gasto[] = [];
      const movs: MovInventario[] = [];
      const hoy = new Date();
      const metodos: Venta['metodo'][] = ['efectivo', 'efectivo', 'efectivo', 'tarjeta', 'transferencia'];
      for (let d = 7; d >= 1; d--) {
        const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - d);
        const fecha = fechaISO(dia);
        const creado = (h: number) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h).toISOString();
        // Compras del día (entran al inventario)
        const kgCarne = 8 + Math.floor(Math.random() * 4);
        const gCarne: Gasto = { id: nuevoId(), proveedor: 'Carnes El Norte', fecha, total: kgCarne * 210, creadoEn: creado(9), categoria: 'insumos', cuenta: 'efectivo', items: [{ nombre: carne.nombre, cantidad: kgCarne, unidad: 'kg', total: kgCarne * 210 }] };
        const gTortilla: Gasto = { id: nuevoId(), proveedor: 'Tortillería La Esperanza', fecha, total: 6 * 24, creadoEn: creado(9), categoria: 'insumos', cuenta: 'efectivo', items: [{ nombre: tortilla.nombre, cantidad: 6, unidad: 'kg', total: 6 * 24 }] };
        gastos.push(gCarne, gTortilla);
        movs.push({ id: nuevoId(), insumoId: carne.id, tipo: 'entrada', cantidad: kgCarne, costo: gCarne.total, fecha, creadoEn: creado(9), gastoId: gCarne.id });
        movs.push({ id: nuevoId(), insumoId: tortilla.id, tipo: 'entrada', cantidad: 6, costo: gTortilla.total, fecha, creadoEn: creado(9), gastoId: gTortilla.id });
        // Lo que se usó en el día
        movs.push({ id: nuevoId(), insumoId: carne.id, tipo: 'baja', cantidad: kgCarne - 1, costo: 0, fecha, creadoEn: creado(23) });
        movs.push({ id: nuevoId(), insumoId: tortilla.id, tipo: 'baja', cantidad: 5.5, costo: 0, fecha, creadoEn: creado(23) });
        if (d === 6) gastos.push({ id: nuevoId(), proveedor: 'Gas del Norte', fecha, total: 850, creadoEn: creado(12), categoria: 'gas', cuenta: 'efectivo', items: [] });
        if (d === 3) gastos.push({ id: nuevoId(), proveedor: 'Ayudante', fecha, total: 2100, creadoEn: creado(23), categoria: 'sueldos', cuenta: 'efectivo', items: [] });

        const numVentas = 25 + Math.floor(Math.random() * 20);
        for (let n = 0; n < numVentas; n++) {
          const items = productos
            .filter(() => Math.random() < 0.45)
            .map((p) => ({ productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 + Math.floor(Math.random() * 4) }));
          if (!items.length) continue;
          const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
          const deApp = Math.random() < 0.12;
          const canal: Venta['canal'] = deApp ? (['rappi', 'uber', 'didi'] as const)[n % 3] : 'mostrador';
          const metodo: Venta['metodo'] = deApp ? 'app' : metodos[n % metodos.length];
          const hora = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 18 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 60));
          ventas.push({ id: nuevoId(), items, total, metodo, canal, comision: Math.round(total * porcentajeComision(comisiones, metodo, canal)) / 100, creadaEn: hora.toISOString() });
        }
      }
      escribir(K.ventas, [...leer<Venta[]>(K.ventas, []), ...ventas]);
      escribir(K.gastos, [...leer<Gasto[]>(K.gastos, []), ...gastos]);
      escribir(K.movsInv, [...leer<MovInventario[]>(K.movsInv, []), ...movs]);
    }
  };
}

export function borrarDatosDemo(): void {
  Object.values(K).forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nada */
    }
  });
}
