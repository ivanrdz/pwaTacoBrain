// La cola sin internet es por usuario: otra cuenta en el mismo celular nunca ve ni sube
// los pendientes de la anterior, y al cerrar sesión se borra todo.
import { beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearAlmacenNube } from './almacenNube';
import type { Venta } from './tipos';

class MemoriaLocal {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  keys() {
    return [...this.m.keys()];
  }
}

let memoria: MemoriaLocal;
let avisarSesion: (evento: string, sesion: { user: { id: string } } | null) => void = () => undefined;
let cerradas = 0;

function sbFalso(): SupabaseClient {
  const consulta = {
    select: () => consulta,
    gte: () => consulta,
    lt: () => consulta,
    order: () => consulta,
    range: () => Promise.resolve({ data: [], error: null })
  };
  return {
    from: () => consulta,
    auth: {
      onAuthStateChange: (cb: typeof avisarSesion) => {
        avisarSesion = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: async () => {
        cerradas++;
        return { error: null };
      },
      getSession: async () => ({ data: { session: null } })
    }
  } as unknown as SupabaseClient;
}

const venta: Venta = { id: 'v1', total: 50, items: [], creadaEn: new Date().toISOString(), metodo: 'efectivo', canal: 'mostrador', comision: 0 };

beforeEach(() => {
  memoria = new MemoriaLocal();
  Object.defineProperty(globalThis, 'localStorage', { value: memoria, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: { addEventListener() {} }, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  cerradas = 0;
});

describe('cola sin internet', () => {
  it('no se mezcla entre cuentas y se borra al cerrar sesión', async () => {
    const a = crearAlmacenNube(sbFalso());
    avisarSesion('SIGNED_IN', { user: { id: 'taqueria-A' } });
    await a.registrarVenta(venta);
    expect(a.pendientes()).toBe(1);

    // Entra otra cuenta en el mismo celular
    avisarSesion('SIGNED_IN', { user: { id: 'taqueria-B' } });
    expect(a.pendientes()).toBe(0);
    expect(await a.ventasEntre(new Date(2000, 0, 1), new Date(2100, 0, 1))).toEqual([]);

    // La primera cuenta sigue teniendo lo suyo
    avisarSesion('SIGNED_IN', { user: { id: 'taqueria-A' } });
    expect(a.pendientes()).toBe(1);
    expect((await a.ventasEntre(new Date(2000, 0, 1), new Date(2100, 0, 1))).map((v) => v.id)).toEqual(['v1']);

    await a.cerrarSesion();
    expect(cerradas).toBe(1);
    expect(memoria.keys().filter((k) => k.startsWith('tb:'))).toEqual([]);
  });

  it('sin sesión no guarda nada', async () => {
    const a = crearAlmacenNube(sbFalso());
    avisarSesion('SIGNED_OUT', null);
    await expect(a.registrarVenta(venta)).rejects.toThrow('sin-sesion');
    expect(memoria.keys()).toEqual([]);
  });
});
