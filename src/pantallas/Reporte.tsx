import { useEffect, useRef, useState } from 'react';
import { almacen } from '../data/almacen';
import { dinero } from '../lib/dinero';
import { rangoDe, type Periodo } from '../lib/fechas';
import { entenderPregunta, respuestaHablada, resumir, type Enfoque, type Resumen } from '../lib/reportes';
import { callar, escuchar, hablar, puedeEscuchar, type Escucha } from '../lib/voz';
import { Encabezado } from '../componentes/Encabezado';
import { Icono } from '../componentes/Icono';

type Estado = 'listo' | 'escuchando' | 'pensando' | 'respuesta';

const RAPIDAS: { texto: string; periodo: Periodo }[] = [
  { texto: 'Hoy', periodo: 'hoy' },
  { texto: 'Esta semana', periodo: 'semana' },
  { texto: 'Semana pasada', periodo: 'semana-pasada' },
  { texto: 'Este mes', periodo: 'mes' }
];

export function Reporte({ regresar }: { regresar: () => void }) {
  const a = almacen();
  const [estado, setEstado] = useState<Estado>('listo');
  const [escuchado, setEscuchado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [respuestaVisible, setRespuestaVisible] = useState('');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [nombreRango, setNombreRango] = useState('');
  const escucha = useRef<Escucha | null>(null);
  const conVoz = puedeEscuchar();

  useEffect(
    () => () => {
      escucha.current?.cancelar();
      callar();
    },
    []
  );

  async function responder(periodo: Periodo, enfoque: Enfoque) {
    setEstado('pensando');
    try {
      const rango = rangoDe(periodo);
      const [ventas, gastos] = await Promise.all([a.ventasEntre(rango.desde, rango.hasta), a.gastosEntre(rango.desde, rango.hasta)]);
      const r = resumir(ventas, gastos);
      const paraOir = respuestaHablada(r, rango, enfoque);
      setResumen(r);
      setNombreRango(rango.nombre);
      setRespuesta(paraOir);
      setRespuestaVisible(respuestaHablada(r, rango, enfoque, dinero));
      setEstado('respuesta');
      hablar(paraOir);
    } catch {
      setAviso('No pude traer tus números. Revisa el internet.');
      setEstado('listo');
    }
  }

  async function preguntar() {
    callar();
    setAviso(null);
    setEscuchado(null);
    setEstado('escuchando');
    escucha.current = escuchar();
    try {
      const texto = await escucha.current.resultado;
      setEscuchado(texto);
      const p = entenderPregunta(texto);
      await responder(p.periodo, p.enfoque);
    } catch (e) {
      const motivo = (e as Error).message;
      setAviso(
        motivo === 'not-allowed' || motivo === 'service-not-allowed' || motivo === 'sin-voz'
          ? 'No tengo permiso del micrófono aquí. Usa los botones de abajo.'
          : 'No te escuché bien. Toca otra vez o usa los botones de abajo.'
      );
      setEstado('listo');
    }
  }

  function rapida(periodo: Periodo, texto: string) {
    callar();
    setAviso(null);
    setEscuchado(texto);
    void responder(periodo, 'todo');
  }

  return (
    <main className="pantalla reporte">
      <Encabezado titulo="¿Cómo me fue?" onRegresar={regresar} oscuro />

      {(estado === 'listo' || estado === 'escuchando') && (
        <div className="reporte-centro">
          {conVoz ? (
            <>
              <button type="button" className={estado === 'escuchando' ? 'btn-micro escuchando' : 'btn-micro'} onClick={preguntar} aria-label="Preguntar con la voz" disabled={estado === 'escuchando'}>
                <Icono nombre="microfono" tam={76} grosor={1.8} />
              </button>
              <div className="reporte-titulo">{estado === 'escuchando' ? 'Te escucho…' : 'Toca y pregunta'}</div>
              <div className="reporte-ejemplo">“¿Cómo me fue esta semana?”</div>
            </>
          ) : (
            <div className="reporte-titulo">Elige qué quieres saber</div>
          )}
          {aviso && <div className="reporte-aviso">{aviso}</div>}
        </div>
      )}

      {estado === 'pensando' && (
        <div className="reporte-centro">
          <div className="girando claro" aria-hidden="true" />
          <div className="reporte-titulo">Sacando cuentas…</div>
        </div>
      )}

      {estado === 'respuesta' && resumen && (
        <div className="reporte-respuesta">
          {escuchado && <div className="escuchado">“{escuchado}”</div>}
          <div className="burbuja" aria-live="polite">
            {respuestaVisible}
          </div>
          <div className="cuadros">
            <div className="cuadro">
              <span className="cuadro-etiqueta">Vendiste</span>
              <span className="cuadro-cifra">{dinero(resumen.ventas)}</span>
            </div>
            <div className="cuadro">
              <span className="cuadro-etiqueta">Gastaste</span>
              <span className="cuadro-cifra">{dinero(resumen.gastos)}</span>
            </div>
          </div>
          <div className={resumen.ganancia >= 0 ? 'cuadro-ganancia' : 'cuadro-ganancia perdida'}>
            <span className="cuadro-etiqueta">{resumen.ganancia >= 0 ? `Ganancia de ${nombreRango}` : `Pérdida de ${nombreRango}`}</span>
            <span className="cuadro-cifra-grande">{dinero(Math.abs(resumen.ganancia))}</span>
          </div>
          <div className="reporte-acciones">
            <button type="button" className="btn btn-oscuro" onClick={() => hablar(respuesta)}>
              <Icono nombre="bocina" tam={26} />
              Repetir
            </button>
            {conVoz && (
              <button type="button" className="btn btn-acento" onClick={preguntar}>
                <Icono nombre="microfono" tam={26} />
                Preguntar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rapidas" role="group" aria-label="Preguntas rápidas">
        {RAPIDAS.map((r) => (
          <button key={r.periodo} type="button" className="rapida" onClick={() => rapida(r.periodo, r.texto)} disabled={estado === 'escuchando' || estado === 'pensando'}>
            {r.texto}
          </button>
        ))}
      </div>
    </main>
  );
}
