import { useEffect, useState } from 'react';
import { almacen } from '../data/almacen';
import { dinero } from '../lib/dinero';
import { rangoDe } from '../lib/fechas';
import { Icono } from '../componentes/Icono';
import type { Pantalla } from '../App';

export function Inicio({ ir }: { ir: (p: Pantalla) => void }) {
  const [nombre, setNombre] = useState('');
  const [hoy, setHoy] = useState<{ ventas: number; num: number; gastos: number } | null>(null);
  const a = almacen();

  useEffect(() => {
    let vivo = true;
    const r = rangoDe('hoy');
    Promise.all([a.nombreNegocio(), a.ventasEntre(r.desde, r.hasta), a.gastosEntre(r.desde, r.hasta)])
      .then(([n, v, g]) => {
        if (!vivo) return;
        setNombre(n);
        setHoy({ ventas: v.reduce((s, x) => s + x.total, 0), num: v.length, gastos: g.reduce((s, x) => s + x.total, 0) });
      })
      .catch(() => vivo && setHoy({ ventas: 0, num: 0, gastos: 0 }));
    return () => {
      vivo = false;
    };
  }, [a]);

  return (
    <main className="pantalla inicio">
      <div className="inicio-arriba">
        <div>
          <div className="saludo">Hoy</div>
          <div className="negocio">{nombre || ' '}</div>
        </div>
        <button type="button" className="btn-icono" onClick={() => ir('productos')} aria-label="Mis productos y ajustes">
          <Icono nombre="ajustes" tam={26} />
        </button>
      </div>

      {a.modo === 'demo' && <div className="aviso-demo">Modo demo: los datos se guardan solo en este celular</div>}

      <section className="tarjeta-hoy" aria-label="Resumen de hoy">
        <div className="tarjeta-hoy-fila">
          <div>
            <div className="etiqueta">Vendido hoy</div>
            <div className="cifra-grande">{hoy ? dinero(hoy.ventas) : '…'}</div>
          </div>
          <div className="derecha">
            <div className="etiqueta">Gastado hoy</div>
            <div className="cifra-media">{hoy ? dinero(hoy.gastos) : '…'}</div>
          </div>
        </div>
        <div className="detalle">{hoy ? (hoy.num === 1 ? '1 venta cobrada' : `${hoy.num} ventas cobradas`) : ' '}</div>
      </section>

      <button type="button" className="boton-grande principal" onClick={() => ir('vender')}>
        <Icono nombre="vender" tam={52} grosor={1.8} />
        <span className="boton-grande-texto">Vender</span>
      </button>
      <button type="button" className="boton-grande" onClick={() => ir('foto')}>
        <span className="icono-acento">
          <Icono nombre="camara" tam={52} grosor={1.8} />
        </span>
        <span className="boton-grande-pila">
          <span className="boton-grande-texto">Foto al ticket</span>
          <span className="boton-grande-sub">Registra lo que compraste</span>
        </span>
      </button>
      <button type="button" className="boton-grande" onClick={() => ir('inventario')}>
        <span className="icono-acento">
          <Icono nombre="caja" tam={52} grosor={1.8} />
        </span>
        <span className="boton-grande-pila">
          <span className="boton-grande-texto">Inventario</span>
          <span className="boton-grande-sub">Saca lo que usaste hoy</span>
        </span>
      </button>
      <button type="button" className="boton-grande" onClick={() => ir('reporte')}>
        <span className="icono-acento">
          <Icono nombre="microfono" tam={52} grosor={1.8} />
        </span>
        <span className="boton-grande-pila">
          <span className="boton-grande-texto">¿Cómo me fue?</span>
          <span className="boton-grande-sub">Pregunta y escucha tu semana</span>
        </span>
      </button>
    </main>
  );
}
