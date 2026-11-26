import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { conReintentos, type Connector, type EsquemaFuente } from '@ley/connectors';
import type { ActividadTratamiento, UsoTokens } from '@ley/domain';
import { z } from 'zod';
import { categoriaDeCampo, TRATAMIENTO_POR_FUENTE } from './catalogo';
import { registroParaModelo } from './herramientas';
import { acumularUso, usoVacio } from './modelos';

export interface MuestraFuente {
  esquema: EsquemaFuente;
  muestras: Record<string, unknown>[];
}

/** Recorre esquemas y muestras de cada fuente; las fuentes con error se omiten (RNF-11). */
export async function leerFuentes(
  conectores: Connector[],
  alProgreso?: (texto: string) => void,
): Promise<MuestraFuente[]> {
  const resultado: MuestraFuente[] = [];
  await Promise.all(
    conectores
      .filter((c) => c.estado === 'conectado')
      .map(async (c) => {
        try {
          const esquema = await conReintentos(() => c.describirEsquema(), {
            alReintentar: (i) => alProgreso?.(`${c.nombre}: reintento ${i}`),
          });
          const muestras = await conReintentos(() => c.muestras(2));
          resultado.push({ esquema, muestras: muestras.map(registroParaModelo) });
          alProgreso?.(`${c.nombre}: esquema y ${muestras.length} muestras leídas`);
        } catch (e) {
          alProgreso?.(
            `${c.nombre}: no se pudo leer (${e instanceof Error ? e.message : String(e)})`,
          );
        }
      }),
  );
  return resultado.sort((a, b) => a.esquema.fuenteId.localeCompare(b.esquema.fuenteId));
}

/** Propuesta del registro de actividades por reglas (modo demostración). */
export function proponerActividadesPorReglas(fuentes: MuestraFuente[]): ActividadTratamiento[] {
  return fuentes.map(({ esquema }) => {
    const categorias = [
      ...new Set(
        esquema.campos
          .filter((c) => c.personal)
          .map((c) => categoriaDeCampo(c.nombre))
          .filter((c): c is string => !!c),
      ),
    ];
    const t = TRATAMIENTO_POR_FUENTE[esquema.fuenteId];
    return {
      id: `act-${esquema.fuenteId}`,
      fuenteId: esquema.fuenteId,
      nombre: `${esquema.nombre}: ${esquema.entidad.toLowerCase()}`,
      categorias,
      datosSensibles: esquema.campos.some((c) => c.sensible),
      finalidad: t?.finalidad ?? 'Por determinar',
      accesos: t?.accesos ?? 'Por determinar',
      conservacion: t?.conservacion ?? 'Por determinar',
      estado: 'sugerido',
    };
  });
}

const ActividadesSchema = z.object({
  actividades: z.array(
    z.object({
      fuente_id: z.string(),
      nombre: z.string(),
      categorias: z.array(z.string()),
      datos_sensibles: z.boolean(),
      finalidad_probable: z.string(),
      quien_accede: z.string(),
      conservacion_sugerida: z.string(),
    }),
  ),
});

/** El agente propone el registro de actividades de tratamiento a partir de esquemas y muestras (RF-04, RF-05). */
export async function proponerActividadesConModelo(
  cliente: Anthropic,
  modelo: string,
  fuentes: MuestraFuente[],
): Promise<{ actividades: ActividadTratamiento[]; uso: UsoTokens }> {
  const r = await cliente.messages.parse({
    model: modelo,
    max_tokens: 8000,
    system:
      'Eres asesor de cumplimiento de la Ley 21.719 de Chile. A partir del esquema y dos muestras de cada fuente de datos de una empresa ficticia, propone una actividad de tratamiento por fuente: categorías de datos personales, si hay datos sensibles (salud, por ejemplo), finalidad probable, quién accede y un plazo de conservación sugerido. Escribe en español de Chile, breve. Los datos sensibles de las muestras vienen ocultos.',
    messages: [{ role: 'user', content: JSON.stringify(fuentes) }],
    output_config: { format: zodOutputFormat(ActividadesSchema) },
  });
  if (r.stop_reason === 'refusal' || !r.parsed_output) {
    return {
      actividades: proponerActividadesPorReglas(fuentes),
      uso: acumularUso(usoVacio(modelo), r.usage),
    };
  }
  return {
    actividades: r.parsed_output.actividades.map((a) => ({
      id: `act-${a.fuente_id}`,
      fuenteId: a.fuente_id,
      nombre: a.nombre,
      categorias: a.categorias,
      datosSensibles: a.datos_sensibles,
      finalidad: a.finalidad_probable,
      accesos: a.quien_accede,
      conservacion: a.conservacion_sugerida,
      estado: 'sugerido' as const,
    })),
    uso: acumularUso(usoVacio(modelo), r.usage),
  };
}
