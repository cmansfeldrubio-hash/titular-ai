import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';
import { ReporteCumplimientoPdf, type DatosCumplimiento } from './cumplimiento';
import { RespuestaTitularPdf, type DatosRespuesta } from './respuesta';

export * from './exportar';
export { MARCA } from './estilos';
export { RespuestaTitularPdf, ReporteCumplimientoPdf };
export type { DatosRespuesta, DatosCumplimiento };

/** Genera el PDF de respuesta al titular como Blob (navegador). */
export function generarPdfRespuesta(datos: DatosRespuesta): Promise<Blob> {
  return pdf(createElement(RespuestaTitularPdf, datos) as Parameters<typeof pdf>[0]).toBlob();
}

/** Genera el PDF del reporte de cumplimiento como Blob (navegador). */
export function generarPdfCumplimiento(datos: DatosCumplimiento): Promise<Blob> {
  return pdf(createElement(ReporteCumplimientoPdf, datos) as Parameters<typeof pdf>[0]).toBlob();
}
