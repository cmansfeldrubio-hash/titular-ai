import type { Prorroga } from './schemas';

export const ZONA_HORARIA = 'America/Santiago';
export const DIAS_PLAZO = 30;
export const DIAS_PRORROGA = 30;
const MS_DIA = 86_400_000;

/** Fecha calendario (año, mes, día) en la zona de Santiago, como número de días desde la época. */
function diaCalendario(fecha: Date): number {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha); // AAAA-MM-DD
  return Math.round(Date.parse(`${partes}T00:00:00Z`) / MS_DIA);
}

export interface EstadoPlazo {
  /** Días corridos restantes; negativo si venció. */
  diasRestantes: number;
  /** Fecha de vencimiento en formato ISO (día calendario en Santiago). */
  vence: string;
  plazoTotal: number;
  conProrroga: boolean;
}

/**
 * Calcula el plazo de respuesta: 30 días corridos desde la recepción, más una
 * prórroga única de 30 días si se registró (RF-09).
 */
export function calcularPlazo(
  recibidaEn: string | Date,
  prorroga?: Prorroga,
  ahora: Date = new Date(),
): EstadoPlazo {
  const recibida = typeof recibidaEn === 'string' ? new Date(recibidaEn) : recibidaEn;
  const plazoTotal = DIAS_PLAZO + (prorroga ? DIAS_PRORROGA : 0);
  const diaVence = diaCalendario(recibida) + plazoTotal;
  const diasRestantes = diaVence - diaCalendario(ahora);
  return {
    diasRestantes,
    vence: new Date(diaVence * MS_DIA).toISOString().slice(0, 10),
    plazoTotal,
    conProrroga: Boolean(prorroga),
  };
}

export type Semaforo = 'verde' | 'amarillo' | 'rojo';

/** Verde con más de 10 días, amarillo entre 10 y 4, rojo con 3 o menos (RF-08). */
export function semaforo(diasRestantes: number): Semaforo {
  if (diasRestantes > 10) return 'verde';
  if (diasRestantes >= 4) return 'amarillo';
  return 'rojo';
}

/** Texto que acompaña al color: el estado nunca se indica solo con color (RNF-08). */
export function textoPlazo(diasRestantes: number): string {
  if (diasRestantes < 0)
    return `Vencida hace ${-diasRestantes} ${-diasRestantes === 1 ? 'día' : 'días'}`;
  if (diasRestantes === 0) return 'Vence hoy';
  if (diasRestantes === 1) return 'Queda 1 día';
  return `Quedan ${diasRestantes} días`;
}

/** Fecha en formato DD-MM-AAAA en la zona de Santiago (RNF-09). */
export function formatearFecha(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${v('day')}-${v('month')}-${v('year')}`;
}

/** Fecha y hora `DD-MM-AAAA HH:MM` en la zona de Santiago. */
export function formatearFechaHora(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const hora = new Intl.DateTimeFormat('es-CL', {
    timeZone: ZONA_HORARIA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${formatearFecha(d)} ${hora}`;
}

/** Fecha de vencimiento (AAAA-MM-DD) a DD-MM-AAAA sin desplazar por zona horaria. */
export function formatearDiaIso(diaIso: string): string {
  const [a, m, d] = diaIso.split('-');
  return `${d}-${m}-${a}`;
}
