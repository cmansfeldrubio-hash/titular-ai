import type { Empresa, Solicitud } from '@ley/domain';

/** Persona ficticia "real" detrás de los registros; el agente nunca la ve directamente. */
export interface PersonaBase {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  rut: string; // formato 12.345.678-5
  email: string;
  emailAlternativo: string;
  telefono: string;
  direccion: string;
  esTrabajador: boolean;
  tieneLicenciaMedica: boolean;
  /** Si es homónimo de otra persona (mismo nombre, RUT distinto). */
  homonimoDe?: string;
}

export interface RegistroCrm {
  id: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  etapa: 'cliente' | 'prospecto';
  propietario: string;
  creado: string;
  historial: { fecha: string; tipo: string; nota: string }[];
}

export interface RegistroErp {
  id: string;
  rut: string;
  razon_social: string;
  direccion_facturacion: string;
  giro: string;
  documentos: { tipo: 'boleta' | 'factura'; folio: number; fecha: string; monto: number }[];
}

export interface RegistroTienda {
  id: string;
  cliente: { nombre: string; email: string; telefono: string };
  pedidos: {
    numero: string;
    fecha: string;
    direccion_despacho: string;
    total: number;
    tarjeta_ultimos4: string;
    productos: string[];
  }[];
}

/** Fila de las planillas de ventas (XLSX). */
export interface FilaPlanilla {
  Vendedor: string;
  Cliente: string;
  RUT: string;
  Correo: string;
  Teléfono: string;
  Monto: number;
  Fecha: string;
}

/** Fila del CSV de remuneraciones. Contiene datos sensibles de salud. */
export interface FilaRrhh {
  id: string;
  nombre: string;
  rut: string;
  cargo: string;
  fecha_ingreso: string;
  afp: string;
  isapre: string;
  licencias_medicas: string;
  detalle_licencias: string;
  sueldo_base: string;
}

/** Fila del CSV de la lista de newsletter. */
export interface FilaMarketing {
  email: string;
  nombre: string;
  consentimiento: 'si' | 'no';
  fecha_suscripcion: string;
  origen: string;
}

export interface EmpresaFicticia {
  semilla: number;
  empresa: Empresa;
  personas: PersonaBase[];
  crm: RegistroCrm[];
  erp: RegistroErp[];
  tienda: RegistroTienda[];
  planillas: FilaPlanilla[];
  rrhh: FilaRrhh[];
  marketing: FilaMarketing[];
  solicitudes: Solicitud[];
}
