import { NOMBRE_FUENTE } from '@ley/agent';

export { NOMBRE_FUENTE };

/** Descarga un archivo generado en el navegador, sin pasar por el servidor. */
export function descargar(contenido: Blob | Uint8Array | string, nombre: string, tipo?: string) {
  const blob =
    contenido instanceof Blob
      ? contenido
      : new Blob([contenido as BlobPart], { type: tipo ?? 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function blobABase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function usd(n: number): string {
  return `US$ ${n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: n > 0 && n < 0.01 ? 4 : 2 })}`;
}

/** Fecha AAAA-MM-DD en la zona de Santiago, para nombres de archivo. */
export function fechaArchivo(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(d);
}

/** Número con formato chileno (coma decimal). */
export function numero(n: number): string {
  return n.toLocaleString('es-CL', { maximumFractionDigits: 1 });
}
