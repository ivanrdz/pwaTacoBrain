import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { almacen } from '../data/almacen';
import { calcularDecisiones, type Decisiones } from '../data/operaciones';
import { NOMBRE_CANAL, NOMBRE_UNIDAD } from '../data/tipos';
import { NOMBRE_DIA } from '../lib/decisiones';
import { dinero as dineroExacto } from '../lib/dinero';
import { Encabezado } from '../componentes/Encabezado';
import { Icono, type NombreIcono } from '../componentes/Icono';
import { TecladoNumerico } from '../componentes/TecladoNumerico';

/** En los consejos los montos van en pesos enteros: se leen más fácil. */
const dinero = (n: number) => dineroExacto(Math.round(n));

const NOMBRE_FIJO = { renta: 'Renta', gas: 'Gas', luz: 'Luz y agua', sueldos: 'Sueldos', otro: 'Otros' } as const;
const DIA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const pct = (n: number) => `${Math.round(n * 100)} %`;
const cant = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const horaBonita = (h: number) => {
  const f = (x: number) => (x % 12 === 0 ? 12 : x % 12);
  return `${f(h)} a ${f(h + 1)} ${h + 1 < 12 || h + 1 === 24 ? 'am' : 'pm'}`;
};

function Tarjeta({ icono, titulo, children }: { icono: NombreIcono; titulo: string; children: ReactNode }) {
  return (
    <section className="tarjeta-negocio">
      <h2 className="tarjeta-negocio-titulo">
        <span className="icono-acento">
          <Icono nombre={icono} tam={26} />
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Barra({ valor, max, clase = '' }: { valor: number; max: number; clase?: string }) {
  const ancho = max > 0 ? Math.min(100, Math.max(0, (valor / max) * 100)) : 0;
  return (
    <div className="barra" role="presentation">
      <div className={`barra-relleno ${clase}`} style={{ width: `${ancho}%` }} />
    </div>
  );
}

/** Herramientas para decidir: con las últimas 4 semanas de ventas, compras e inventario. */
export function MiNegocio({ regresar, irDinero, irProductos }: { regresar: () => void; irDinero: () => void; irProductos: () => void }) {
  const a = almacen();
  const [d, setD] = useState<Decisiones | null>(null);
  const [error, setError] = useState(false);
  const [tecladoMeta, setTecladoMeta] = useState(false);

  const cargar = useCallback(() => {
    setError(false);
    calcularDecisiones(a)
      .then(setD)
      .catch(() => setError(true));
  }, [a]);

  useEffect(() => cargar(), [cargar]);

  async function guardarMeta(n: number) {
    if (!d) return;
    setTecladoMeta(false);
    await a.guardarConfig({ ...d.config, metaSemanal: n });
    cargar();
  }

  if (error)
    return (
      <main className="pantalla mi-negocio">
        <Encabezado titulo="Mi negocio" onRegresar={regresar} />
        <div className="aviso aviso-error">No pude sacar tus números. Revisa el internet.</div>
      </main>
    );
  if (!d)
    return (
      <main className="pantalla mi-negocio">
        <Encabezado titulo="Mi negocio" onRegresar={regresar} />
        <div className="cargando">Sacando cuentas…</div>
      </main>
    );

  const sinVentas = d.er4Semanas.numVentas === 0;
  const conReceta = d.productos.filter((p) => p.ganancia !== null);
  const sinReceta = d.productos.filter((p) => p.ganancia === null);
  const masDeja = conReceta.length ? conReceta.reduce((x, y) => ((y.margen ?? 0) > (x.margen ?? 0) ? y : x)) : null;
  const menosDeja = conReceta.length > 1 ? conReceta.reduce((x, y) => ((y.margen ?? 0) < (x.margen ?? 0) ? y : x)) : null;
  const mostrador = d.canales.find((c) => c.canal === 'mostrador');
  const apps = d.canales.filter((c) => c.canal !== 'mostrador');
  const maxDia = Math.max(...d.patron.porDia.map((x) => x.promedio), 1);
  const topHoras = [...d.patron.porHora].sort((x, y) => y.total - x.total).slice(0, 4);
  const maxHora = topHoras[0]?.total ?? 1;
  const totalApartar = d.apartar.reduce((s, x) => s + x.monto, 0);
  const perdido = d.merma.valorTirado + d.merma.valorDiferencia;

  return (
    <main className="pantalla mi-negocio">
      <Encabezado titulo="Mi negocio" onRegresar={regresar} />
      <p className="explica">Consejos con lo que pasó en las últimas 4 semanas.</p>

      {sinVentas && <div className="aviso aviso-alerta">Todavía no hay ventas suficientes. Usa la app unos días y aquí aparecerán tus números.</div>}

      {/* 8. Meta de la semana */}
      <Tarjeta icono="grafica" titulo="Tu meta de la semana">
        {d.meta ? (
          <>
            <p className="frase">
              {d.meta.lograda ? (
                <>
                  <b>¡Lo lograste!</b> Llevas {dinero(d.meta.llevas)} de ganancia, tu meta era {dinero(d.meta.meta)}.
                </>
              ) : (
                <>
                  Llevas <b>{dinero(Math.max(d.meta.llevas, 0))}</b> de {dinero(d.meta.meta)}. Te faltan <b>{dinero(d.meta.falta)}</b>.
                </>
              )}
            </p>
            <Barra valor={d.meta.llevas} max={d.meta.meta} clase={d.meta.lograda ? 'verde' : ''} />
            {d.meta.ventaDiariaNecesaria && (
              <p className="nota">
                Para lograrla vende unos {dinero(d.meta.ventaDiariaNecesaria)} {d.meta.diasRestantes === 1 ? 'hoy' : `al día los ${d.meta.diasRestantes} días que quedan`}.
              </p>
            )}
            <button type="button" className="btn-texto" onClick={() => setTecladoMeta(true)}>
              Cambiar meta
            </button>
          </>
        ) : (
          <>
            <p className="frase">Ponte una meta de cuánto quieres ganar cada semana y aquí ves cómo vas.</p>
            <button type="button" className="btn btn-acento btn-ancho" onClick={() => setTecladoMeta(true)}>
              Poner mi meta
            </button>
          </>
        )}
      </Tarjeta>

      {/* 4. Punto de equilibrio */}
      <Tarjeta icono="billete" titulo="Para no perder dinero">
        {d.equilibrio ? (
          <>
            <p className="frase">
              Necesitas vender <b>{dinero(d.equilibrio.diario)} al día</b> para cubrir tus gastos fijos (unos {dinero(d.equilibrio.mensual)} al mes).
            </p>
            <div className="fila-barra">
              <span>Hoy llevas {dinero(d.ventasHoy)}</span>
              <span>{d.ventasHoy >= d.equilibrio.diario ? '¡Ya cubriste!' : `Faltan ${dinero(d.equilibrio.diario - d.ventasHoy)}`}</span>
            </div>
            <Barra valor={d.ventasHoy} max={d.equilibrio.diario} clase={d.ventasHoy >= d.equilibrio.diario ? 'verde' : ''} />
            <p className="nota">
              {d.fijos.fuente === 'anotados' ? 'Con los gastos fijos que anotaste' : 'Con los gastos que registraste en los últimos 30 días'} ({dinero(d.fijos.total)} al mes, {d.config.diasAbiertosMes} días abiertos). De cada $100 que vendes te quedan{' '}
              {dinero(Math.round((d.margen ?? 0) * 100))} después de insumos y comisiones.
            </p>
          </>
        ) : (
          <>
            <p className="frase">{d.fijos.total > 0 ? 'Necesito unos días de ventas para calcularlo.' : 'Anota cuánto pagas al mes de renta, gas, luz y sueldos para saber cuánto necesitas vender al día.'}</p>
            {d.fijos.total === 0 && (
              <button type="button" className="btn btn-acento btn-ancho" onClick={irDinero}>
                Anotar gastos fijos
              </button>
            )}
          </>
        )}
      </Tarjeta>

      {/* 6. Apartar dinero */}
      {d.apartar.length > 0 && (
        <Tarjeta icono="caja" titulo="Aparta cada día">
          <p className="frase">
            Guarda <b>{dinero(totalApartar)}</b> cada día que abras para que no te agarren sin dinero:
          </p>
          <div className="lista-simple">
            {d.apartar.map((x) => (
              <div key={x.concepto} className="lista-simple-fila">
                <span>{NOMBRE_FIJO[x.concepto]}</span>
                <span>{dinero(x.monto)}</span>
              </div>
            ))}
          </div>
        </Tarjeta>
      )}

      {/* 2. Alertas de precios */}
      <Tarjeta icono="documento" titulo="Precios de tus compras">
        {d.alertas.length === 0 ? (
          <p className="frase">Sin subidas fuertes en tus compras recientes.</p>
        ) : (
          d.alertas.map((al) => (
            <div key={al.insumo.id} className="alerta-precio">
              <p className="frase">
                <b>
                  {al.insumo.nombre} subió {pct(al.cambio)}
                </b>
                : de {dinero(al.antes)} a {dinero(al.ahora)} el {al.insumo.unidad}.
              </p>
              {al.productos.map((im) => (
                <p key={im.producto.id} className="nota">
                  Al {im.producto.nombre.toLowerCase()} ahora le ganas {dineroExacto(im.gananciaAhora)} (antes {dineroExacto(im.gananciaAntes)}). Para ganar lo mismo, cóbralo a{' '}
                  <b>{dinero(im.precioSugerido)}</b>.
                </p>
              ))}
            </div>
          ))
        )}
      </Tarjeta>

      {/* 1. Cuánto deja cada producto */}
      <Tarjeta icono="vender" titulo="Lo que te deja cada producto">
        {masDeja && (
          <p className="frase">
            Lo que más te deja es el <b>{masDeja.producto.nombre.toLowerCase()}</b> ({pct(masDeja.margen ?? 0)} de cada venta)
            {menosDeja && menosDeja !== masDeja ? (
              <>
                ; lo que menos, el <b>{menosDeja.producto.nombre.toLowerCase()}</b> ({pct(menosDeja.margen ?? 0)})
              </>
            ) : null}
            .
          </p>
        )}
        <div className="tabla-productos">
          {conReceta.map((p) => (
            <div key={p.producto.id} className="fila-rentable">
              <div className="fila-rentable-info">
                <span className="fila-rentable-nombre">{p.producto.nombre}</span>
                <span className="nota">
                  Cuesta {dineroExacto(p.costo ?? 0)} · lo vendes a {dineroExacto(p.producto.precio)} · vendiste {p.vendidos}
                </span>
              </div>
              <div className="fila-rentable-cifras">
                <span className={(p.ganancia ?? 0) > 0 ? 'positivo' : 'negativo'}>{dineroExacto(p.ganancia ?? 0)} c/u</span>
                <span className="nota">te dejó {dinero(p.gananciaTotal ?? 0)}</span>
              </div>
            </div>
          ))}
        </div>
        {sinReceta.length > 0 && (
          <>
            <p className="nota">
              Sin receta: {sinReceta.map((p) => p.producto.nombre).join(', ')}. Anota qué lleva cada uno para saber cuánto te deja.
            </p>
            <button type="button" className="btn btn-claro btn-ancho" onClick={irProductos}>
              Anotar recetas
            </button>
          </>
        )}
      </Tarjeta>

      {/* 3. Apps de delivery */}
      <Tarjeta icono="moto" titulo="¿Te conviene vender por apps?">
        {apps.length === 0 || !mostrador ? (
          <p className="frase">Cuando tengas ventas por Rappi, Uber o DiDi aquí verás cuánto te deja cada una contra el mostrador.</p>
        ) : (
          <>
            <p className="frase">De cada $100 que vendes, después de comisión e insumos te quedan:</p>
            {d.canales.map((c) => (
              <div key={c.canal} className="fila-canal">
                <div className="fila-barra">
                  <span>{NOMBRE_CANAL[c.canal]}</span>
                  <b className={c.porCada100 > 0 ? '' : 'negativo'}>{dinero(c.porCada100)}</b>
                </div>
                <Barra valor={c.porCada100} max={Math.max(mostrador.porCada100, 1)} clase={c.canal === 'mostrador' ? 'verde' : ''} />
              </div>
            ))}
            {(() => {
              const peor = apps.reduce((x, y) => (y.porCada100 < x.porCada100 ? y : x));
              const dif = mostrador.porCada100 - peor.porCada100;
              return dif > 0 ? (
                <p className="nota">
                  Por {NOMBRE_CANAL[peor.canal]} te quedan {dinero(dif)} menos que en mostrador por cada $100.
                  {peor.porCada100 <= 0 ? ' Ahí estás perdiendo: considera subir tus precios en esa app.' : ' Si puedes, sube un poco tus precios en esa app.'}
                </p>
              ) : null;
            })()}
          </>
        )}
      </Tarjeta>

      {/* 5. Mejores días y horas */}
      {!sinVentas && (
        <Tarjeta icono="reloj" titulo="Tus mejores días y horas">
          {d.patron.mejorDia !== null && (
            <p className="frase">
              Tu mejor día es el <b>{NOMBRE_DIA[d.patron.mejorDia]}</b> ({dinero(d.patron.porDia[d.patron.mejorDia].promedio)} en promedio)
              {d.patron.peorDia !== null && d.patron.peorDia !== d.patron.mejorDia ? `; el más flojo, el ${NOMBRE_DIA[d.patron.peorDia]}` : ''}.
              {d.patron.mejorHora !== null && (
                <>
                  {' '}
                  Tu hora fuerte es de <b>{horaBonita(d.patron.mejorHora)}</b>.
                </>
              )}
            </p>
          )}
          <div className="barras-dias" role="img" aria-label="Venta promedio por día de la semana">
            {d.patron.porDia.map((x) => (
              <div key={x.dia} className="barra-dia">
                <div className="barra-dia-columna">
                  <div className={x.dia === d.patron.mejorDia ? 'barra-dia-relleno verde' : 'barra-dia-relleno'} style={{ height: `${(x.promedio / maxDia) * 100}%` }} />
                </div>
                <span>{DIA_CORTO[x.dia]}</span>
              </div>
            ))}
          </div>
          {topHoras.length > 0 && (
            <div className="lista-simple">
              {topHoras.map((h) => (
                <div key={h.hora} className="fila-canal">
                  <div className="fila-barra">
                    <span>De {horaBonita(h.hora)}</span>
                    <span>{dinero(h.total)}</span>
                  </div>
                  <Barra valor={h.total} max={maxHora} />
                </div>
              ))}
            </div>
          )}
          {d.uso.slice(0, 3).map((u) => {
            const mejor = d.patron.mejorDia ?? 5;
            const otros = u.porDia.filter((_, i) => i !== mejor && u.porDia[i] > 0);
            const promedioOtros = otros.length ? otros.reduce((s, x) => s + x, 0) / otros.length : 0;
            return (
              <p key={u.insumo.id} className="nota">
                {u.insumo.nombre}: los {NOMBRE_DIA[mejor]} usas unos {cant(u.porDia[mejor])} {NOMBRE_UNIDAD[u.insumo.unidad]}
                {promedioOtros > 0 ? `; los demás días, ${cant(promedioOtros)}` : ''}.
              </p>
            );
          })}
        </Tarjeta>
      )}

      {/* 7. Merma */}
      <Tarjeta icono="basura" titulo="Lo que se pierde">
        {perdido <= 0 ? (
          <p className="frase">No se ve desperdicio en las últimas 4 semanas. Si algo se echa a perder, anótalo en Inventario → "Se echó a perder".</p>
        ) : (
          <>
            <p className="frase">
              En 4 semanas se perdieron unos <b>{dinero(perdido)}</b>.
            </p>
            {d.merma.valorTirado > 0 && <p className="nota">Se tiró o se echó a perder: {dinero(d.merma.valorTirado)}.</p>}
            {d.merma.valorDiferencia > 0 && (
              <p className="nota">Sacaste {dinero(d.merma.valorDiferencia)} más de lo que dicen tus recetas por lo que vendiste: porciones más grandes, algo que no se cobró o algo que no se anotó.</p>
            )}
            <div className="lista-simple">
              {d.merma.porInsumo.slice(0, 4).map((m) => (
                <div key={m.insumo.id} className="lista-simple-fila">
                  <span>
                    {m.insumo.nombre}
                    {m.diferencia > 0 && (
                      <span className="nota">
                        {' '}
                        · usaste {cant(m.sacado)} {m.insumo.unidad}, la receta dice {cant(m.esperado)}
                      </span>
                    )}
                  </span>
                  <span>{dinero(m.valorPerdido)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Tarjeta>

      {tecladoMeta && (
        <TecladoNumerico titulo="¿Cuánto quieres ganar por semana?" valorInicial={d.config.metaSemanal || null} permitirCero onCancelar={() => setTecladoMeta(false)} onListo={guardarMeta} />
      )}
    </main>
  );
}
