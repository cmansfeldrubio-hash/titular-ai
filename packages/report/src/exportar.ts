import {
  calcularPlazo,
  DERECHO_ETIQUETA,
  ESTADO_ETIQUETA,
  formatearFecha,
  formatearFechaHora,
  type ActividadTratamiento,
  type EventoBitacora,
  type Hallazgo,
  type Solicitud,
} from '@ley/domain';
import * as XLSX from 'xlsx';
import { MARCA } from './estilos';

/** Hoja con la marca en la primera fila (RF-24) y los datos desde la tercera. */
function hoja(titulo: string, filas: object[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([[`${titulo} · ${MARCA}`]]);
  XLSX.utils.sheet_add_json(ws, filas, { origin: 'A3' });
  return ws;
}

function libroABytes(libro: XLSX.WorkBook): Uint8Array {
  return new Uint8Array(XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

export function filasActividades(
  actividades: ActividadTratamiento[],
  nombres: Record<string, string> = {},
) {
  return actividades.map((a) => ({
    Fuente: nombres[a.fuenteId] ?? a.fuenteId,
    Actividad: a.nombre,
    'Categorías de datos': a.categorias.join(', '),
    'Datos sensibles': a.datosSensibles ? 'Sí' : 'No',
    Finalidad: a.finalidad,
    'Quién accede': a.accesos,
    'Plazo de conservación': a.conservacion,
    Estado: a.estado === 'confirmado' ? 'Confirmado' : 'Sugerido por el agente',
  }));
}

export function filasSolicitudes(solicitudes: Solicitud[], ahora = new Date()) {
  return solicitudes.map((s) => {
    const p = calcularPlazo(s.recibidaEn, s.prorroga, ahora);
    return {
      ID: s.id,
      Titular: s.titular.nombre,
      Derecho: DERECHO_ETIQUETA[s.derecho],
      Canal: s.canal === 'gmail' ? 'Gmail' : 'Formulario web',
      Recibida: formatearFecha(s.recibidaEn),
      Vence: formatearFecha(`${p.vence}T12:00:00Z`),
      'Días restantes': s.respondidaEn ? '' : p.diasRestantes,
      Prórroga: s.prorroga ? s.prorroga.motivo : '',
      Estado: ESTADO_ETIQUETA[s.estado],
      Respondida: s.respondidaEn ? formatearFecha(s.respondidaEn) : '',
    };
  });
}

/** Exportación a XLSX del registro de actividades y de las solicitudes (RF-23). */
export function exportarRegistroXlsx(
  actividades: ActividadTratamiento[],
  solicitudes: Solicitud[],
  nombres: Record<string, string> = {},
): Uint8Array {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    libro,
    hoja('Registro de actividades', filasActividades(actividades, nombres)),
    'Actividades',
  );
  XLSX.utils.book_append_sheet(
    libro,
    hoja('Solicitudes', filasSolicitudes(solicitudes)),
    'Solicitudes',
  );
  return libroABytes(libro);
}

/** Datos del titular en formato estructurado, para el derecho de portabilidad. */
export function exportarDatosTitularXlsx(
  hallazgos: Hallazgo[],
  nombres: Record<string, string> = {},
): Uint8Array {
  const libro = XLSX.utils.book_new();
  const filas = hallazgos.flatMap((h) =>
    Object.entries(h.datos).map(([campo, valor]) => ({
      Fuente: nombres[h.fuenteId] ?? h.fuenteId,
      Registro: h.registroId,
      Campo: campo,
      Valor: valor,
    })),
  );
  XLSX.utils.book_append_sheet(libro, hoja('Datos del titular', filas), 'Datos');
  return libroABytes(libro);
}

/** Bitácora exportable a CSV (RF-19). */
export function bitacoraCsv(eventos: EventoBitacora[]): string {
  const celda = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const filas = eventos.map((e) =>
    [formatearFechaHora(e.fecha), e.actor, e.tipo, e.solicitudId ?? '', e.detalle]
      .map(celda)
      .join(','),
  );
  return [`# ${MARCA}`, 'fecha,actor,tipo,solicitud,detalle', ...filas].join('\n');
}
