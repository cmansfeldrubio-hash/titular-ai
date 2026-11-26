import { renderToBuffer } from '@react-pdf/renderer';
import { calcularMetricas, type Solicitud } from '@ley/domain';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { ReporteCumplimientoPdf } from './cumplimiento';
import { bitacoraCsv, exportarRegistroXlsx, MARCA } from './index';
import { RespuestaTitularPdf } from './respuesta';

const empresa = {
  nombre: 'Comercial Los Aromos SpA',
  rut: '76.543.210-3',
  rubro: 'Ferretería',
  direccion: 'Calle Ficticia 1',
  encargado: { nombre: 'Encargado', email: 'e@aromos.example', cargo: 'Encargado' },
};
const solicitud: Solicitud = {
  id: 'SOL-001',
  titular: { nombre: 'José Pérez Soto', email: 'jose@example.com' },
  derecho: 'acceso',
  recibidaEn: '2026-11-20T12:00:00Z',
  canal: 'simulada',
  asunto: 'Acceso',
  mensaje: '...',
  estado: 'enviada',
  respondidaEn: '2026-11-25T12:00:00Z',
  clasificadaPor: 'semilla',
  revisiones: {},
  versionBorrador: 1,
};
const propuesta = {
  hallazgos: [
    {
      fuenteId: 'rrhh',
      registroId: 'rh-001',
      datos: { nombre: 'José', detalle_licencias: 'Licencia X' },
      confianza: 0.98,
      dudoso: false,
      motivo: 'RUT',
      contieneSensibles: true,
    },
  ],
  borrador: 'Estimado José:\n\nTexto.',
  acciones: [],
  finalidades: ['Gestión laboral'],
  destinatarios: ['AFP'],
  conservacion: 'Según la ley',
};

describe('PDF', () => {
  it('genera la respuesta al titular', async () => {
    const buf = await renderToBuffer(
      <RespuestaTitularPdf
        empresa={empresa}
        solicitud={solicitud}
        propuesta={propuesta}
        texto={propuesta.borrador}
        hallazgos={propuesta.hallazgos}
        fecha={new Date('2026-11-25T12:00:00Z')}
        nombresFuente={{ rrhh: 'Recursos humanos' }}
      />,
    );
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(2000);
  }, 30_000);

  it('genera el reporte de cumplimiento', async () => {
    const buf = await renderToBuffer(
      <ReporteCumplimientoPdf
        empresa={empresa}
        generado={new Date()}
        actividades={[]}
        solicitudes={[solicitud]}
        metricas={calcularMetricas([solicitud])}
        bitacora={[
          {
            id: '1',
            fecha: '2026-11-25T12:00:00Z',
            actor: 'agente',
            tipo: 'busqueda',
            detalle: 'x',
          },
        ]}
        nombresFuente={{}}
      />,
    );
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  }, 30_000);
});

describe('exportaciones', () => {
  it('XLSX con la marca y dos hojas', () => {
    const libro = XLSX.read(exportarRegistroXlsx([], [solicitud]), { type: 'array' });
    expect(libro.SheetNames).toEqual(['Actividades', 'Solicitudes']);
    expect(libro.Sheets.Solicitudes!.A1!.v).toContain(MARCA);
  });
  it('CSV de la bitácora', () => {
    const csv = bitacoraCsv([
      {
        id: '1',
        fecha: '2026-11-25T12:00:00Z',
        actor: 'persona',
        tipo: 'aprobacion',
        detalle: 'Aprobó, con "nota"',
      },
    ]);
    expect(csv.split('\n')[2]).toContain('"Aprobó, con ""nota"""');
  });
});
