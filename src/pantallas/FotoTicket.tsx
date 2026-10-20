import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { almacen } from '../data/almacen';
import { dinero } from '../lib/dinero';
import { fechaBonita, fechaISO } from '../lib/fechas';
import { nuevoId } from '../lib/id';
import { comprimirFoto } from '../lib/imagen';
import { Encabezado } from '../componentes/Encabezado';
import { Icono } from '../componentes/Icono';
import { TecladoNumerico } from '../componentes/TecladoNumerico';

type Paso = 'listo' | 'leyendo' | 'confirmar' | 'guardado';

export function FotoTicket({ regresar }: { regresar: () => void }) {
  const a = almacen();
  const entrada = useRef<HTMLInputElement>(null);
  const [paso, setPaso] = useState<Paso>('listo');
  const [foto, setFoto] = useState<Blob | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [proveedor, setProveedor] = useState('');
  const [fecha, setFecha] = useState(fechaISO(new Date()));
  const [total, setTotal] = useState<number | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [teclado, setTeclado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [gastadoHoy, setGastadoHoy] = useState<number | null>(null);

  useEffect(() => () => {
    if (vista) URL.revokeObjectURL(vista);
  }, [vista]);

  function abrirCamara() {
    entrada.current?.click();
  }

  async function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setFoto(archivo);
    setVista(URL.createObjectURL(archivo));
    setProblema(null);
    setPaso('leyendo');
    try {
      const r = await a.leerTicket(archivo);
      setProveedor(r.proveedor ?? '');
      setFecha(r.fecha ?? fechaISO(new Date()));
      setTotal(r.total);
      if (!r.total) setProblema('No pude leer el total. Escríbelo tú.');
    } catch (e) {
      setProveedor('');
      setFecha(fechaISO(new Date()));
      setTotal(null);
      if ((e as Error)?.message === 'sin-lector') setProblema('En esta demo escribe el total. En la versión final se lee solo de la foto.');
      else setProblema(navigator.onLine ? 'No pude leer el ticket. Escribe el total.' : 'Sin internet. Escribe el total y se guarda igual.');
      setTeclado(true);
    }
    setPaso('confirmar');
  }

  async function guardar() {
    if (!total || guardando) return;
    setGuardando(true);
    try {
      const comprimida = foto && a.modo === 'nube' && navigator.onLine ? await comprimirFoto(foto) : undefined;
      await a.registrarGasto({ id: nuevoId(), proveedor: proveedor.trim(), fecha, total, creadoEn: new Date().toISOString() }, comprimida);
      const hoy = new Date();
      const gastos = await a.gastosEntre(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()), new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1));
      setGastadoHoy(gastos.reduce((s, g) => s + g.total, 0));
      navigator.vibrate?.(60);
      setPaso('guardado');
    } catch {
      setProblema('No se pudo guardar. Intenta otra vez.');
    } finally {
      setGuardando(false);
    }
  }

  function otraFoto() {
    setPaso('listo');
    setFoto(null);
    setVista(null);
    setTotal(null);
    setProveedor('');
    setProblema(null);
  }

  return (
    <main className="pantalla foto">
      <Encabezado titulo="Foto al ticket" onRegresar={regresar} />
      <input ref={entrada} type="file" accept="image/*" capture="environment" hidden onChange={alElegir} />

      {paso === 'listo' && (
        <button type="button" className="zona-foto" onClick={abrirCamara}>
          <span className="circulo-camara">
            <Icono nombre="camara" tam={64} grosor={1.8} />
          </span>
          <span className="zona-foto-titulo">Tomar foto</span>
          <span className="zona-foto-sub">Pon el ticket sobre la mesa y toca el botón</span>
        </button>
      )}

      {paso === 'leyendo' && (
        <div className="zona-leyendo">
          {vista && <img src={vista} alt="Foto del ticket" className="miniatura" />}
          <div className="girando" aria-hidden="true" />
          <div className="zona-foto-titulo">Leyendo el ticket…</div>
        </div>
      )}

      {paso === 'confirmar' && (
        <div className="confirmar">
          <div className="confirmar-pregunta">{problema ?? '¿Está bien lo que leí?'}</div>
          <div className="ficha">
            <label className="ficha-fila">
              <span className="ficha-etiqueta">Proveedor</span>
              <input className="ficha-input" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="¿A quién le compraste?" />
            </label>
            <label className="ficha-fila">
              <span className="ficha-etiqueta">Fecha</span>
              <span className="ficha-fecha">
                <span>{fechaBonita(fecha)}</span>
                <input type="date" className="ficha-fecha-input" value={fecha} max={fechaISO(new Date())} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Cambiar fecha" />
              </span>
            </label>
            <div className="ficha-fila">
              <span className="ficha-etiqueta">Total</span>
              <button type="button" className="ficha-total" onClick={() => setTeclado(true)}>
                {total ? dinero(total) : 'Escribir'}
                <Icono nombre="lapiz" tam={22} />
              </button>
            </div>
          </div>
          {vista && <img src={vista} alt="Foto del ticket" className="miniatura-confirmar" />}
          <div className="relleno" />
          <button type="button" className="btn btn-verde btn-alto" onClick={guardar} disabled={!total || guardando}>
            <Icono nombre="palomita" tam={30} grosor={2.6} />
            {guardando ? 'Guardando…' : 'Sí, guardar'}
          </button>
          <button type="button" className="btn btn-claro" onClick={otraFoto}>
            No, tomar otra foto
          </button>
        </div>
      )}

      {paso === 'guardado' && (
        <div className="guardado">
          <span className="circulo-ok">
            <Icono nombre="palomita" tam={64} grosor={2.6} />
          </span>
          <div className="zona-foto-titulo">Gasto guardado</div>
          {gastadoHoy !== null && <div className="guardado-sub">Gastos de hoy: {dinero(gastadoHoy)}</div>}
          <button type="button" className="btn btn-acento btn-ancho" onClick={otraFoto}>
            Otra foto
          </button>
          <button type="button" className="btn btn-claro btn-ancho" onClick={regresar}>
            Ir al inicio
          </button>
        </div>
      )}

      {teclado && (
        <TecladoNumerico
          titulo="Total del ticket"
          valorInicial={total}
          onCancelar={() => setTeclado(false)}
          onListo={(n) => {
            setTotal(n);
            setProblema(null);
            setTeclado(false);
          }}
        />
      )}
    </main>
  );
}
