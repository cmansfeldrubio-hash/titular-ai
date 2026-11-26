import type { PropuestaRespuesta, UsoTokens } from '@ley/domain';

/** Eventos que el agente emite en vivo para mostrar cada paso (RF-11, RNF-10). */
export type EventoAgente =
  | { tipo: 'paso'; texto: string }
  | { tipo: 'pensamiento'; texto: string }
  | { tipo: 'texto'; delta: string }
  | { tipo: 'herramienta'; id: string; nombre: string; entrada: Record<string, unknown> }
  | { tipo: 'resultado'; id: string; nombre: string; resumen: string; error: boolean }
  | { tipo: 'reintento'; fuenteId: string; intento: number; mensaje: string }
  | { tipo: 'uso'; uso: UsoTokens }
  | { tipo: 'fin'; propuesta: PropuestaRespuesta; uso: UsoTokens };

export type AlEvento = (evento: EventoAgente) => void;
