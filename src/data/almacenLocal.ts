// MODO DEMO: todo vive en el celular (localStorage). Sirve para enseñarle la app
// a un cliente sin tener Supabase configurado.
import { fechaISO } from '../lib/fechas';
import { nuevoId } from '../lib/id';
import {
  completarConfig,
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
    pendientes: () => 0,
    async cerrarSesion() {
      /* en demo no hay sesión */
    },

    async nombreNegocio() {
      return leer(K.negocio, 'Mi taquería');
    },
    async guardarNombreNegocio(nombre) {
      escribir(K.negocio, nombre);
    },
    async config() {
      const c = leer<Partial<ConfigFinanzas>>(K.config, {});
      return completarConfig(c);
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

    /**
     * Llena las últimas 4 semanas con datos inventados para la demo: ventas con más
     * movimiento el fin de semana, recetas, compras (con un alza reciente de la carne),
     * lo que se usó, algo de merma, gastos fijos y una meta.
     */
    async cargarSemanaDeEjemplo() {
      const config = await this.config();
      await this.guardarConfig({
        ...config,
        cajaInicial: config.cajaInicial || 3000,
        bancoInicial: config.bancoInicial || 15000,
        equipo: config.equipo.length
          ? config.equipo
          : [
              { id: nuevoId(), nombre: 'Plancha y trompo', valor: 18000 },
              { id: nuevoId(), nombre: 'Refrigerador', valor: 9000 }
            ],
        deudas: config.deudas.length ? config.deudas : [{ id: nuevoId(), nombre: 'Préstamo para el local', saldoInicial: 12000 }],
        gastosFijos: Object.values(config.gastosFijos).some((x) => x > 0) ? config.gastosFijos : { renta: 6500, gas: 3400, luz: 900, sueldos: 8400, otro: 600 },
        metaSemanal: config.metaSemanal || 9000
      });
      const comisiones = (await this.config()).comisiones;

      // Insumos y su precio por unidad
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
      const ins = {
        bistec: asegurar('Bistec de res', 'kg'),
        pastor: asegurar('Carne al pastor', 'kg'),
        tripa: asegurar('Tripa', 'kg'),
        tortilla: asegurar('Tortilla', 'kg'),
        queso: asegurar('Queso', 'kg'),
        refresco: asegurar('Refresco', 'pza')
      };
      const precio: Record<keyof typeof ins, number> = { bistec: 210, pastor: 150, tripa: 180, tortilla: 24, queso: 160, refresco: 12 };

      // Recetas de los productos de ejemplo (por nombre)
      const recetas: Record<string, [keyof typeof ins, number][]> = {
        'Taco de bistec': [['bistec', 0.08], ['tortilla', 0.06]],
        'Taco al pastor': [['pastor', 0.07], ['tortilla', 0.06]],
        'Taco de tripa': [['tripa', 0.08], ['tortilla', 0.06]],
        Gringa: [['pastor', 0.12], ['queso', 0.05], ['tortilla', 0.08]],
        Refresco: [['refresco', 1]]
      };
      let productos = await this.listarProductos();
      productos = productos.map((p) => (recetas[p.nombre] && !p.receta?.length ? { ...p, receta: recetas[p.nombre].map(([k, cantidad]) => ({ insumoId: ins[k].id, cantidad })) } : p));
      escribir(K.productos, productos);

      const ventas: Venta[] = [];
      const gastos: Gasto[] = [];
      const movs: MovInventario[] = [];
      const hoy = new Date();
      const metodos: Venta['metodo'][] = ['efectivo', 'efectivo', 'efectivo', 'tarjeta', 'transferencia'];
      const azar = (n: number) => Math.floor(Math.random() * n);
      for (let d = 28; d >= 1; d--) {
        const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - d);
        const fecha = fechaISO(dia);
        const creado = (h: number, m = 0) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m).toISOString();
        const semana = (dia.getDay() + 6) % 7; // lunes = 0
        if (semana === 0 && d > 7) continue; // descansa los lunes (menos la última semana)

        // Ventas: más el viernes, sábado y domingo; hora fuerte de 8 a 10 pm
        const usado = new Map<keyof typeof ins, number>();
        const numVentas = (semana >= 4 ? 45 : 28) + azar(12);
        for (let n = 0; n < numVentas; n++) {
          const items = productos
            .filter(() => Math.random() < 0.45)
            .map((p) => ({ productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 + azar(4) }));
          if (!items.length) continue;
          for (const it of items) for (const [k, c] of recetas[it.nombre] ?? []) usado.set(k, (usado.get(k) ?? 0) + c * it.cantidad);
          const total = items.reduce((t, i) => t + i.precio * i.cantidad, 0);
          const deApp = Math.random() < 0.12;
          const canal: Venta['canal'] = deApp ? (['rappi', 'uber', 'didi'] as const)[n % 3] : 'mostrador';
          const metodo: Venta['metodo'] = deApp ? 'app' : metodos[n % metodos.length];
          const hora = [18, 19, 20, 20, 21, 21, 22, 23][azar(8)];
          ventas.push({ id: nuevoId(), items, total, metodo, canal, comision: Math.round(total * porcentajeComision(comisiones, metodo, canal)) / 100, creadaEn: creado(hora, azar(60)) });
        }

        // Compras de la mañana: lo que se va a usar y un poco más. La carne subió hace dos días.
        for (const k of Object.keys(ins) as (keyof typeof ins)[]) {
          const uso = usado.get(k) ?? 0;
          if (!uso) continue;
          const cantidad = k === 'refresco' ? Math.ceil(uso / 24) * 24 : Math.ceil(uso * 1.1 * 2) / 2;
          const unitario = k === 'bistec' && d <= 2 ? 245 : precio[k];
          const total = Math.round(cantidad * unitario);
          const g: Gasto = {
            id: nuevoId(),
            proveedor: k === 'tortilla' ? 'Tortillería La Esperanza' : k === 'refresco' ? 'Abarrotes Don Pepe' : 'Carnes El Norte',
            fecha,
            total,
            creadoEn: creado(9),
            categoria: 'insumos',
            cuenta: 'efectivo',
            items: [{ nombre: ins[k].nombre, cantidad, unidad: ins[k].unidad, total }]
          };
          gastos.push(g);
          movs.push({ id: nuevoId(), insumoId: ins[k].id, tipo: 'entrada', cantidad, costo: total, fecha, creadoEn: creado(9), gastoId: g.id });
          // En la noche: lo que se usó (un poco más que la receta) y a veces algo que se tiró
          const sacado = k === 'refresco' ? uso : Math.round(uso * 1.06 * 100) / 100;
          movs.push({ id: nuevoId(), insumoId: ins[k].id, tipo: 'baja', motivo: 'uso', cantidad: Math.min(sacado, cantidad), costo: 0, fecha, creadoEn: creado(23, 30) });
          if (k === 'tortilla' && d % 4 === 0) movs.push({ id: nuevoId(), insumoId: ins[k].id, tipo: 'baja', motivo: 'merma', cantidad: 0.5, costo: 0, fecha, creadoEn: creado(23, 40) });
        }
        if (d === 26 || d === 12) gastos.push({ id: nuevoId(), proveedor: 'Gas del Norte', fecha, total: 1700, creadoEn: creado(12), categoria: 'gas', cuenta: 'efectivo', items: [] });
        if (semana === 6) gastos.push({ id: nuevoId(), proveedor: 'Ayudante', fecha, total: 2100, creadoEn: creado(23), categoria: 'sueldos', cuenta: 'efectivo', items: [] });
        if (d === 20) gastos.push({ id: nuevoId(), proveedor: 'Renta del local', fecha, total: 6500, creadoEn: creado(10), categoria: 'renta', cuenta: 'banco', items: [] });
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
