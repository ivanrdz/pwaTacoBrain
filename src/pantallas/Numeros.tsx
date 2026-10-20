import { useEffect, useState, type ReactNode } from 'react';
import { almacen } from '../data/almacen';
import { calcularNumeros, type Numeros as DatosNumeros } from '../data/operaciones';
import { NOMBRE_CANAL } from '../data/tipos';
import { dinero } from '../lib/dinero';
import { rangoDe, type Periodo } from '../lib/fechas';
import { CATEGORIAS_OPERACION } from '../lib/finanzas';
import { NOMBRE_CATEGORIA } from '../data/tipos';
import { Encabezado } from '../componentes/Encabezado';
import { Icono } from '../componentes/Icono';

type Vista = 'resultados' | 'balance';

const PERIODOS: { periodo: Periodo; texto: string }[] = [
  { periodo: 'semana', texto: 'Esta semana' },
  { periodo: 'semana-pasada', texto: 'Semana pasada' },
  { periodo: 'mes', texto: 'Este mes' },
  { periodo: 'mes-pasado', texto: 'Mes pasado' }
];

const fechaLarga = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
/** Último día del periodo, o hoy si el periodo todavía no termina */
const ultimoDia = (hasta: Date) => {
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() - 1);
  const hoy = new Date();
  return fin > hoy ? new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) : fin;
};

function Renglon({ titulo, sub, monto, resta, fuerte, sangria }: { titulo: string; sub?: string; monto: number; resta?: boolean; fuerte?: boolean; sangria?: boolean }) {
  return (
    <div className={['renglon-num', fuerte ? 'fuerte' : '', sangria ? 'sangria' : ''].join(' ')}>
      <div className="renglon-num-texto">
        <span className="renglon-num-titulo">{titulo}</span>
        {sub && <span className="renglon-num-sub">{sub}</span>}
      </div>
      <span className={resta && monto !== 0 ? 'renglon-num-monto resta' : 'renglon-num-monto'}>
        {resta && monto !== 0 ? '− ' : ''}
        {dinero(Math.abs(monto))}
      </span>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="bloque-num">
      <h2 className="bloque-num-titulo">{titulo}</h2>
      {children}
    </section>
  );
}

/** Estado de resultados y balance general: explicado sencillo en pantalla y formal en el PDF. */
export function Numeros({ regresar, irDinero }: { regresar: () => void; irDinero: () => void }) {
  const a = almacen();
  const [vista, setVista] = useState<Vista>('resultados');
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [datos, setDatos] = useState<DatosNumeros | null>(null);
  const [negocio, setNegocio] = useState('');
  const [error, setError] = useState(false);
  const [sinConfig, setSinConfig] = useState(false);

  useEffect(() => {
    let vivo = true;
    setDatos(null);
    setError(false);
    Promise.all([calcularNumeros(a, rangoDe(periodo)), a.nombreNegocio(), a.config()])
      .then(([d, n, c]) => {
        if (!vivo) return;
        setDatos(d);
        setNegocio(n);
        setSinConfig(!c.cajaInicial && !c.bancoInicial && !c.equipo.length && !c.deudas.length);
      })
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [a, periodo]);

  const er = datos?.er;
  const b = datos?.balance;
  const nombrePeriodo = datos?.rango.nombre ?? '';
  const faltanBajas = !!er && !!datos && er.costoInventario === 0 && datos.inventario.valorTotal > 0 && er.comprasInsumos > er.costoSinDesglose;

  return (
    <main className="pantalla numeros">
      <div className="solo-pantalla">
        <Encabezado titulo="Mis números" onRegresar={regresar} />

        <div className="segmentos pestanas" role="tablist" aria-label="Reporte">
          <button type="button" role="tab" aria-selected={vista === 'resultados'} className={vista === 'resultados' ? 'segmento elegido' : 'segmento'} onClick={() => setVista('resultados')}>
            Estado de resultados
          </button>
          <button type="button" role="tab" aria-selected={vista === 'balance'} className={vista === 'balance' ? 'segmento elegido' : 'segmento'} onClick={() => setVista('balance')}>
            Balance general
          </button>
        </div>

        <div className="chips" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button key={p.periodo} type="button" className={periodo === p.periodo ? 'chip elegido' : 'chip'} onClick={() => setPeriodo(p.periodo)}>
              {p.texto}
            </button>
          ))}
        </div>

        {error && <div className="aviso aviso-error">No pude sacar tus números. Revisa el internet.</div>}
        {!datos && !error && <div className="cargando">Sacando cuentas…</div>}

        {er && vista === 'resultados' && (
          <>
            <p className="explica">Cuánto ganaste {nombrePeriodo}: lo que vendiste menos lo que te costó.</p>
            {faltanBajas && (
              <div className="aviso aviso-alerta">
                Compraste insumos pero no registraste lo que sacaste del inventario. Sin eso, el costo sale en cero y la ganancia se ve más alta.
              </div>
            )}
            <Bloque titulo="Lo que vendiste">
              <Renglon titulo="Ventas" sub={`${er.numVentas} ${er.numVentas === 1 ? 'venta' : 'ventas'}`} monto={er.ventasBrutas} fuerte />
              {er.porMetodo.efectivo > 0 && <Renglon titulo="En efectivo" monto={er.porMetodo.efectivo} sangria />}
              {er.porMetodo.transferencia > 0 && <Renglon titulo="Por transferencia" monto={er.porMetodo.transferencia} sangria />}
              {er.porMetodo.tarjeta > 0 && <Renglon titulo="Con tarjeta" monto={er.porMetodo.tarjeta} sangria />}
              {(['rappi', 'uber', 'didi'] as const).map((c) => er.porCanal[c] > 0 && <Renglon key={c} titulo={`Por ${NOMBRE_CANAL[c]}`} monto={er.porCanal[c]} sangria />)}
              <Renglon titulo="Comisiones del banco" sub="Lo que cobra la terminal o el banco" monto={er.comisionesBanco} resta />
              <Renglon titulo="Comisiones de apps" sub="Lo que se quedan Rappi, Uber y DiDi" monto={er.comisionesApps} resta />
              <Renglon titulo="Te entró de verdad" monto={er.ventasNetas} fuerte />
            </Bloque>
            <Bloque titulo="Lo que te costó">
              <Renglon titulo="Insumos que usaste" sub="Lo que sacaste del inventario y compras sin desglose" monto={er.costoVentas} resta />
              <Renglon titulo="Ganancia antes de gastos" monto={er.utilidadBruta} fuerte />
              {CATEGORIAS_OPERACION.map((c) => er.gastosOperacion[c] > 0 && <Renglon key={c} titulo={NOMBRE_CATEGORIA[c]} monto={er.gastosOperacion[c]} resta />)}
              {er.totalGastosOperacion === 0 && <Renglon titulo="Renta, gas, luz y sueldos" sub="No registraste" monto={0} resta />}
            </Bloque>
            <div className={er.utilidadNeta >= 0 ? 'cuadro-ganancia' : 'cuadro-ganancia perdida'}>
              <span className="cuadro-etiqueta">{er.utilidadNeta >= 0 ? `Ganancia de ${nombrePeriodo}` : `Pérdida de ${nombrePeriodo}`}</span>
              <span className="cuadro-cifra-grande">{dinero(Math.abs(er.utilidadNeta))}</span>
            </div>
          </>
        )}

        {b && datos && vista === 'balance' && (
          <>
            <p className="explica">Cómo está tu negocio al {fechaLarga(ultimoDia(datos.rango.hasta))}: lo que tienes, lo que debes y lo que es tuyo.</p>
            {sinConfig && (
              <div className="aviso aviso-alerta aviso-con-boton">
                <span>Para que el balance salga completo, anota con cuánto dinero empezaste, tu equipo y tus deudas.</span>
                <button type="button" className="btn btn-acento" onClick={irDinero}>
                  Anotar
                </button>
              </div>
            )}
            <Bloque titulo="Lo que tienes">
              <Renglon titulo="Efectivo en caja" monto={b.caja} />
              <Renglon titulo="Dinero en el banco" sub="Incluye tarjeta, transferencias y apps" monto={b.banco} />
              <Renglon titulo="Inventario" sub="Lo que tienes guardado, a lo que te costó" monto={b.inventario} />
              <Renglon titulo="Equipo" sub="Plancha, refri, trompo..." monto={b.equipo} />
              <Renglon titulo="Total" monto={b.totalActivos} fuerte />
            </Bloque>
            <Bloque titulo="Lo que debes">
              {b.deudas.map((d, i) => (
                <Renglon key={i} titulo={d.nombre} monto={d.saldo} />
              ))}
              {b.deudas.length === 0 && <Renglon titulo="Sin deudas registradas" monto={0} />}
              <Renglon titulo="Total" monto={b.totalPasivos} fuerte />
            </Bloque>
            <Bloque titulo="Lo que es tuyo">
              <Renglon titulo="Lo que pusiste al empezar" monto={b.capitalAportado} />
              <Renglon titulo="Ganancias acumuladas" monto={b.utilidadAcumulada} resta={b.utilidadAcumulada < 0} />
              <Renglon titulo="Lo que sacaste para ti" monto={b.retiros} resta />
              <Renglon titulo="Total" monto={b.totalCapital} fuerte />
            </Bloque>
            <div className={Math.abs(b.diferencia) < 0.01 ? 'cuadra' : 'cuadra no'}>
              <Icono nombre={Math.abs(b.diferencia) < 0.01 ? 'palomita' : 'basura'} tam={22} grosor={2.6} />
              {Math.abs(b.diferencia) < 0.01 ? 'Cuadra: lo que tienes = lo que debes + lo que es tuyo' : `No cuadra por ${dinero(b.diferencia)}`}
            </div>
          </>
        )}

        {datos && (
          <div className="acciones-num">
            <button type="button" className="btn btn-oscuro btn-ancho" onClick={() => window.print()}>
              <Icono nombre="documento" tam={24} />
              PDF para el contador
            </button>
            <button type="button" className="btn btn-claro btn-ancho" onClick={irDinero}>
              <Icono nombre="banco" tam={24} />
              Caja, equipo y deudas
            </button>
          </div>
        )}
      </div>

      {er && b && datos && (
        <div className="hoja-contable" aria-hidden="true">
          <div className="hc-encabezado">
            <div className="hc-negocio">{negocio}</div>
            <div className="hc-titulo">Estado de resultados</div>
            <div className="hc-periodo">
              Del {fechaLarga(datos.rango.desde)} al {fechaLarga(ultimoDia(datos.rango.hasta))}
            </div>
          </div>
          <table className="hc-tabla">
            <tbody>
              <tr><td>Ventas</td><td className="n">{dinero(er.ventasBrutas)}</td></tr>
              <tr><td className="i">Efectivo</td><td className="n">{dinero(er.porMetodo.efectivo)}</td></tr>
              <tr><td className="i">Transferencia</td><td className="n">{dinero(er.porMetodo.transferencia)}</td></tr>
              <tr><td className="i">Tarjeta</td><td className="n">{dinero(er.porMetodo.tarjeta)}</td></tr>
              <tr><td className="i">Plataformas de delivery</td><td className="n">{dinero(er.porMetodo.app)}</td></tr>
              <tr><td>(−) Comisiones bancarias</td><td className="n">{dinero(er.comisionesBanco)}</td></tr>
              <tr><td>(−) Comisiones de plataformas</td><td className="n">{dinero(er.comisionesApps)}</td></tr>
              <tr className="t"><td>Ventas netas</td><td className="n">{dinero(er.ventasNetas)}</td></tr>
              <tr><td>(−) Costo de ventas</td><td className="n">{dinero(er.costoVentas)}</td></tr>
              <tr className="t"><td>Utilidad bruta</td><td className="n">{dinero(er.utilidadBruta)}</td></tr>
              <tr><td>Gastos de operación</td><td /></tr>
              {CATEGORIAS_OPERACION.map((c) => (
                <tr key={c}><td className="i">{NOMBRE_CATEGORIA[c]}</td><td className="n">{dinero(er.gastosOperacion[c])}</td></tr>
              ))}
              <tr><td>Total gastos de operación</td><td className="n">{dinero(er.totalGastosOperacion)}</td></tr>
              <tr className="t tt"><td>{er.utilidadNeta >= 0 ? 'Utilidad neta' : 'Pérdida neta'}</td><td className="n">{dinero(er.utilidadNeta)}</td></tr>
            </tbody>
          </table>

          <div className="hc-encabezado hc-salto">
            <div className="hc-negocio">{negocio}</div>
            <div className="hc-titulo">Balance general</div>
            <div className="hc-periodo">Al {fechaLarga(ultimoDia(datos.rango.hasta))}</div>
          </div>
          <table className="hc-tabla">
            <tbody>
              <tr className="s"><td>Activo</td><td /></tr>
              <tr><td className="i">Caja</td><td className="n">{dinero(b.caja)}</td></tr>
              <tr><td className="i">Bancos</td><td className="n">{dinero(b.banco)}</td></tr>
              <tr><td className="i">Inventarios</td><td className="n">{dinero(b.inventario)}</td></tr>
              <tr><td className="i">Mobiliario y equipo</td><td className="n">{dinero(b.equipo)}</td></tr>
              <tr className="t"><td>Total activo</td><td className="n">{dinero(b.totalActivos)}</td></tr>
              <tr className="s"><td>Pasivo</td><td /></tr>
              {b.deudas.map((d, i) => (
                <tr key={i}><td className="i">{d.nombre}</td><td className="n">{dinero(d.saldo)}</td></tr>
              ))}
              <tr className="t"><td>Total pasivo</td><td className="n">{dinero(b.totalPasivos)}</td></tr>
              <tr className="s"><td>Capital contable</td><td /></tr>
              <tr><td className="i">Capital aportado</td><td className="n">{dinero(b.capitalAportado)}</td></tr>
              <tr><td className="i">Utilidades acumuladas</td><td className="n">{dinero(b.utilidadAcumulada)}</td></tr>
              <tr><td className="i">(−) Retiros del propietario</td><td className="n">{dinero(b.retiros)}</td></tr>
              <tr className="t"><td>Total capital</td><td className="n">{dinero(b.totalCapital)}</td></tr>
              <tr className="t tt"><td>Total pasivo + capital</td><td className="n">{dinero(b.totalPasivos + b.totalCapital)}</td></tr>
            </tbody>
          </table>
          <p className="hc-nota">
            Elaborado con TacoBrain el {fechaLarga(new Date())}. Inventario valuado a costo promedio. El equipo se muestra a su valor registrado, sin depreciación. Cifras con IVA incluido. Documento informativo; no sustituye a la
            contabilidad formal.
          </p>
        </div>
      )}
    </main>
  );
}
