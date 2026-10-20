import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Se pide una sola vez: la sesión queda guardada en el celular.
 * No hay registro abierto: las cuentas de cada taquería las crea el administrador
 * en Supabase (Authentication → Users → Add user), para que nadie más use la app ni la IA.
 */
export function Entrar({ sb }: { sb: SupabaseClient }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = await sb.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEnviando(false);
    // Mismo mensaje para correo inexistente y contraseña mala: no se revela qué cuentas existen.
    if (error) setError(error.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : 'Correo o contraseña incorrectos.');
  }

  return (
    <main className="pantalla entrar">
      <div className="entrar-marca">TacoBrain</div>
      <p className="entrar-sub">Entra a tu taquería</p>
      <form className="entrar-form" onSubmit={enviar}>
        <label className="campo">
          <span className="campo-etiqueta">Correo</span>
          <input className="campo-input" type="email" autoComplete="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Contraseña</span>
          <input className="campo-input" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
        </label>
        {error && <div className="aviso aviso-error">{error}</div>}
        <button type="submit" className="btn btn-acento btn-alto" disabled={enviando}>
          {enviando ? 'Un momento…' : 'Entrar'}
        </button>
      </form>
      <p className="seccion-texto">¿No tienes cuenta o se te olvidó la contraseña? Pídesela a quien te instaló la app.</p>
    </main>
  );
}
