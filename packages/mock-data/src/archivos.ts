import * as XLSX from 'xlsx';
import type { EmpresaFicticia } from './tipos';

/** Convierte filas a CSV con separador coma y comillas dobles (RFC 4180). */
export function aCsv<T extends object>(filas: T[]): string {
  if (filas.length === 0) return '';
  const columnas = Object.keys(filas[0]!);
  const celda = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    columnas.join(','),
    ...filas.map((f) => columnas.map((c) => celda((f as Record<string, unknown>)[c])).join(',')),
  ].join('\n');
}

/** Lee un CSV simple (RFC 4180) a objetos. */
export function leerCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n') {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else if (c !== '\r') celda += c;
  }
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  const [cabecera, ...resto] = filas;
  if (!cabecera) return [];
  return resto.map((f) => Object.fromEntries(cabecera.map((c, i) => [c, f[i] ?? ''])));
}

/** Arma el libro XLSX de las planillas de ventas: una hoja por vendedor. */
export function planillasXlsx(empresa: EmpresaFicticia): Uint8Array {
  const libro = XLSX.utils.book_new();
  const porVendedor = new Map<string, typeof empresa.planillas>();
  for (const fila of empresa.planillas) {
    porVendedor.set(fila.Vendedor, [...(porVendedor.get(fila.Vendedor) ?? []), fila]);
  }
  for (const [vendedor, filas] of porVendedor) {
    const hoja = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(libro, hoja, vendedor.slice(0, 31));
  }
  return new Uint8Array(XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/** Archivos de las fuentes basadas en archivos, tal como se guardan en el repositorio. */
export function archivosFuentes(empresa: EmpresaFicticia) {
  return {
    'planillas-ventas.xlsx': planillasXlsx(empresa),
    'rrhh-remuneraciones.csv': aCsv(empresa.rrhh),
    'marketing-newsletter.csv': aCsv(empresa.marketing),
  };
}
