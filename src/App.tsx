import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './data/almacen';
import { Inicio } from './pantallas/Inicio';
import { Vender } from './pantallas/Vender';
import { FotoTicket } from './pantallas/FotoTicket';
import { Reporte } from './pantallas/Reporte';
import { Productos } from './pantallas/Productos';
import { Entrar } from './pantallas/Entrar';

export type Pantalla = 'inicio' | 'vender' | 'foto' | 'reporte' | 'productos';

export function App() {
  const [pantalla, setPantalla] = useState<Pantalla>('inicio');
  const [sesion, setSesion] = useState<Session | null | 'cargando'>(supabase ? 'cargando' : null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // El botón "atrás" de Android regresa al inicio en lugar de cerrar la app.
  useEffect(() => {
    const alRegresar = () => setPantalla('inicio');
    window.addEventListener('popstate', alRegresar);
    return () => window.removeEventListener('popstate', alRegresar);
  }, []);

  const ir = useCallback((p: Pantalla) => {
    if (p !== 'inicio') history.pushState({ p }, '');
    setPantalla(p);
    window.scrollTo(0, 0);
  }, []);

  const regresar = useCallback(() => {
    if (history.state?.p) history.back();
    else setPantalla('inicio');
  }, []);

  if (supabase && sesion === 'cargando') return <main className="pantalla cargando-app">TacoBrain</main>;
  if (supabase && !sesion) return <Entrar sb={supabase} />;

  switch (pantalla) {
    case 'vender':
      return <Vender regresar={regresar} ir={ir} />;
    case 'foto':
      return <FotoTicket regresar={regresar} />;
    case 'reporte':
      return <Reporte regresar={regresar} />;
    case 'productos':
      return <Productos regresar={regresar} />;
    default:
      return <Inicio ir={ir} />;
  }
}
