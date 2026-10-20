// ---------- Catálogo ----------

export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  color: string;
  orden: number;
}

// ---------- Ventas ----------

/** Cómo pagó el cliente. "app" = lo cobra la plataforma de delivery. */
export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'app';
/** Por dónde llegó el pedido. */
export type Canal = 'mostrador' | 'rappi' | 'uber' | 'didi';

export const NOMBRE_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  app: 'App de delivery'
};

export const NOMBRE_CANAL: Record<Canal, string> = {
  mostrador: 'Mostrador',
  rappi: 'Rappi',
  uber: 'Uber Eats',
  didi: 'DiDi Food'
};

export interface ItemVenta {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface Venta {
  id: string;
  /** Lo que pagó el cliente */
  total: number;
  items: ItemVenta[];
  /** ISO 8601 */
  creadaEn: string;
  metodo: MetodoPago;
  canal: Canal;
  /** Lo que se queda el banco o la app, calculado al momento de cobrar */
  comision: number;
}

// ---------- Gastos y compras ----------

/** "insumos" es costo de lo que se vende; lo demás son gastos de operación. */
export type Categoria = 'insumos' | 'renta' | 'gas' | 'luz' | 'sueldos' | 'otro';

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  insumos: 'Insumos',
  renta: 'Renta',
  gas: 'Gas',
  luz: 'Luz y agua',
  sueldos: 'Sueldos',
  otro: 'Otro gasto'
};

export const CATEGORIAS: Categoria[] = ['insumos', 'renta', 'gas', 'luz', 'sueldos', 'otro'];

/** De dónde salió (o a dónde entró) el dinero */
export type Cuenta = 'efectivo' | 'banco';

export type Unidad = 'kg' | 'pza' | 'paq' | 'lt';
export const UNIDADES: Unidad[] = ['kg', 'pza', 'paq', 'lt'];
export const NOMBRE_UNIDAD: Record<Unidad, string> = { kg: 'kg', pza: 'piezas', paq: 'paquetes', lt: 'litros' };

/** Un renglón del ticket de compra */
export interface ItemCompra {
  nombre: string;
  cantidad: number;
  unidad: Unidad;
  /** Importe del renglón */
  total: number;
}

export interface Gasto {
  id: string;
  proveedor: string;
  /** YYYY-MM-DD, fecha del ticket */
  fecha: string;
  total: number;
  creadoEn: string;
  categoria: Categoria;
  cuenta: Cuenta;
  /** Solo insumos: lo que se compró. Si va vacío, la compra cuenta directo como costo. */
  items: ItemCompra[];
}

export interface LecturaTicket {
  proveedor: string | null;
  fecha: string | null;
  total: number | null;
  categoria?: Categoria | null;
  items?: ItemCompra[];
}

// ---------- Inventario ----------

export interface Insumo {
  id: string;
  nombre: string;
  unidad: Unidad;
}

export interface MovInventario {
  id: string;
  insumoId: string;
  tipo: 'entrada' | 'baja';
  cantidad: number;
  /** Solo entradas: lo que costó esa cantidad */
  costo: number;
  /** YYYY-MM-DD */
  fecha: string;
  creadoEn: string;
  gastoId?: string | null;
}

// ---------- Dinero y cuentas (para el balance) ----------

export interface Equipo {
  id: string;
  nombre: string;
  valor: number;
}

export interface Deuda {
  id: string;
  /** A quién se le debe */
  nombre: string;
  /** Lo que se debía al registrarla */
  saldoInicial: number;
}

/** Salidas de dinero que no son gasto: retiros del dueño y abonos a deudas */
export interface MovDinero {
  id: string;
  tipo: 'retiro' | 'abono';
  monto: number;
  cuenta: Cuenta;
  deudaId?: string | null;
  /** YYYY-MM-DD */
  fecha: string;
  creadoEn: string;
}

export interface Comisiones {
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  rappi: number;
  uber: number;
  didi: number;
}

export interface ConfigFinanzas {
  /** Porcentajes (3.5 = 3.5 %) */
  comisiones: Comisiones;
  cajaInicial: number;
  bancoInicial: number;
  equipo: Equipo[];
  deudas: Deuda[];
}

export const CONFIG_INICIAL: ConfigFinanzas = {
  // Valores de referencia; cada taquería pone los de su banco y sus apps.
  comisiones: { efectivo: 0, transferencia: 0, tarjeta: 3.5, rappi: 25, uber: 30, didi: 25 },
  cajaInicial: 0,
  bancoInicial: 0,
  equipo: [],
  deudas: []
};

export function porcentajeComision(c: Comisiones, metodo: MetodoPago, canal: Canal): number {
  if (canal !== 'mostrador') return c[canal];
  if (metodo === 'app') return 0;
  return c[metodo];
}

// ---------- Compatibilidad con datos guardados antes de estos campos ----------

type Parcial<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function normalizarVenta(v: Parcial<Venta, 'metodo' | 'canal' | 'comision'>): Venta {
  return { ...v, metodo: v.metodo ?? 'efectivo', canal: v.canal ?? 'mostrador', comision: Number(v.comision ?? 0) };
}

export function normalizarGasto(g: Parcial<Gasto, 'categoria' | 'cuenta' | 'items'>): Gasto {
  return { ...g, categoria: g.categoria ?? 'insumos', cuenta: g.cuenta ?? 'efectivo', items: g.items ?? [] };
}

// ---------- Almacén ----------

export type Modo = 'demo' | 'nube';

export interface Almacen {
  modo: Modo;
  nombreNegocio(): Promise<string>;
  guardarNombreNegocio(nombre: string): Promise<void>;
  config(): Promise<ConfigFinanzas>;
  guardarConfig(c: ConfigFinanzas): Promise<void>;

  listarProductos(): Promise<Producto[]>;
  guardarProducto(p: Producto): Promise<void>;
  borrarProducto(id: string): Promise<void>;

  registrarVenta(v: Venta): Promise<void>;
  borrarVenta(id: string): Promise<void>;
  /** Ventas con creadaEn dentro de [desde, hasta) */
  ventasEntre(desde: Date, hasta: Date): Promise<Venta[]>;

  registrarGasto(g: Gasto, foto?: Blob): Promise<void>;
  /** Gastos con fecha dentro de [desde, hasta) */
  gastosEntre(desde: Date, hasta: Date): Promise<Gasto[]>;
  leerTicket(foto: Blob): Promise<LecturaTicket>;

  listarInsumos(): Promise<Insumo[]>;
  guardarInsumo(i: Insumo): Promise<void>;
  /** Todos los movimientos de inventario con fecha < hasta */
  movsInventario(hasta: Date): Promise<MovInventario[]>;
  registrarMovInventario(m: MovInventario): Promise<void>;
  borrarMovInventario(id: string): Promise<void>;

  /** Todos los retiros y abonos con fecha < hasta */
  movsDinero(hasta: Date): Promise<MovDinero[]>;
  registrarMovDinero(m: MovDinero): Promise<void>;
  borrarMovDinero(id: string): Promise<void>;
}

export const COLORES_PRODUCTO = ['#B4410F', '#C2571A', '#7A2E0B', '#1E2328', '#1F7A3F', '#2457A6', '#8A5A00', '#6B3FA0'];

export const PRODUCTOS_EJEMPLO: Omit<Producto, 'id'>[] = [
  { nombre: 'Taco de bistec', precio: 25, color: '#B4410F', orden: 0 },
  { nombre: 'Taco al pastor', precio: 22, color: '#C2571A', orden: 1 },
  { nombre: 'Taco de tripa', precio: 28, color: '#7A2E0B', orden: 2 },
  { nombre: 'Gringa', precio: 55, color: '#1E2328', orden: 3 },
  { nombre: 'Refresco', precio: 25, color: '#2457A6', orden: 4 },
  { nombre: 'Agua fresca', precio: 20, color: '#1F7A3F', orden: 5 }
];
