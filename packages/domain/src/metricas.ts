import { calcularPlazo } from './plazos';
import type { Solicitud } from './schemas';

/** Minutos estimados de un proceso manual por solicitud (supuesto declarado en el reporte). */
export const MINUTOS_MANUAL_POR_SOLICITUD = 240;
/** Minutos estimados con el agente: revisión y aprobación humana. */
export const MINUTOS_CON_AGENTE_POR_SOLICITUD = 20;

export interface MetricasCumplimiento {
  recibidas: number;
  respondidas: number;
  respondidasEnPlazo: number;
  porcentajeEnPlazo: number;
  pendientes: number;
  vencidas: number;
  tiempoPromedioDias: number | null;
  horasAhorradasEstimadas: number;
}

const DIA = 86_400_000;
/** Estados en que la solicitud ya fue respondida al titular. Un borrador rechazado sigue abierto. */
const RESPONDIDAS = new Set(['enviada', 'no_enviada', 'aprobada']);

/** Métricas del reporte de cumplimiento (RF-21, RF-22). */
export function calcularMetricas(
  solicitudes: Solicitud[],
  ahora = new Date(),
): MetricasCumplimiento {
  const respondidas = solicitudes.filter((s) => RESPONDIDAS.has(s.estado) && s.respondidaEn);
  const enPlazo = respondidas.filter((s) => {
    const { diasRestantes } = calcularPlazo(s.recibidaEn, s.prorroga, new Date(s.respondidaEn!));
    return diasRestantes >= 0;
  });
  const pendientes = solicitudes.filter((s) => !RESPONDIDAS.has(s.estado));
  const vencidas = pendientes.filter(
    (s) => calcularPlazo(s.recibidaEn, s.prorroga, ahora).diasRestantes < 0,
  );
  const tiempos = respondidas.map(
    (s) => (new Date(s.respondidaEn!).getTime() - new Date(s.recibidaEn).getTime()) / DIA,
  );
  const tiempoPromedioDias =
    tiempos.length > 0
      ? Math.round((tiempos.reduce((a, b) => a + b, 0) / tiempos.length) * 10) / 10
      : null;
  const horasAhorradasEstimadas =
    Math.round(
      ((respondidas.length * (MINUTOS_MANUAL_POR_SOLICITUD - MINUTOS_CON_AGENTE_POR_SOLICITUD)) /
        60) *
        10,
    ) / 10;
  return {
    recibidas: solicitudes.length,
    respondidas: respondidas.length,
    respondidasEnPlazo: enPlazo.length,
    porcentajeEnPlazo:
      respondidas.length > 0 ? Math.round((enPlazo.length / respondidas.length) * 100) : 0,
    pendientes: pendientes.length,
    vencidas: vencidas.length,
    tiempoPromedioDias,
    horasAhorradasEstimadas,
  };
}
