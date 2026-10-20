const entero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const conCentavos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "$1,850" o "$40.90" para pantalla */
export function dinero(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? entero.format(r) : conCentavos.format(r);
}

/** "1850 pesos" para que la voz lo lea bien */
export function dineroVoz(n: number): string {
  const redondo = Math.round(Math.abs(n));
  return redondo === 1 ? 'un peso' : `${redondo} pesos`;
}
