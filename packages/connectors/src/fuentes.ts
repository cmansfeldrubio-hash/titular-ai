import { aCsv, leerCsv, planillasXlsx, type EmpresaFicticia } from '@ley/mock-data';
import * as XLSX from 'xlsx';
import { ConectorSimulado, SIMULACION_POR_DEFECTO, type OpcionesSimulacion } from './simulado';
import type { CampoEsquema, RegistroFuente } from './tipos';

const c = (
  nombre: string,
  tipo: CampoEsquema['tipo'],
  descripcion: string,
  personal = true,
  sensible = false,
): CampoEsquema => ({ nombre, tipo, descripcion, personal, sensible });

const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? undefined : String(v));

export const FUENTES_SIMULADAS = [
  'crm',
  'erp',
  'tienda',
  'planillas',
  'rrhh',
  'marketing',
] as const;
export type FuenteSimuladaId = (typeof FUENTES_SIMULADAS)[number];

/** Crea los seis conectores simulados de la empresa ficticia (sección 6). */
export function crearConectoresSimulados(
  empresa: EmpresaFicticia,
  simulacion: OpcionesSimulacion = SIMULACION_POR_DEFECTO,
): ConectorSimulado[] {
  const reg = (
    fuenteId: string,
    id: string,
    datos: object,
    camposSensibles: string[] = [],
  ): RegistroFuente => ({
    id,
    fuenteId,
    datos: datos as Record<string, unknown>,
    camposSensibles,
  });

  return [
    new ConectorSimulado(
      {
        id: 'crm',
        nombre: 'CRM',
        sePresentaComo: 'Plataforma de ventas tipo HubSpot',
        formato: 'JSON por API',
        entidad: 'Contactos (clientes y prospectos)',
        campos: [
          c('id', 'texto', 'Identificador del contacto', false),
          c('nombre_completo', 'texto', 'Nombre del contacto'),
          c('email', 'texto', 'Correo electrónico'),
          c('telefono', 'texto', 'Teléfono móvil'),
          c('etapa', 'texto', 'Cliente o prospecto', false),
          c('propietario', 'texto', 'Vendedor responsable', false),
          c('creado', 'fecha', 'Fecha de creación', false),
          c('historial', 'lista', 'Interacciones comerciales: fecha, tipo y nota'),
        ],
        cargarRegistros: () => empresa.crm.map((r) => reg('crm', r.id, r)),
        identidad: (r) => ({
          nombre: s(r.datos.nombre_completo),
          email: s(r.datos.email),
          telefono: s(r.datos.telefono),
        }),
        resumen: (r) => `Contacto ${s(r.datos.etapa)} · ${s(r.datos.nombre_completo)}`,
      },
      simulacion,
    ),
    new ConectorSimulado(
      {
        id: 'erp',
        nombre: 'ERP y facturación',
        sePresentaComo: 'Sistema contable',
        formato: 'JSON por API',
        entidad: 'Clientes con documentos tributarios',
        campos: [
          c('id', 'texto', 'Identificador interno', false),
          c('rut', 'texto', 'RUT del cliente'),
          c('razon_social', 'texto', 'Nombre o razón social'),
          c('direccion_facturacion', 'texto', 'Dirección de facturación'),
          c('giro', 'texto', 'Giro tributario', false),
          c('documentos', 'lista', 'Boletas y facturas: tipo, folio, fecha y monto'),
        ],
        cargarRegistros: () => empresa.erp.map((r) => reg('erp', r.id, r)),
        identidad: (r) => ({ nombre: s(r.datos.razon_social), rut: s(r.datos.rut) }),
        resumen: (r) => `Cliente tributario · ${s(r.datos.razon_social)}`,
      },
      simulacion,
    ),
    new ConectorSimulado(
      {
        id: 'tienda',
        nombre: 'Tienda online',
        sePresentaComo: 'Plataforma de e-commerce',
        formato: 'JSON por API',
        entidad: 'Clientes y pedidos',
        campos: [
          c('id', 'texto', 'Identificador del cliente', false),
          c('cliente', 'objeto', 'Nombre, correo y teléfono'),
          c(
            'pedidos',
            'lista',
            'Pedidos con dirección de despacho, total, productos y últimos 4 dígitos de la tarjeta',
          ),
        ],
        cargarRegistros: () => empresa.tienda.map((r) => reg('tienda', r.id, r)),
        identidad: (r) => {
          const cli = r.datos.cliente as { nombre?: string; email?: string; telefono?: string };
          return { nombre: cli.nombre, email: cli.email, telefono: cli.telefono };
        },
        resumen: (r) => {
          const cli = r.datos.cliente as { nombre?: string };
          return `Cliente con ${(r.datos.pedidos as unknown[]).length} pedido(s) · ${cli.nombre}`;
        },
      },
      simulacion,
    ),
    new ConectorSimulado(
      {
        id: 'planillas',
        nombre: 'Planillas de ventas',
        sePresentaComo: 'Archivos Excel en una carpeta compartida',
        formato: 'XLSX (una hoja por vendedor)',
        entidad: 'Filas de ventas por vendedor',
        campos: [
          c('Vendedor', 'texto', 'Vendedor que registró la venta', false),
          c('Cliente', 'texto', 'Nombre del cliente'),
          c('RUT', 'texto', 'RUT del cliente'),
          c('Correo', 'texto', 'Correo del cliente'),
          c('Teléfono', 'texto', 'Teléfono del cliente'),
          c('Monto', 'numero', 'Monto de la venta en pesos', false),
          c('Fecha', 'fecha', 'Fecha de la venta', false),
        ],
        // Se lee un XLSX real generado en memoria, igual que se leería desde la carpeta compartida.
        cargarRegistros: () => {
          const libro = XLSX.read(planillasXlsx(empresa), { type: 'array' });
          return libro.SheetNames.flatMap((hoja) =>
            XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets[hoja]!).map((fila, i) =>
              reg('planillas', `xlsx-${hoja.split(' ')[0]?.toLowerCase()}-${i + 2}`, {
                hoja,
                ...fila,
              }),
            ),
          );
        },
        identidad: (r) => ({
          nombre: s(r.datos.Cliente),
          rut: s(r.datos.RUT),
          email: s(r.datos.Correo),
          telefono: s(r.datos['Teléfono']),
        }),
        resumen: (r) => `Fila de la hoja «${s(r.datos.hoja)}» · ${s(r.datos.Cliente)}`,
      },
      simulacion,
    ),
    new ConectorSimulado(
      {
        id: 'rrhh',
        nombre: 'Recursos humanos',
        sePresentaComo: 'Sistema de remuneraciones',
        formato: 'CSV',
        entidad: 'Trabajadores',
        campos: [
          c('id', 'texto', 'Identificador del trabajador', false),
          c('nombre', 'texto', 'Nombre del trabajador'),
          c('rut', 'texto', 'RUT del trabajador'),
          c('cargo', 'texto', 'Cargo'),
          c('fecha_ingreso', 'fecha', 'Fecha de ingreso'),
          c('afp', 'texto', 'AFP'),
          c('isapre', 'texto', 'Institución de salud', true, true),
          c('licencias_medicas', 'numero', 'Cantidad de licencias médicas', true, true),
          c('detalle_licencias', 'texto', 'Diagnóstico o motivo de las licencias', true, true),
          c('sueldo_base', 'numero', 'Sueldo base en pesos'),
        ],
        cargarRegistros: () =>
          leerCsv(aCsv(empresa.rrhh)).map((f) =>
            reg('rrhh', f.id ?? '', f, ['isapre', 'licencias_medicas', 'detalle_licencias']),
          ),
        identidad: (r) => ({ nombre: s(r.datos.nombre), rut: s(r.datos.rut) }),
        resumen: (r) => `Trabajador/a · ${s(r.datos.cargo)}`,
      },
      simulacion,
    ),
    new ConectorSimulado(
      {
        id: 'marketing',
        nombre: 'Marketing',
        sePresentaComo: 'Lista de newsletter',
        formato: 'CSV',
        entidad: 'Suscriptores',
        campos: [
          c('email', 'texto', 'Correo del suscriptor'),
          c('nombre', 'texto', 'Nombre informado'),
          c('consentimiento', 'texto', 'Consentimiento para envíos (si/no)'),
          c('fecha_suscripcion', 'fecha', 'Fecha de suscripción'),
          c('origen', 'texto', 'Dónde se suscribió', false),
        ],
        cargarRegistros: () =>
          leerCsv(aCsv(empresa.marketing)).map((f, i) =>
            reg('marketing', `news-${String(i + 1).padStart(4, '0')}`, f),
          ),
        identidad: (r) => ({ nombre: s(r.datos.nombre), email: s(r.datos.email) }),
        resumen: (r) => `Suscriptor/a (consentimiento: ${s(r.datos.consentimiento)})`,
      },
      simulacion,
    ),
  ];
}
