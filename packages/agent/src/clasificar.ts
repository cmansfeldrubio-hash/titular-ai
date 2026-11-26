import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  DerechoSchema,
  extraerEmails,
  extraerRuts,
  normalizarTexto,
  type Derecho,
  type IdentificacionTitular,
  type UsoTokens,
} from '@ley/domain';
import { z } from 'zod';
import { acumularUso, usoVacio } from './modelos';

export interface Clasificacion {
  derecho: Derecho;
  titular: IdentificacionTitular;
  confianza: 'alta' | 'media' | 'baja';
  por: 'agente' | 'reglas';
  uso?: UsoTokens;
}

const PALABRAS: [Derecho, RegExp][] = [
  ['portabilidad', /portabilidad|formato estructurado|otro proveedor|copia de mis datos/],
  ['supresion', /supresion|suprim|elimin|borr/],
  ['rectificacion', /rectifica|corregir|actualizar|cambiaron|equivocad/],
  ['oposicion', /oposicion|me opongo|no quiero recibir|publicidad|marketing/],
  ['bloqueo', /bloqueo|bloquear|suspender/],
  ['acceso', /acceso|acceder|que datos|qué datos|informacion que tienen/],
];

/** Clasificación por reglas: se usa en modo demostración o si el modelo no responde (RF-10). */
export function clasificarPorReglas(
  texto: string,
  remitente?: { nombre?: string; email?: string },
): Clasificacion {
  const t = normalizarTexto(texto);
  const encontrados = PALABRAS.filter(([, re]) => re.test(t)).map(([d]) => d);
  const derecho = encontrados[0] ?? 'acceso';
  const nombre =
    texto.match(
      /(?:[Mm]i nombre es|[Mm]e llamo|[Ss]oy)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+){1,4})/,
    )?.[1] ??
    remitente?.nombre ??
    'Titular sin identificar';
  return {
    derecho,
    titular: {
      nombre,
      rut: extraerRuts(texto)[0],
      email: extraerEmails(texto)[0] ?? remitente?.email,
    },
    confianza: encontrados.length === 1 ? 'alta' : encontrados.length > 1 ? 'media' : 'baja',
    por: 'reglas',
  };
}

const ClasificacionSchema = z.object({
  derecho: DerechoSchema,
  nombre: z.string(),
  rut: z.string().nullable(),
  email: z.string().nullable(),
  confianza: z.enum(['alta', 'media', 'baja']),
});

/** Clasifica con el modelo usando salida estructurada; si falla, usa las reglas. */
export async function clasificarConModelo(
  cliente: Anthropic,
  modelo: string,
  texto: string,
  remitente?: { nombre?: string; email?: string },
): Promise<Clasificacion> {
  const r = await cliente.messages.parse({
    model: modelo,
    max_tokens: 2000,
    system:
      'Clasificas correos de titulares de datos según la Ley 21.719 de Chile. Identifica el derecho ejercido (acceso, rectificacion, supresion, oposicion, portabilidad o bloqueo) y extrae nombre, RUT y correo del titular tal como aparecen en el texto. Si el texto no trae un correo, usa el del remitente. Usa null si un dato no aparece.',
    messages: [
      {
        role: 'user',
        content: `Remitente: ${remitente?.nombre ?? ''} <${remitente?.email ?? ''}>\n\nCorreo:\n"""\n${texto}\n"""`,
      },
    ],
    output_config: { format: zodOutputFormat(ClasificacionSchema) },
  });
  const p = r.parsed_output;
  if (r.stop_reason === 'refusal' || !p) return clasificarPorReglas(texto, remitente);
  return {
    derecho: p.derecho,
    titular: { nombre: p.nombre, rut: p.rut ?? undefined, email: p.email ?? remitente?.email },
    confianza: p.confianza,
    por: 'agente',
    uso: acumularUso(usoVacio(modelo), r.usage),
  };
}
