import { Icono } from './Icono';

export function Encabezado({ titulo, onRegresar, oscuro = false }: { titulo: string; onRegresar: () => void; oscuro?: boolean }) {
  return (
    <header className="encabezado">
      <button type="button" className={oscuro ? 'btn-regresar oscuro' : 'btn-regresar'} onClick={onRegresar} aria-label="Regresar al inicio">
        <Icono nombre="regresar" tam={28} grosor={2.4} />
      </button>
      <h1>{titulo}</h1>
    </header>
  );
}
