import { useCallback, useEffect, useState } from 'react';
import { almacen } from '../data/almacen';
import { CONFIG_INICIAL, type Comisiones, type ConfigFinanzas, type Cuenta, type MovDinero } from '../data/tipos';
import { dinero } from '../lib/dinero';
import { fechaBonita, fechaISO } from '../lib/fechas';
import { nuevoId } from '../lib/id';
import { Encabezado } from '../componentes/Encabezado';
import { Icono } from '../componentes/Icono';
import { TecladoNumerico, type FormatoTeclado } from '../componentes/TecladoNumerico';

const COMISIONES: { clave: keyof Comisiones; texto: string }[] = [
  { clave: 'tarjeta', texto: 'Tarjeta (terminal)' },
  { clave: 'transferencia', texto: 'Transferencia' },
  { clave: 'rappi', texto: 'Rappi' },
  { clave: 'uber', texto: 'Uber Eats' },
  { clave: 'didi', texto: 'DiDi Food' }
];

interface Teclado {
  titulo: string;
  formato: FormatoTeclado;
  valor: number | null;
  permitirCero?: boolean;
  listo: (n: number) => void;
}

interface Salida {
  tipo: MovDinero['tipo'];
  monto: number;
  deudaId?: string;
}

/** Datos que no salen de las ventas ni de los tickets: comisiones, con cuánto se empezó, equipo, deudas y retiros. */
export function Dinero({ regresar }: { regresar: () => void }) {
  const a = almacen();
  const [config, setConfig] = useState<ConfigFinanzas>(CONFIG_INICIAL);
  const [movs, setMovs] = useState<MovDinero[]>([]);
  const [teclado, setTeclado] = useState<Teclado | null>(null);
  const [salida, setSalida] = useState<Salida | null>(null);
  const [nuevo, setNuevo] = useState<{ tipo: 'equipo' | 'deuda'; nombre: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const hoy = new Date();
    const [c, m] = await Promise.all([a.config(), a.movsDinero(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1))]);
    setConfig(c);
    setMovs(m.sort((x, y) => y.creadoEn.localeCompare(x.creadoEn)));
  }, [a]);

  useEffect(() => {
    recargar().catch(() => setAviso('No pude cargar tus datos. Revisa el internet.'));
  }, [recargar]);

  async function guardar(c: ConfigFinanzas, mensaje = 'Guardado') {
    setConfig(c);
    try {
      await a.guardarConfig(c);
      setAviso(mensaje);
    } catch {
      setAviso('No se pudo guardar. Revisa el internet.');
    }
  }

  async function registrarSalida(cuenta: Cuenta) {
    if (!salida) return;
    const m: MovDinero = { id: nuevoId(), tipo: salida.tipo, monto: salida.monto, cuenta, deudaId: salida.deudaId ?? null, fecha: fechaISO(new Date()), creadoEn: new Date().toISOString() };
    setSalida(null);
    try {
      await a.registrarMovDinero(m);
      setAviso(salida.tipo === 'retiro' ? `Anotado: sacaste ${dinero(m.monto)} para ti` : `Abono de ${dinero(m.monto)} anotado`);
      await recargar();
    } catch {
      setAviso('No se pudo guardar. Intenta otra vez.');
    }
  }

  async function deshacer(m: MovDinero) {
    await a.borrarMovDinero(m.id);
    await recargar();
    setAviso('Se quitó el movimiento');
  }

  const abonado = (deudaId: string) => movs.filter((m) => m.tipo === 'abono' && m.deudaId === deudaId).reduce((s, m) => s + m.monto, 0);
  const nombreDeuda = (id?: string | null) => config.deudas.find((d) => d.id === id)?.nombre ?? 'deuda';

  return (
    <main className="pantalla dinero">
      <Encabezado titulo="Caja y cuentas" onRegresar={regresar} />

      {aviso && (
        <div className="aviso aviso-ok" aria-live="polite">
          <Icono nombre="palomita" tam={22} grosor={2.6} />
          <span>{aviso}</span>
        </div>
      )}

      <button
        type="button"
        className="boton-grande"
        onClick={() => setTeclado({ titulo: '¿Cuánto sacaste para ti?', formato: 'dinero', valor: null, listo: (n) => setSalida({ tipo: 'retiro', monto: n }) })}
      >
        <span className="icono-acento">
          <Icono nombre="persona" tam={44} grosor={1.8} />
        </span>
        <span className="boton-grande-pila">
          <span className="boton-grande-texto">Saqué dinero para mí</span>
          <span className="boton-grande-sub">No es gasto del negocio; se resta de tu capital</span>
        </span>
      </button>

      <section className="seccion">
        <div className="seccion-titulo">Con cuánto empezaste</div>
        <p className="seccion-texto">El dinero que había el día que empezaste a usar la app.</p>
        <button type="button" className="fila-dato" onClick={() => setTeclado({ titulo: 'Efectivo en caja al empezar', formato: 'dinero', valor: config.cajaInicial || null, permitirCero: true, listo: (n) => guardar({ ...config, cajaInicial: n }) })}>
          <span>Efectivo en caja</span>
          <span className="fila-dato-valor">{dinero(config.cajaInicial)}</span>
        </button>
        <button type="button" className="fila-dato" onClick={() => setTeclado({ titulo: 'Dinero en el banco al empezar', formato: 'dinero', valor: config.bancoInicial || null, permitirCero: true, listo: (n) => guardar({ ...config, bancoInicial: n }) })}>
          <span>Dinero en el banco</span>
          <span className="fila-dato-valor">{dinero(config.bancoInicial)}</span>
        </button>
      </section>

      <section className="seccion">
        <div className="seccion-titulo">Tu equipo</div>
        <p className="seccion-texto">Plancha, trompo, refri, mesas… con lo que vale hoy.</p>
        {config.equipo.map((e) => (
          <div key={e.id} className="fila-dato">
            <span>{e.nombre}</span>
            <span className="fila-dato-valor">{dinero(e.valor)}</span>
            <button type="button" className="btn-icono-chico" aria-label={`Quitar ${e.nombre}`} onClick={() => confirm(`¿Quitar "${e.nombre}"?`) && guardar({ ...config, equipo: config.equipo.filter((x) => x.id !== e.id) }, 'Se quitó')}>
              <Icono nombre="basura" tam={20} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-claro" onClick={() => setNuevo({ tipo: 'equipo', nombre: '' })}>
          <Icono nombre="mas" tam={24} grosor={2.6} />
          Agregar equipo
        </button>
      </section>

      <section className="seccion">
        <div className="seccion-titulo">Lo que debes</div>
        <p className="seccion-texto">Préstamos o lo que le quedaste a deber a un proveedor.</p>
        {config.deudas.map((d) => {
          const saldo = d.saldoInicial - abonado(d.id);
          return (
            <div key={d.id} className="fila-deuda">
              <div className="fila-deuda-info">
                <span className="fila-deuda-nombre">{d.nombre}</span>
                <span className="fila-deuda-saldo">Debes {dinero(saldo)}</span>
              </div>
              <button
                type="button"
                className="btn btn-acento btn-sacar"
                disabled={saldo <= 0}
                onClick={() => setTeclado({ titulo: `¿Cuánto le abonaste a ${d.nombre}?`, formato: 'dinero', valor: null, listo: (n) => setSalida({ tipo: 'abono', monto: Math.min(n, saldo), deudaId: d.id }) })}
              >
                Abonar
              </button>
              <button
                type="button"
                className="btn-icono-chico"
                aria-label={`Quitar ${d.nombre}`}
                onClick={() => confirm(`¿Quitar la deuda con "${d.nombre}"?`) && guardar({ ...config, deudas: config.deudas.filter((x) => x.id !== d.id) }, 'Se quitó')}
              >
                <Icono nombre="basura" tam={20} />
              </button>
            </div>
          );
        })}
        <button type="button" className="btn btn-claro" onClick={() => setNuevo({ tipo: 'deuda', nombre: '' })}>
          <Icono nombre="mas" tam={24} grosor={2.6} />
          Agregar deuda
        </button>
      </section>

      <section className="seccion">
        <div className="seccion-titulo">Comisiones</div>
        <p className="seccion-texto">El porcentaje que se queda el banco o la app de cada venta. Revisa tu contrato y ajústalo.</p>
        {COMISIONES.map(({ clave, texto }) => (
          <button
            key={clave}
            type="button"
            className="fila-dato"
            onClick={() =>
              setTeclado({
                titulo: `Comisión de ${texto}`,
                formato: 'porcentaje',
                valor: config.comisiones[clave] || null,
                permitirCero: true,
                listo: (n) => guardar({ ...config, comisiones: { ...config.comisiones, [clave]: n } })
              })
            }
          >
            <span>{texto}</span>
            <span className="fila-dato-valor">{config.comisiones[clave]} %</span>
          </button>
        ))}
      </section>

      {movs.length > 0 && (
        <section className="seccion seccion-extra">
          <div className="seccion-titulo">Últimos retiros y abonos</div>
          {movs.slice(0, 10).map((m) => (
            <div key={m.id} className="fila-baja">
              <span>
                {fechaBonita(m.fecha)} · {m.tipo === 'retiro' ? 'Para ti' : `Abono a ${nombreDeuda(m.deudaId)}`} · {dinero(m.monto)}
              </span>
              <button type="button" className="btn-texto" onClick={() => deshacer(m)}>
                Quitar
              </button>
            </div>
          ))}
        </section>
      )}

      {teclado && (
        <TecladoNumerico
          titulo={teclado.titulo}
          formato={teclado.formato}
          valorInicial={teclado.valor}
          permitirCero={teclado.permitirCero}
          onCancelar={() => setTeclado(null)}
          onListo={(n) => {
            const t = teclado;
            setTeclado(null);
            t.listo(n);
          }}
        />
      )}

      {salida && (
        <div className="teclado-fondo" role="dialog" aria-modal="true" aria-label="¿De dónde salió el dinero?">
          <div className="teclado">
            <div className="teclado-titulo">¿De dónde salieron los {dinero(salida.monto)}?</div>
            <button type="button" className="metodo metodo-principal" onClick={() => registrarSalida('efectivo')}>
              <Icono nombre="billete" tam={34} />
              De la caja
            </button>
            <button type="button" className="metodo" onClick={() => registrarSalida('banco')}>
              <Icono nombre="banco" tam={30} />
              Del banco
            </button>
            <button type="button" className="btn btn-claro" onClick={() => setSalida(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {nuevo && (
        <div className="teclado-fondo" role="dialog" aria-modal="true" aria-label={nuevo.tipo === 'equipo' ? 'Agregar equipo' : 'Agregar deuda'}>
          <div className="teclado">
            <label className="campo">
              <span className="campo-etiqueta">{nuevo.tipo === 'equipo' ? '¿Qué equipo?' : '¿A quién le debes?'}</span>
              <input className="campo-input" autoFocus value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder={nuevo.tipo === 'equipo' ? 'Ej. Plancha' : 'Ej. Carnicería El Norte'} />
            </label>
            <div className="teclado-acciones">
              <button type="button" className="btn btn-claro" onClick={() => setNuevo(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-verde"
                disabled={!nuevo.nombre.trim()}
                onClick={() => {
                  const n = nuevo;
                  setNuevo(null);
                  setTeclado({
                    titulo: n.tipo === 'equipo' ? `¿Cuánto vale ${n.nombre.trim()}?` : `¿Cuánto le debes a ${n.nombre.trim()}?`,
                    formato: 'dinero',
                    valor: null,
                    listo: (monto) =>
                      n.tipo === 'equipo'
                        ? guardar({ ...config, equipo: [...config.equipo, { id: nuevoId(), nombre: n.nombre.trim(), valor: monto }] })
                        : guardar({ ...config, deudas: [...config.deudas, { id: nuevoId(), nombre: n.nombre.trim(), saldoInicial: monto }] })
                  });
                }}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
