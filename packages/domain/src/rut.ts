/** Utilidades de RUT chileno: dígito verificador, normalización y formato. */

/** Calcula el dígito verificador (módulo 11) de un cuerpo de RUT. */
export function calcularDv(cuerpo: number | string): string {
  const digitos = String(cuerpo).replace(/\D/g, '');
  let suma = 0;
  let factor = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    suma += Number(digitos[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

/** Deja el RUT como `12345678K`: sin puntos, sin guion y en mayúsculas. */
export function normalizarRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

export function esRutValido(rut: string): boolean {
  const limpio = normalizarRut(rut);
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  return calcularDv(cuerpo) === dv;
}

/** Formato con puntos y guion: `12.345.678-K`. */
export function formatearRut(rut: string, conPuntos = true): string {
  const limpio = normalizarRut(rut);
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const cuerpoFmt = conPuntos ? cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : cuerpo;
  return `${cuerpoFmt}-${dv}`;
}

/** Enmascara un RUT dejando visibles solo los últimos 4 caracteres útiles. */
export function enmascararRut(rut: string): string {
  const limpio = normalizarRut(rut);
  return `••••${limpio.slice(-4, -1)}-${limpio.slice(-1)}`;
}

/** Busca RUT dentro de un texto libre (con o sin puntos). */
export function extraerRuts(texto: string): string[] {
  const re = /\b(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])\b/g;
  return [...texto.matchAll(re)].map((m) => m[1] ?? '').filter(esRutValido);
}
