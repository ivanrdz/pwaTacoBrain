export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  color: string;
  orden: number;
}

export interface ItemVenta {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface Venta {
  id: string;
  total: number;
  items: ItemVenta[];
  /** ISO 8601 */
  creadaEn: string;
}

export interface Gasto {
  id: string;
  proveedor: string;
  /** YYYY-MM-DD, fecha del ticket */
  fecha: string;
  total: number;
  creadoEn: string;
}

export interface LecturaTicket {
  proveedor: string | null;
  fecha: string | null;
  total: number | null;
}

export type Modo = 'demo' | 'nube';

export interface Almacen {
  modo: Modo;
  nombreNegocio(): Promise<string>;
  guardarNombreNegocio(nombre: string): Promise<void>;
  listarProductos(): Promise<Producto[]>;
  guardarProducto(p: Producto): Promise<void>;
  borrarProducto(id: string): Promise<void>;
  registrarVenta(v: Venta): Promise<void>;
  borrarVenta(id: string): Promise<void>;
  registrarGasto(g: Gasto, foto?: Blob): Promise<void>;
  /** Ventas con creadaEn dentro de [desde, hasta) */
  ventasEntre(desde: Date, hasta: Date): Promise<Venta[]>;
  /** Gastos con fecha dentro de [desde, hasta) */
  gastosEntre(desde: Date, hasta: Date): Promise<Gasto[]>;
  leerTicket(foto: Blob): Promise<LecturaTicket>;
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
