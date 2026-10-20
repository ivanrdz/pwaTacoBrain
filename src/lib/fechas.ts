export interface Rango {
  desde: Date;
  hasta: Date;
  /** Cómo se dice en voz: "hoy", "esta semana", ... */
  nombre: string;
}

export type Periodo = 'hoy' | 'ayer' | 'semana' | 'semana-pasada' | 'mes' | 'mes-pasado';

function inicioDelDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sumarDias(d: Date, dias: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
}

/** La semana empieza en lunes. */
function inicioDeSemana(d: Date): Date {
  const hoy = inicioDelDia(d);
  const diaSemana = (hoy.getDay() + 6) % 7; // lunes = 0
  return sumarDias(hoy, -diaSemana);
}

export function rangoDe(periodo: Periodo, ahora: Date = new Date()): Rango {
  const hoy = inicioDelDia(ahora);
  switch (periodo) {
    case 'hoy':
      return { desde: hoy, hasta: sumarDias(hoy, 1), nombre: 'hoy' };
    case 'ayer':
      return { desde: sumarDias(hoy, -1), hasta: hoy, nombre: 'ayer' };
    case 'semana': {
      const ini = inicioDeSemana(ahora);
      return { desde: ini, hasta: sumarDias(ini, 7), nombre: 'esta semana' };
    }
    case 'semana-pasada': {
      const ini = sumarDias(inicioDeSemana(ahora), -7);
      return { desde: ini, hasta: sumarDias(ini, 7), nombre: 'la semana pasada' };
    }
    case 'mes': {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: ini, hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1), nombre: 'este mes' };
    }
    case 'mes-pasado': {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      return { desde: ini, hasta: new Date(hoy.getFullYear(), hoy.getMonth(), 1), nombre: 'el mes pasado' };
    }
  }
}

/** YYYY-MM-DD en hora local */
export function fechaISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function fechaBonita(iso: string, ahora: Date = new Date()): string {
  const hoy = fechaISO(ahora);
  const ayer = fechaISO(sumarDias(inicioDelDia(ahora), -1));
  if (iso === hoy) return 'Hoy';
  if (iso === ayer) return 'Ayer';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}
