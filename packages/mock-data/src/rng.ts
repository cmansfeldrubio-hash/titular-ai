/** Generador pseudoaleatorio con semilla fija (mulberry32): misma semilla, misma empresa (RD-03). */
export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
}

export function crearRng(semilla: number): Rng {
  let a = semilla >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)] as T;
  const shuffle = <T>(items: readonly T[]): T[] => {
    const copia = [...items];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = int(0, i);
      [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
    }
    return copia;
  };
  return { next, int, pick, chance: (p) => next() < p, shuffle };
}
