const formato = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** "$1,850" para pantalla */
export function dinero(n: number): string {
  return formato.format(Math.round(n * 100) / 100);
}

/** "1850 pesos" para que la voz lo lea bien */
export function dineroVoz(n: number): string {
  const redondo = Math.round(Math.abs(n));
  return redondo === 1 ? 'un peso' : `${redondo} pesos`;
}
