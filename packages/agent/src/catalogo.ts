/** Conocimiento de la empresa ficticia sobre cada fuente: finalidad, destinatarios y conservación. */
export interface InfoTratamiento {
  finalidad: string;
  destinatarios: string;
  accesos: string;
  conservacion: string;
}

export const TRATAMIENTO_POR_FUENTE: Record<string, InfoTratamiento> = {
  crm: {
    finalidad: 'Gestión comercial y seguimiento de clientes y prospectos',
    destinatarios: 'Equipo comercial interno',
    accesos: 'Vendedores y jefatura comercial',
    conservacion: 'Mientras exista relación comercial y hasta 2 años después (sugerido)',
  },
  erp: {
    finalidad: 'Facturación y cumplimiento de obligaciones tributarias',
    destinatarios: 'Servicio de Impuestos Internos, por obligación legal',
    accesos: 'Contabilidad y finanzas',
    conservacion: 'El plazo que exige la normativa tributaria (sugerido: 6 años)',
  },
  tienda: {
    finalidad: 'Gestión de pedidos, pagos y despachos de la tienda online',
    destinatarios: 'Empresa de despacho y procesador de pagos',
    accesos: 'Equipo de e-commerce y atención al cliente',
    conservacion:
      'Mientras la cuenta esté activa y hasta 2 años después del último pedido (sugerido)',
  },
  planillas: {
    finalidad: 'Seguimiento de ventas y metas por vendedor',
    destinatarios: 'Equipo comercial interno',
    accesos: 'Vendedores (carpeta compartida) y jefatura comercial',
    conservacion: '2 años desde la venta (sugerido); revisar el acceso a la carpeta compartida',
  },
  rrhh: {
    finalidad: 'Gestión de la relación laboral, remuneraciones y licencias médicas',
    destinatarios: 'AFP, institución de salud y organismos laborales',
    accesos: 'Solo Recursos Humanos y remuneraciones',
    conservacion:
      'Durante la relación laboral y el plazo que exige la normativa laboral y previsional (sugerido)',
  },
  marketing: {
    finalidad: 'Envío de newsletter y comunicaciones comerciales con consentimiento',
    destinatarios: 'Plataforma de envío de correos',
    accesos: 'Equipo de marketing',
    conservacion: 'Hasta que la persona retire su consentimiento (sugerido)',
  },
  gmail: {
    finalidad: 'Atención de solicitudes de titulares',
    destinatarios: 'Ninguno',
    accesos: 'Encargado de cumplimiento',
    conservacion: 'Mientras se tramita la solicitud y hasta 2 años después (sugerido)',
  },
};

export const NOMBRE_FUENTE: Record<string, string> = {
  crm: 'CRM',
  erp: 'ERP y facturación',
  tienda: 'Tienda online',
  planillas: 'Planillas de ventas',
  rrhh: 'Recursos humanos',
  marketing: 'Marketing',
  gmail: 'Gmail',
};

/** Categoría de dato según el nombre del campo, para el inventario. */
export function categoriaDeCampo(campo: string): string | null {
  const c = campo.toLowerCase();
  if (/(^|_)(nombre|razon_social|cliente|rut)($|_)/.test(c) || c === 'cliente')
    return 'Identificación';
  if (/(email|correo|telefono|teléfono)/.test(c)) return 'Contacto';
  if (/direccion/.test(c)) return 'Domicilio';
  if (/(documentos|pedidos|monto)/.test(c)) return 'Transacciones comerciales';
  if (/historial/.test(c)) return 'Historial comercial';
  if (/(sueldo|afp|cargo|fecha_ingreso)/.test(c)) return 'Laborales y previsionales';
  if (/(isapre|licencia)/.test(c)) return 'Salud (dato sensible)';
  if (/consentimiento/.test(c)) return 'Preferencias y consentimiento';
  if (/remitente|cuerpo/.test(c)) return 'Comunicaciones';
  return null;
}
