import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Se pide una sola vez: la sesión queda guardada en el celular. */
export function Entrar({ sb }: { sb: SupabaseClient }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [crear, setCrear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = crear ? await sb.auth.signUp({ email: correo.trim(), password: clave }) : await sb.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEnviando(false);
    if (error) setError(crear ? 'No se pudo crear la cuenta. Revisa el correo y usa una contraseña de 6 letras o más.' : 'Correo o contraseña incorrectos.');
  }

  return (
    <main className="pantalla entrar">
      <div className="entrar-marca">TacoBrain</div>
      <p className="entrar-sub">{crear ? 'Crea la cuenta de tu taquería' : 'Entra a tu taquería'}</p>
      <form className="entrar-form" onSubmit={enviar}>
        <label className="campo">
          <span className="campo-etiqueta">Correo</span>
          <input className="campo-input" type="email" autoComplete="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Contraseña</span>
          <input className="campo-input" type="password" autoComplete={crear ? 'new-password' : 'current-password'} value={clave} onChange={(e) => setClave(e.target.value)} required minLength={6} />
        </label>
        {error && <div className="aviso aviso-error">{error}</div>}
        <button type="submit" className="btn btn-acento btn-alto" disabled={enviando}>
          {enviando ? 'Un momento…' : crear ? 'Crear cuenta' : 'Entrar'}
        </button>
      </form>
      <button type="button" className="btn-texto" onClick={() => setCrear(!crear)}>
        {crear ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
      </button>
    </main>
  );
}
