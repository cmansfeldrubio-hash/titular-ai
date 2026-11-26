import type { UsoTokens } from '@ley/domain';

export interface InfoModelo {
  id: string;
  etiqueta: string;
  descripcion: string;
  /** Precios en USD por millón de tokens. */
  precio: { entrada: number; salida: number; cacheLectura: number; cacheEscritura: number };
  /** Admite `thinking: {type: "adaptive"}` y `output_config.effort`. */
  adaptativo: boolean;
  /** Admite el respaldo del servidor ante rechazos (`fallbacks: "default"`). */
  respaldo: boolean;
}

export const MODELOS: InfoModelo[] = [
  {
    id: 'claude-sonnet-5-5',
    etiqueta: 'Claude Sonnet 5.5 (recomendado)',
    descripcion: 'Por defecto para la demo: buen equilibrio entre calidad y costo.',
    precio: { entrada: 2, salida: 10, cacheLectura: 0.1, cacheEscritura: 2.5 },
    adaptativo: true,
    respaldo: true,
  },
  {
    id: 'claude-haiku-4-5',
    etiqueta: 'Claude Haiku 4.5 (económico)',
    descripcion: 'Opción económica indicada en los requerimientos, para pruebas de desarrollo.',
    precio: { entrada: 1, salida: 5, cacheLectura: 0.1, cacheEscritura: 1.25 },
    adaptativo: false,
    respaldo: false,
  },
  {
    id: 'claude-haiku-5-5',
    etiqueta: 'Claude Haiku 5.5 (el más económico)',
    descripcion: 'Haiku de la generación actual; más barato que Haiku 4.5.',
    precio: { entrada: 0.1, salida: 0.5, cacheLectura: 0.01, cacheEscritura: 0.125 },
    adaptativo: true,
    respaldo: false,
  },
];

export const MODELO_POR_DEFECTO = 'claude-sonnet-5-5';
export const MODELO_DEMO = 'demo';

export function infoModelo(id: string): InfoModelo {
  return MODELOS.find((m) => m.id === id) ?? MODELOS[0]!;
}

export interface UsoApi {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function usoVacio(modelo: string): UsoTokens {
  return { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0, costoUsd: 0, modelo };
}

/** Suma el uso de una respuesta y recalcula el costo estimado (RK-07). */
export function acumularUso(total: UsoTokens, uso: UsoApi): UsoTokens {
  const entrada = total.entrada + uso.input_tokens;
  const salida = total.salida + uso.output_tokens;
  const cacheLectura = total.cacheLectura + (uso.cache_read_input_tokens ?? 0);
  const cacheEscritura = total.cacheEscritura + (uso.cache_creation_input_tokens ?? 0);
  return {
    ...total,
    entrada,
    salida,
    cacheLectura,
    cacheEscritura,
    costoUsd: costo(total.modelo, entrada, salida, cacheLectura, cacheEscritura),
  };
}

export function costo(
  modelo: string,
  entrada: number,
  salida: number,
  cacheLectura = 0,
  cacheEscritura = 0,
): number {
  if (modelo === MODELO_DEMO) return 0;
  const p = infoModelo(modelo).precio;
  return (
    (entrada * p.entrada +
      salida * p.salida +
      cacheLectura * p.cacheLectura +
      cacheEscritura * p.cacheEscritura) /
    1_000_000
  );
}
