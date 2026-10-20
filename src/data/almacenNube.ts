// MODO NUBE: datos en Supabase, separados por taquería (cada cuenta ve solo lo suyo, por RLS).
// Si se cae el internet, ventas, gastos, inventario y movimientos de dinero se guardan
// en una cola en el celular y se suben solos cuando regresa la señal.
import type { SupabaseClient } from '@supabase/supabase-js';
import { aBase64, comprimirFoto } from '../lib/imagen';
import { fechaISO } from '../lib/fechas';
import {
  CONFIG_INICIAL,
  normalizarGasto,
  normalizarVenta,
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

type Tabla = 'ventas' | 'gastos' | 'insumos' | 'movs_inventario' | 'movs_dinero';
type Fila = Record<string, unknown> & { id: string };
type Pendiente = { op: 'upsert'; tabla: Tabla; fila: Fila } | { op: 'delete'; tabla: Tabla; id: string };

// La cola es POR USUARIO: si en el mismo celular entra otra cuenta, nunca sube
// los pendientes de la anterior. Al cerrar sesión se borra.
let usuarioActual: string | null = null;
const claveCola = (uid: string) => `tb:cola:${uid}`;
const claveFallidos = (uid: string) => `tb:cola-fallidos:${uid}`;

function leerLista<T>(clave: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(clave) ?? '[]') as T[];
  } catch {
    return [];
  }
}

function guardarLista(clave: string, lista: unknown[]): void {
  try {
    if (lista.length) localStorage.setItem(clave, JSON.stringify(lista));
    else localStorage.removeItem(clave);
  } catch {
    /* sin espacio */
  }
}

function leerCola(): Pendiente[] {
  return usuarioActual ? leerLista<Pendiente>(claveCola(usuarioActual)) : [];
}

function guardarCola(cola: Pendiente[]): void {
  if (!usuarioActual) throw new Error('sin-sesion');
  guardarLista(claveCola(usuarioActual), cola);
}

/** Borra todo lo que la app guardó en el celular (cola, demo y versiones viejas). */
function borrarDatosLocales(): void {
  try {
    const claves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('tb:')) claves.push(k);
    }
    claves.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nada */
  }
}

// ---------- Conversión dominio <-> filas ----------

const filaVenta = (v: Venta): Fila => ({ id: v.id, total: v.total, items: v.items, creada_en: v.creadaEn, metodo: v.metodo, canal: v.canal, comision: v.comision });
const aVenta = (f: Fila): Venta =>
  normalizarVenta({
    id: f.id,
    total: Number(f.total),
    items: f.items as Venta['items'],
    creadaEn: String(f.creada_en),
    metodo: f.metodo as Venta['metodo'],
    canal: f.canal as Venta['canal'],
    comision: Number(f.comision ?? 0)
  });

const filaGasto = (g: Gasto, fotoPath: string | null): Fila => ({
  id: g.id,
  proveedor: g.proveedor,
  fecha: g.fecha,
  total: g.total,
  creado_en: g.creadoEn,
  categoria: g.categoria,
  cuenta: g.cuenta,
  items: g.items,
  foto_path: fotoPath
});
const aGasto = (f: Fila): Gasto =>
  normalizarGasto({
    id: f.id,
    proveedor: String(f.proveedor ?? ''),
    fecha: String(f.fecha),
    total: Number(f.total),
    creadoEn: String(f.creado_en),
    categoria: f.categoria as Gasto['categoria'],
    cuenta: f.cuenta as Gasto['cuenta'],
    items: (f.items as Gasto['items']) ?? []
  });

const filaMovInv = (m: MovInventario): Fila => ({
  id: m.id,
  insumo_id: m.insumoId,
  tipo: m.tipo,
  cantidad: m.cantidad,
  costo: m.costo,
  fecha: m.fecha,
  creado_en: m.creadoEn,
  gasto_id: m.gastoId ?? null
});
const aMovInv = (f: Fila): MovInventario => ({
  id: f.id,
  insumoId: String(f.insumo_id),
  tipo: f.tipo as MovInventario['tipo'],
  cantidad: Number(f.cantidad),
  costo: Number(f.costo),
  fecha: String(f.fecha),
  creadoEn: String(f.creado_en),
  gastoId: (f.gasto_id as string | null) ?? null
});

const filaMovDin = (m: MovDinero): Fila => ({ id: m.id, tipo: m.tipo, monto: m.monto, cuenta: m.cuenta, deuda_id: m.deudaId ?? null, fecha: m.fecha, creado_en: m.creadoEn });
const aMovDin = (f: Fila): MovDinero => ({
  id: f.id,
  tipo: f.tipo as MovDinero['tipo'],
  monto: Number(f.monto),
  cuenta: f.cuenta as MovDinero['cuenta'],
  deudaId: (f.deuda_id as string | null) ?? null,
  fecha: String(f.fecha),
  creadoEn: String(f.creado_en)
});

const filaInsumo = (i: Insumo): Fila => ({ id: i.id, nombre: i.nombre, unidad: i.unidad });
const aInsumo = (f: Fila): Insumo => ({ id: f.id, nombre: String(f.nombre), unidad: f.unidad as Insumo['unidad'] });

function esErrorDeRed(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e);
  return /fetch|network|Failed|timeout|Load failed/i.test(msg);
}

export function crearAlmacenNube(sb: SupabaseClient): Almacen {
  let subiendo = false;

  async function ejecutar(p: Pendiente): Promise<void> {
    if (p.op === 'upsert') {
      const { error } = await sb.from(p.tabla).upsert(p.fila, { onConflict: 'id' });
      if (error) throw error;
    } else {
      const { error } = await sb.from(p.tabla).delete().eq('id', p.id);
      if (error) throw error;
    }
  }

  async function vaciarCola() {
    if (subiendo || !navigator.onLine) return;
    subiendo = true;
    try {
      let cola = leerCola();
      while (cola.length) {
        try {
          await ejecutar(cola[0]);
        } catch (e) {
          if (esErrorDeRed(e)) return; // se reintenta cuando regrese la señal
          // Un error de datos no debe atorar la cola: se aparta para revisarlo.
          if (usuarioActual) guardarLista(claveFallidos(usuarioActual), [...leerLista(claveFallidos(usuarioActual)), { pendiente: cola[0], error: String((e as { message?: string })?.message ?? e) }]);
        }
        cola = leerCola().slice(1);
        guardarCola(cola);
      }
    } finally {
      subiendo = false;
    }
  }

  /** Intenta en línea; si no hay red, encola. Errores de datos o permisos se muestran. */
  async function enviar(p: Pendiente, antes?: () => Promise<void>) {
    if (navigator.onLine) {
      try {
        await antes?.();
        await ejecutar(p);
        void vaciarCola();
        return;
      } catch (e) {
        if (!esErrorDeRed(e)) throw e;
      }
    }
    guardarCola([...leerCola(), p]);
  }

  /** Si todavía no se subía, se quita de la cola; si ya está en el servidor, se borra allá. */
  async function borrar(tabla: Tabla, id: string) {
    const cola = leerCola();
    const sinSubir = cola.filter((p) => !(p.op === 'upsert' && p.tabla === tabla && p.fila.id === id));
    if (sinSubir.length !== cola.length) {
      guardarCola(sinSubir);
      return;
    }
    await enviar({ op: 'delete', tabla, id });
  }

  /** Mezcla lo del servidor con lo que sigue en la cola sin subir. */
  function conCola<T extends { id: string }>(tabla: Tabla, delServidor: T[], convertir: (f: Fila) => T, incluir: (x: T) => boolean): T[] {
    const porId = new Map(delServidor.map((x) => [x.id, x]));
    for (const p of leerCola()) {
      if (p.tabla !== tabla) continue;
      if (p.op === 'delete') porId.delete(p.id);
      else {
        const x = convertir(p.fila);
        if (incluir(x)) porId.set(x.id, x);
      }
    }
    return [...porId.values()];
  }

  /** PostgREST regresa máximo 1000 filas por llamada: pedimos por páginas. */
  async function todas(pedir: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<Fila[]> {
    const tam = 1000;
    const salida: Fila[] = [];
    for (let i = 0; ; i += tam) {
      const { data, error } = await pedir(i, i + tam - 1);
      if (error) throw error;
      salida.push(...((data ?? []) as Fila[]));
      if (!data || data.length < tam) return salida;
    }
  }

  window.addEventListener('online', () => void vaciarCola());
  sb.auth.onAuthStateChange((_evento, sesion) => {
    usuarioActual = sesion?.user.id ?? null;
    if (usuarioActual) void vaciarCola();
  });

  async function miId(): Promise<string | null> {
    const { data } = await sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  return {
    modo: 'nube',

    pendientes: () => leerCola().length,
    async cerrarSesion() {
      await sb.auth.signOut();
      usuarioActual = null;
      borrarDatosLocales();
    },

    async nombreNegocio() {
      const { data } = await sb.from('negocios').select('nombre').maybeSingle();
      return data?.nombre ?? 'Mi taquería';
    },
    async guardarNombreNegocio(nombre) {
      const id = await miId();
      if (!id) return;
      const { error } = await sb.from('negocios').upsert({ owner_id: id, nombre }, { onConflict: 'owner_id' });
      if (error) throw error;
    },
    async config() {
      const { data, error } = await sb.from('negocios').select('config').maybeSingle();
      if (error) throw error;
      const c = (data?.config ?? {}) as Partial<ConfigFinanzas>;
      return { ...CONFIG_INICIAL, ...c, comisiones: { ...CONFIG_INICIAL.comisiones, ...c.comisiones } };
    },
    async guardarConfig(c) {
      const id = await miId();
      if (!id) return;
      const { error } = await sb.from('negocios').upsert({ owner_id: id, config: c }, { onConflict: 'owner_id' });
      if (error) throw error;
    },

    async listarProductos() {
      const { data, error } = await sb.from('productos').select('id,nombre,precio,color,orden').eq('activo', true).order('orden');
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, precio: Number(p.precio) })) as Producto[];
    },
    async guardarProducto(p) {
      const { error } = await sb.from('productos').upsert({ id: p.id, nombre: p.nombre, precio: p.precio, color: p.color, orden: p.orden, activo: true });
      if (error) throw error;
    },
    async borrarProducto(id) {
      // Se desactiva en lugar de borrar, para no romper ventas pasadas.
      const { error } = await sb.from('productos').update({ activo: false }).eq('id', id);
      if (error) throw error;
    },

    async registrarVenta(v) {
      await enviar({ op: 'upsert', tabla: 'ventas', fila: filaVenta(v) });
    },
    async borrarVenta(id) {
      await borrar('ventas', id);
    },
    async ventasEntre(desde, hasta) {
      const filas = await todas((a, b) =>
        sb.from('ventas').select('id,total,items,creada_en,metodo,canal,comision').gte('creada_en', desde.toISOString()).lt('creada_en', hasta.toISOString()).order('creada_en').range(a, b)
      );
      return conCola('ventas', filas.map(aVenta), aVenta, (v) => {
        const t = new Date(v.creadaEn).getTime();
        return t >= desde.getTime() && t < hasta.getTime();
      });
    },

    async registrarGasto(g, foto) {
      const fila = filaGasto(g, null);
      await enviar({ op: 'upsert', tabla: 'gastos', fila }, async () => {
        if (!foto) return;
        const id = await miId();
        if (!id) return;
        const ruta = `${id}/${g.id}.jpg`;
        const { error } = await sb.storage.from('tickets').upload(ruta, foto, { contentType: 'image/jpeg', upsert: true });
        if (!error) fila.foto_path = ruta;
      });
    },
    async gastosEntre(desde, hasta) {
      const a = fechaISO(desde);
      const b = fechaISO(hasta);
      const filas = await todas((i, j) =>
        sb.from('gastos').select('id,proveedor,fecha,total,creado_en,categoria,cuenta,items').gte('fecha', a).lt('fecha', b).order('fecha').range(i, j)
      );
      return conCola('gastos', filas.map(aGasto), aGasto, (g) => g.fecha >= a && g.fecha < b);
    },
    async leerTicket(foto): Promise<LecturaTicket> {
      const comprimida = await comprimirFoto(foto);
      const { data, error } = await sb.functions.invoke<LecturaTicket>('leer-ticket', {
        body: { imagen: await aBase64(comprimida), tipo: 'image/jpeg' }
      });
      if (error) {
        const estado = (error as { context?: { status?: number } }).context?.status;
        throw new Error(estado === 429 ? 'limite-ia' : 'sin-lectura');
      }
      if (!data) throw new Error('sin-respuesta');
      return data;
    },

    async listarInsumos() {
      const { data, error } = await sb.from('insumos').select('id,nombre,unidad').order('nombre');
      if (error) throw error;
      return conCola('insumos', ((data ?? []) as Fila[]).map(aInsumo), aInsumo, () => true);
    },
    async guardarInsumo(i) {
      await enviar({ op: 'upsert', tabla: 'insumos', fila: filaInsumo(i) });
    },
    async movsInventario(hasta) {
      const b = fechaISO(hasta);
      const filas = await todas((i, j) =>
        sb.from('movs_inventario').select('id,insumo_id,tipo,cantidad,costo,fecha,creado_en,gasto_id').lt('fecha', b).order('fecha').range(i, j)
      );
      return conCola('movs_inventario', filas.map(aMovInv), aMovInv, (m) => m.fecha < b);
    },
    async registrarMovInventario(m) {
      await enviar({ op: 'upsert', tabla: 'movs_inventario', fila: filaMovInv(m) });
    },
    async borrarMovInventario(id) {
      await borrar('movs_inventario', id);
    },

    async movsDinero(hasta) {
      const b = fechaISO(hasta);
      const filas = await todas((i, j) => sb.from('movs_dinero').select('id,tipo,monto,cuenta,deuda_id,fecha,creado_en').lt('fecha', b).order('fecha').range(i, j));
      return conCola('movs_dinero', filas.map(aMovDin), aMovDin, (m) => m.fecha < b);
    },
    async registrarMovDinero(m) {
      await enviar({ op: 'upsert', tabla: 'movs_dinero', fila: filaMovDin(m) });
    },
    async borrarMovDinero(id) {
      await borrar('movs_dinero', id);
    }
  };
}
