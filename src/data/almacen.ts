import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { crearAlmacenLocal } from './almacenLocal';
import { crearAlmacenNube } from './almacenNube';
import type { Almacen } from './tipos';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null = modo demo (sin Supabase configurado) */
export const supabase: SupabaseClient | null = url && llave ? createClient(url, llave, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

let instancia: Almacen | null = null;

export function almacen(): Almacen {
  if (!instancia) instancia = supabase ? crearAlmacenNube(supabase) : crearAlmacenLocal();
  return instancia;
}
