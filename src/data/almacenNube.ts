// MODO NUBE: datos en Supabase, separados por taquería (cada cuenta ve solo lo suyo, por RLS).
// Si se cae el internet, las ventas y gastos se guardan en una cola en el celular
// y se suben solos cuando regresa la señal.
import type { SupabaseClient } from '@supabase/supabase-js';
import { aBase64, comprimirFoto } from '../lib/imagen';
import { fechaISO } from '../lib/fechas';
import type { Almacen, Gasto, LecturaTicket, Producto, Venta } from './tipos';

type Pendiente =
  | { tipo: 'venta'; venta: Venta }
  | { tipo: 'borrar-venta'; id: string }
  | { tipo: 'gasto'; gasto: Gasto };

const COLA = 'tb:cola';

function leerCola(): Pendiente[] {
  try {
    return JSON.parse(localStorage.getItem(COLA) ?? '[]') as Pendiente[];
  } catch {
    return [];
  }
}

function guardarCola(cola: Pendiente[]): void {
  try {
    localStorage.setItem(COLA, JSON.stringify(cola));
  } catch {
    /* sin espacio */
  }
}

interface FilaVenta {
  id: string;
  total: number | string;
  items: Venta['items'];
  creada_en: string;
}
interface FilaGasto {
  id: string;
  proveedor: string | null;
  fecha: string;
  total: number | string;
  creado_en: string;
}

const aVenta = (f: FilaVenta): Venta => ({ id: f.id, total: Number(f.total), items: f.items, creadaEn: f.creada_en });
const aGasto = (f: FilaGasto): Gasto => ({ id: f.id, proveedor: f.proveedor ?? '', fecha: f.fecha, total: Number(f.total), creadoEn: f.creado_en });

export function crearAlmacenNube(sb: SupabaseClient): Almacen & { pendientes(): number } {
  let subiendo = false;

  async function subirVenta(v: Venta) {
    const { error } = await sb
      .from('ventas')
      .upsert({ id: v.id, total: v.total, items: v.items, creada_en: v.creadaEn }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }

  async function subirGasto(g: Gasto, fotoPath: string | null) {
    const { error } = await sb
      .from('gastos')
      .upsert({ id: g.id, proveedor: g.proveedor, fecha: g.fecha, total: g.total, creado_en: g.creadoEn, foto_path: fotoPath }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }

  async function vaciarCola() {
    if (subiendo || !navigator.onLine) return;
    subiendo = true;
    try {
      let cola = leerCola();
      while (cola.length) {
        const p = cola[0];
        if (p.tipo === 'venta') await subirVenta(p.venta);
        else if (p.tipo === 'gasto') await subirGasto(p.gasto, null);
        else {
          const { error } = await sb.from('ventas').delete().eq('id', p.id);
          if (error) throw error;
        }
        cola = leerCola().slice(1);
        guardarCola(cola);
      }
    } catch {
      // se reintenta en el siguiente evento "online" o al abrir la app
    } finally {
      subiendo = false;
    }
  }

  async function intentarOEncolar(accion: () => Promise<void>, pendiente: Pendiente) {
    if (navigator.onLine) {
      try {
        await accion();
        void vaciarCola();
        return;
      } catch (e) {
        const msg = String((e as { message?: string })?.message ?? e);
        // Errores de permisos/datos no se encolan: se muestran.
        if (!/fetch|network|Failed|timeout/i.test(msg)) throw e;
      }
    }
    guardarCola([...leerCola(), pendiente]);
  }

  /** PostgREST regresa máximo 1000 filas por llamada: pedimos por páginas. */
  async function todas<T>(pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    const tam = 1000;
    const salida: T[] = [];
    for (let i = 0; ; i += tam) {
      const { data, error } = await pedir(i, i + tam - 1);
      if (error) throw error;
      salida.push(...(data ?? []));
      if (!data || data.length < tam) return salida;
    }
  }

  window.addEventListener('online', () => void vaciarCola());
  sb.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION') void vaciarCola();
  });

  return {
    modo: 'nube',

    pendientes: () => leerCola().length,

    async nombreNegocio() {
      const { data } = await sb.from('negocios').select('nombre').maybeSingle();
      return data?.nombre ?? 'Mi taquería';
    },
    async guardarNombreNegocio(nombre) {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return;
      const { error } = await sb.from('negocios').upsert({ owner_id: u.user.id, nombre }, { onConflict: 'owner_id' });
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
      await intentarOEncolar(() => subirVenta(v), { tipo: 'venta', venta: v });
    },
    async borrarVenta(id) {
      const cola = leerCola();
      const sinSubir = cola.filter((p) => !(p.tipo === 'venta' && p.venta.id === id));
      if (sinSubir.length !== cola.length) {
        guardarCola(sinSubir);
        return;
      }
      await intentarOEncolar(
        async () => {
          const { error } = await sb.from('ventas').delete().eq('id', id);
          if (error) throw error;
        },
        { tipo: 'borrar-venta', id }
      );
    },

    async registrarGasto(g, foto) {
      await intentarOEncolar(async () => {
        let fotoPath: string | null = null;
        if (foto) {
          const { data: u } = await sb.auth.getUser();
          if (u.user) {
            const ruta = `${u.user.id}/${g.id}.jpg`;
            const { error } = await sb.storage.from('tickets').upload(ruta, foto, { contentType: 'image/jpeg', upsert: true });
            if (!error) fotoPath = ruta;
          }
        }
        await subirGasto(g, fotoPath);
      }, { tipo: 'gasto', gasto: g });
    },

    async ventasEntre(desde, hasta) {
      const filas = await todas<FilaVenta>((a, b) =>
        sb.from('ventas').select('id,total,items,creada_en').gte('creada_en', desde.toISOString()).lt('creada_en', hasta.toISOString()).order('creada_en').range(a, b)
      );
      const ventas = filas.map(aVenta);
      const cola = leerCola();
      const borradas = new Set(cola.flatMap((p) => (p.tipo === 'borrar-venta' ? [p.id] : [])));
      const ids = new Set(ventas.map((v) => v.id));
      for (const p of cola) {
        if (p.tipo !== 'venta' || ids.has(p.venta.id)) continue;
        const t = new Date(p.venta.creadaEn).getTime();
        if (t >= desde.getTime() && t < hasta.getTime()) ventas.push(p.venta);
      }
      return ventas.filter((v) => !borradas.has(v.id));
    },
    async gastosEntre(desde, hasta) {
      const a = fechaISO(desde);
      const b = fechaISO(hasta);
      const filas = await todas<FilaGasto>((i, j) =>
        sb.from('gastos').select('id,proveedor,fecha,total,creado_en').gte('fecha', a).lt('fecha', b).order('fecha').range(i, j)
      );
      const gastos = filas.map(aGasto);
      const ids = new Set(gastos.map((g) => g.id));
      for (const p of leerCola()) {
        if (p.tipo === 'gasto' && !ids.has(p.gasto.id) && p.gasto.fecha >= a && p.gasto.fecha < b) gastos.push(p.gasto);
      }
      return gastos;
    },

    async leerTicket(foto): Promise<LecturaTicket> {
      const comprimida = await comprimirFoto(foto);
      const { data, error } = await sb.functions.invoke<LecturaTicket>('leer-ticket', {
        body: { imagen: await aBase64(comprimida), tipo: 'image/jpeg' }
      });
      if (error || !data) throw error ?? new Error('sin-respuesta');
      return data;
    }
  };
}
