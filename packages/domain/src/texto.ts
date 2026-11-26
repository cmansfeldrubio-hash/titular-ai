/** Normaliza texto para comparar: sin tildes, minúsculas y espacios simples. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokensNombre(nombre: string): string[] {
  return normalizarTexto(nombre)
    .split(' ')
    .filter((t) => t.length > 1 && !['de', 'del', 'la', 'los', 'las'].includes(t));
}

/**
 * Similitud entre dos nombres (0 a 1), tolerante a tildes, mayúsculas y orden
 * de los apellidos. Usa la proporción de tokens del nombre más corto presentes en el otro.
 */
export function similitudNombre(a: string, b: string): number {
  const ta = tokensNombre(a);
  const tb = tokensNombre(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const setLargo = new Set(largo);
  const comunes = corto.filter((t) => setLargo.has(t)).length;
  return comunes / corto.length;
}

export function extraerEmails(texto: string): string[] {
  return [...texto.matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)].map((m) => m[0].toLowerCase());
}

export function generarId(prefijo: string): string {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefijo}_${Date.now().toString(36)}${aleatorio}`;
}
