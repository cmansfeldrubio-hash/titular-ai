import type Anthropic from '@anthropic-ai/sdk';
import { conReintentos, ErrorFuente, type Connector, type RegistroFuente } from '@ley/connectors';
import {
  calcularPlazo,
  PropuestaRespuestaSchema,
  type Hallazgo,
  type PropuestaRespuesta,
  type Solicitud,
} from '@ley/domain';
import { z } from 'zod';
import type { AlEvento } from './eventos';

// ---------- Esquemas de entrada (validados con Zod antes de ejecutar) ----------

export const ListarFuentesInput = z.object({});
export const BuscarTitularInput = z.object({
  fuente_id: z.string().describe('Identificador de la fuente, por ejemplo "crm"'),
  nombre: z.string().optional().describe('Nombre completo o parcial'),
  rut: z.string().optional().describe('RUT con o sin puntos'),
  email: z.string().optional().describe('Correo electrónico'),
  telefono: z.string().optional().describe('Teléfono, si se conoce por otro registro confirmado'),
});
export const ObtenerRegistroInput = z.object({
  fuente_id: z.string(),
  registro_id: z.string(),
});
export const CalcularPlazoInput = z.object({ solicitud_id: z.string() });
export const ProponerRespuestaInput = z.object({
  hallazgos: z
    .array(
      z.object({
        fuente_id: z.string(),
        registro_id: z.string(),
        confianza: z
          .number()
          .min(0)
          .max(1)
          .describe('Confianza de que sea la misma persona, de 0 a 1'),
        dudoso: z.boolean().describe('true si el encargado debe confirmar la coincidencia'),
        motivo: z.string().describe('Por qué se considera (o no) la misma persona'),
      }),
    )
    .describe('Todos los registros considerados, incluidos los dudosos'),
  borrador: z
    .string()
    .min(1)
    .describe('Texto completo de la respuesta al titular, con citas [fuente:registro]'),
  acciones: z
    .array(
      z.object({
        fuente_id: z.string(),
        registro_id: z.string(),
        accion: z.string().describe('Acción propuesta, por ejemplo "Eliminar contacto"'),
        justificacion: z.string(),
      }),
    )
    .describe('Acciones propuestas por fuente. Solo se proponen; el agente nunca las ejecuta.'),
  finalidades: z.array(z.string()).describe('Finalidades del tratamiento informadas al titular'),
  destinatarios: z.array(z.string()).describe('Destinatarios o categorías de destinatarios'),
  conservacion: z.string().describe('Plazo de conservación informado'),
});
export type ProponerRespuesta = z.infer<typeof ProponerRespuestaInput>;

function esquemaJson(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const { $schema: _omitido, ...resto } = z.toJSONSchema(schema) as Record<string, unknown>;
  return resto as Anthropic.Tool.InputSchema;
}

const DEF = [
  {
    name: 'listar_fuentes',
    description:
      'Devuelve las fuentes de datos disponibles de la empresa, con su formato y los campos que contienen (indicando cuáles son datos sensibles). Úsala al comienzo.',
    schema: ListarFuentesInput,
  },
  {
    name: 'buscar_titular',
    description:
      'Busca a una persona en UNA fuente por nombre, RUT, correo o teléfono. La búsqueda tolera tildes, mayúsculas y RUT con o sin puntos. Devuelve coincidencias con un resumen breve, la confianza y si son dudosas. Entrega todos los identificadores que tengas en la misma llamada.',
    schema: BuscarTitularInput,
  },
  {
    name: 'obtener_registro',
    description:
      'Trae el detalle de un registro encontrado. Los datos sensibles de salud vienen ocultos: se indica que existen pero no su contenido.',
    schema: ObtenerRegistroInput,
  },
  {
    name: 'calcular_plazo',
    description:
      'Calcula los días corridos que quedan para responder la solicitud y su fecha de vencimiento.',
    schema: CalcularPlazoInput,
  },
  {
    name: 'proponer_respuesta',
    description:
      'Entrega el resultado final: hallazgos, borrador de respuesta al titular y acciones propuestas por fuente. Llámala una sola vez, al terminar la investigación. No envía nada: un encargado humano revisa y aprueba.',
    schema: ProponerRespuestaInput,
  },
] as const;

export type NombreHerramienta = (typeof DEF)[number]['name'];

/** Definiciones para la API. No existen herramientas para enviar, borrar ni modificar datos. */
export const HERRAMIENTAS: Anthropic.Tool[] = DEF.map((d) => ({
  name: d.name,
  description: d.description,
  input_schema: esquemaJson(d.schema),
  // Las entradas se transmiten a medida que se generan; por eso se validan con Zod antes de ejecutar.
  eager_input_streaming: true,
}));

export const ESQUEMAS_ENTRADA: Record<NombreHerramienta, z.ZodType> = Object.fromEntries(
  DEF.map((d) => [d.name, d.schema]),
) as unknown as Record<NombreHerramienta, z.ZodType>;

// ---------- Ejecución ----------

export interface ContextoHerramientas {
  solicitud: Solicitud;
  conectores: Connector[];
  alEvento: AlEvento;
  /** Registros traídos durante la investigación, para completar los hallazgos localmente. */
  registros: Map<string, RegistroFuente>;
}

export interface ResultadoHerramienta {
  contenido: string;
  error: boolean;
  resumen: string;
  propuesta?: PropuestaRespuesta;
}

const clave = (fuente: string, registro: string) => `${fuente}:${registro}`;
const OCULTO = '[DATO SENSIBLE DE SALUD: existe información; el detalle no se envía al modelo]';

/** Aplana un registro a pares campo → texto para mostrarlo y citarlo. */
export function aplanarDatos(datos: Record<string, unknown>): Record<string, string> {
  const texto = (v: unknown): string => {
    if (v == null) return '';
    if (Array.isArray(v)) return v.map(texto).join('; ');
    if (typeof v === 'object')
      return Object.values(v as Record<string, unknown>)
        .map(texto)
        .filter(Boolean)
        .join(' · ');
    return String(v);
  };
  return Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, texto(v)]));
}

/** Copia del registro para el modelo, sin el contenido de los datos sensibles (RNF-03). */
export function registroParaModelo(r: RegistroFuente): Record<string, unknown> {
  const datos = { ...r.datos };
  for (const campo of r.camposSensibles) {
    if (datos[campo] !== undefined && datos[campo] !== '' && datos[campo] !== '0')
      datos[campo] = OCULTO;
  }
  return datos;
}

function conector(ctx: ContextoHerramientas, id: string): Connector {
  const c = ctx.conectores.find((x) => x.id === id);
  if (!c) throw new ErrorFuente(id, `La fuente "${id}" no existe. Usa listar_fuentes.`, false);
  return c;
}

function reintentar<T>(ctx: ContextoHerramientas, fuenteId: string, fn: () => Promise<T>) {
  return conReintentos(fn, {
    alReintentar: (intento, error) =>
      ctx.alEvento({
        tipo: 'reintento',
        fuenteId,
        intento,
        mensaje: error instanceof Error ? error.message : String(error),
      }),
  });
}

/** Completa los hallazgos del modelo con los datos reales del registro, sin pasar por el modelo. */
export function completarPropuesta(
  entrada: ProponerRespuesta,
  ctx: ContextoHerramientas,
): PropuestaRespuesta {
  const hallazgos: Hallazgo[] = entrada.hallazgos.map((h) => {
    const r = ctx.registros.get(clave(h.fuente_id, h.registro_id));
    return {
      fuenteId: h.fuente_id,
      registroId: h.registro_id,
      datos: r ? aplanarDatos(r.datos) : {},
      confianza: h.confianza,
      dudoso: h.dudoso,
      motivo: h.motivo,
      contieneSensibles: r
        ? r.camposSensibles.some((c) => r.datos[c] && r.datos[c] !== '0')
        : false,
    };
  });
  return PropuestaRespuestaSchema.parse({
    hallazgos,
    borrador: entrada.borrador,
    acciones: entrada.acciones.map((a) => ({
      fuenteId: a.fuente_id,
      registroId: a.registro_id,
      accion: a.accion,
      justificacion: a.justificacion,
    })),
    finalidades: entrada.finalidades,
    destinatarios: entrada.destinatarios,
    conservacion: entrada.conservacion,
  });
}

export async function ejecutarHerramienta(
  nombre: string,
  entradaCruda: unknown,
  ctx: ContextoHerramientas,
): Promise<ResultadoHerramienta> {
  const schema = ESQUEMAS_ENTRADA[nombre as NombreHerramienta];
  if (!schema)
    return {
      contenido: `Herramienta desconocida: ${nombre}`,
      error: true,
      resumen: 'Herramienta desconocida',
    };
  const parsed = schema.safeParse(entradaCruda);
  if (!parsed.success) {
    return {
      contenido: JSON.stringify({
        INVALID_JSON: JSON.stringify(entradaCruda),
        error: parsed.error.message,
      }),
      error: true,
      resumen: 'Entrada inválida',
    };
  }
  try {
    switch (nombre as NombreHerramienta) {
      case 'listar_fuentes': {
        const esquemas = await Promise.all(
          ctx.conectores
            .filter((c) => c.estado === 'conectado')
            .map((c) =>
              reintentar(ctx, c.id, () => c.describirEsquema()).catch((e: unknown) => ({
                fuenteId: c.id,
                error: e instanceof Error ? e.message : String(e),
              })),
            ),
        );
        const salida = esquemas.map((e) =>
          'error' in e
            ? e
            : {
                id: e.fuenteId,
                nombre: e.nombre,
                se_presenta_como: e.sePresentaComo,
                formato: e.formato,
                entidad: e.entidad,
                registros: e.totalRegistros,
                campos: e.campos.map((c) => `${c.nombre}${c.sensible ? ' (sensible)' : ''}`),
              },
        );
        return {
          contenido: JSON.stringify(salida),
          error: false,
          resumen: `${salida.length} fuentes disponibles`,
        };
      }
      case 'buscar_titular': {
        const e = parsed.data as z.infer<typeof BuscarTitularInput>;
        const c = conector(ctx, e.fuente_id);
        const r = await reintentar(ctx, c.id, () =>
          c.buscarTitular({ nombre: e.nombre, rut: e.rut, email: e.email, telefono: e.telefono }),
        );
        const seguras = r.filter((x) => !x.dudoso).length;
        return {
          contenido: JSON.stringify(r.slice(0, 10)),
          error: false,
          resumen:
            r.length === 0
              ? `${c.nombre}: sin coincidencias`
              : `${c.nombre}: ${r.length} coincidencia(s), ${seguras} segura(s)`,
        };
      }
      case 'obtener_registro': {
        const e = parsed.data as z.infer<typeof ObtenerRegistroInput>;
        const c = conector(ctx, e.fuente_id);
        const r = await reintentar(ctx, c.id, () => c.obtenerRegistro(e.registro_id));
        if (!r)
          return {
            contenido: 'Registro no encontrado',
            error: true,
            resumen: `${c.nombre}: registro no encontrado`,
          };
        ctx.registros.set(clave(c.id, r.id), r);
        const sensibles = r.camposSensibles.filter((x) => r.datos[x] && r.datos[x] !== '0');
        return {
          contenido: JSON.stringify({ fuente: c.id, registro: r.id, datos: registroParaModelo(r) }),
          error: false,
          resumen: `${c.nombre}: registro ${r.id}${sensibles.length ? ' (contiene datos sensibles ocultos al modelo)' : ''}`,
        };
      }
      case 'calcular_plazo': {
        const p = calcularPlazo(ctx.solicitud.recibidaEn, ctx.solicitud.prorroga);
        return {
          contenido: JSON.stringify({
            dias_restantes: p.diasRestantes,
            vence: p.vence,
            plazo_total: p.plazoTotal,
          }),
          error: false,
          resumen: `Quedan ${p.diasRestantes} días (vence ${p.vence})`,
        };
      }
      case 'proponer_respuesta': {
        const propuesta = completarPropuesta(parsed.data as ProponerRespuesta, ctx);
        return {
          contenido: 'Propuesta recibida. Queda pendiente de revisión y aprobación humana.',
          error: false,
          resumen: `Borrador con ${propuesta.hallazgos.length} hallazgo(s) y ${propuesta.acciones.length} acción(es) propuesta(s)`,
          propuesta,
        };
      }
    }
  } catch (error) {
    // Un error en una fuente no detiene la investigación (RNF-11): vuelve al modelo como resultado de error.
    const mensaje = error instanceof Error ? error.message : String(error);
    return { contenido: `Error: ${mensaje}`, error: true, resumen: mensaje };
  }
  return { contenido: 'Sin resultado', error: true, resumen: 'Sin resultado' };
}
