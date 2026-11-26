import Anthropic from '@anthropic-ai/sdk';
import type { Connector, RegistroFuente } from '@ley/connectors';
import type { Empresa, PropuestaRespuesta, Solicitud, UsoTokens } from '@ley/domain';
import type { AlEvento } from './eventos';
import { ejecutarHerramienta, HERRAMIENTAS, type ContextoHerramientas } from './herramientas';
import { acumularUso, infoModelo, usoVacio } from './modelos';
import { mensajeSolicitud, promptSistema } from './prompts';

export interface OpcionesInvestigacion {
  cliente: Anthropic;
  modelo: string;
  empresa: Empresa;
  solicitud: Solicitud;
  conectores: Connector[];
  alEvento: AlEvento;
  signal?: AbortSignal;
  /** Indicaciones del encargado al pedir otra versión (RF-16). */
  instruccionesExtra?: string;
  maxIteraciones?: number;
}

type Params = Anthropic.Beta.Messages.MessageCreateParamsStreaming;

/** Parámetros que dependen del modelo elegido. */
export function parametrosModelo(modelo: string): Partial<Params> {
  const info = infoModelo(modelo);
  const extra: Partial<Params> = {};
  if (info.adaptativo) {
    // Resumen del razonamiento para mostrarlo en vivo; esfuerzo medio para uso de herramientas en varios pasos.
    extra.thinking = { type: 'adaptive', display: 'summarized' };
    extra.output_config = { effort: 'medium' };
  }
  if (info.respaldo) {
    // Si los clasificadores de seguridad rechazan la petición, el servidor la reintenta en otro modelo.
    extra.betas = ['server-side-fallback-2026-07-01'];
    extra.fallbacks = 'default';
  }
  return extra;
}

export class ErrorAgente extends Error {
  override name = 'ErrorAgente';
}

/**
 * Bucle del agente: corre en el navegador, transmite cada paso y termina cuando el modelo
 * llama a `proponer_respuesta`. Nunca envía correos ni modifica fuentes.
 */
export async function investigarSolicitud(
  op: OpcionesInvestigacion,
): Promise<{ propuesta: PropuestaRespuesta; uso: UsoTokens }> {
  const ctx: ContextoHerramientas = {
    solicitud: op.solicitud,
    conectores: op.conectores,
    alEvento: op.alEvento,
    registros: new Map<string, RegistroFuente>(),
  };
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    { role: 'user', content: mensajeSolicitud(op.solicitud, op.instruccionesExtra) },
  ];
  let uso = usoVacio(op.modelo);
  let recordatorios = 0;
  let reintentosJson = 0;
  const maxIteraciones = op.maxIteraciones ?? 25;

  op.alEvento({
    tipo: 'paso',
    texto: `Iniciando la investigación con ${infoModelo(op.modelo).etiqueta}`,
  });

  for (let iteracion = 0; iteracion < maxIteraciones; iteracion++) {
    const stream = op.cliente.beta.messages.stream(
      {
        model: op.modelo,
        max_tokens: 16000,
        system: promptSistema(op.empresa),
        tools: HERRAMIENTAS as Anthropic.Beta.Messages.BetaTool[],
        messages,
        // Caché automática del prefijo estable (herramientas, sistema e historial).
        cache_control: { type: 'ephemeral' },
        ...parametrosModelo(op.modelo),
      },
      { signal: op.signal },
    );

    let mensaje: Anthropic.Beta.Messages.BetaMessage;
    try {
      let pensamiento = '';
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta') {
          if (ev.delta.type === 'thinking_delta') pensamiento += ev.delta.thinking;
          else if (ev.delta.type === 'text_delta')
            op.alEvento({ tipo: 'texto', delta: ev.delta.text });
        } else if (ev.type === 'content_block_stop' && pensamiento.trim()) {
          op.alEvento({ tipo: 'pensamiento', texto: pensamiento.trim() });
          pensamiento = '';
        }
      }
      mensaje = await stream.finalMessage();
      reintentosJson = 0;
    } catch (error) {
      // Errores de la API se propagan; una entrada de herramienta ilegible o una conexión cortada se reintenta.
      if (error instanceof Anthropic.APIError || op.signal?.aborted || reintentosJson++ >= 2)
        throw error;
      op.alEvento({ tipo: 'paso', texto: 'Respuesta incompleta del modelo; se repite el turno' });
      continue;
    }

    uso = acumularUso(uso, mensaje.usage);
    op.alEvento({ tipo: 'uso', uso });

    if (mensaje.stop_reason === 'refusal') {
      throw new ErrorAgente(
        'El modelo declinó la solicitud por sus filtros de seguridad. Intenta de nuevo o usa el modo demostración.',
      );
    }
    if (mensaje.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: mensaje.content });
      continue;
    }

    const usos = mensaje.content.filter(
      (b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use',
    );
    messages.push({ role: 'assistant', content: mensaje.content });

    if (usos.length === 0) {
      if (recordatorios++ >= 2)
        throw new ErrorAgente('El agente terminó sin proponer una respuesta.');
      messages.push({
        role: 'user',
        content:
          'Falta entregar el resultado: llama a proponer_respuesta con los hallazgos y el borrador.',
      });
      continue;
    }
    if (mensaje.stop_reason === 'max_tokens') {
      throw new ErrorAgente('La respuesta del modelo se cortó por longitud. Intenta de nuevo.');
    }

    // Las herramientas de un mismo turno se ejecutan en paralelo y sus resultados vuelven en un solo mensaje.
    let propuesta: PropuestaRespuesta | undefined;
    const resultados = await Promise.all(
      usos.map(async (b) => {
        const entrada = (b.input ?? {}) as Record<string, unknown>;
        op.alEvento({
          tipo: 'herramienta',
          id: b.id,
          nombre: b.name,
          entrada: b.name === 'proponer_respuesta' ? {} : entrada,
        });
        const r = await ejecutarHerramienta(b.name, entrada, ctx);
        op.alEvento({
          tipo: 'resultado',
          id: b.id,
          nombre: b.name,
          resumen: r.resumen,
          error: r.error,
        });
        if (r.propuesta) propuesta = r.propuesta;
        return {
          type: 'tool_result' as const,
          tool_use_id: b.id,
          content: r.contenido,
          ...(r.error ? { is_error: true } : {}),
        };
      }),
    );
    if (propuesta) {
      op.alEvento({ tipo: 'fin', propuesta, uso });
      return { propuesta, uso };
    }
    messages.push({ role: 'user', content: resultados });
  }
  throw new ErrorAgente('El agente superó el número máximo de pasos sin terminar.');
}
