export type EstadoConector = 'conectado' | 'desconectado' | 'error';

export interface CampoEsquema {
  nombre: string;
  tipo: 'texto' | 'numero' | 'fecha' | 'lista' | 'objeto';
  descripcion: string;
  personal: boolean;
  sensible: boolean;
}

export interface EsquemaFuente {
  fuenteId: string;
  nombre: string;
  sePresentaComo: string;
  formato: string;
  entidad: string;
  totalRegistros: number;
  campos: CampoEsquema[];
}

export interface ConsultaTitular {
  nombre?: string;
  rut?: string;
  email?: string;
  telefono?: string;
}

export interface Coincidencia {
  registroId: string;
  /** Resumen mínimo para decidir si vale la pena traer el registro (RNF-03). */
  resumen: string;
  criterios: string[];
  /** Confianza de que sea la misma persona, de 0 a 1. */
  confianza: number;
  dudoso: boolean;
  motivo: string;
}

export interface RegistroFuente {
  id: string;
  fuenteId: string;
  datos: Record<string, unknown>;
  /** Campos que contienen datos sensibles (salud, por ejemplo). */
  camposSensibles: string[];
}

/** Interfaz común a conectores simulados y reales (RD-01). */
export interface Connector {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: 'simulado' | 'real';
  readonly sePresentaComo: string;
  estado: EstadoConector;
  ultimaSincronizacion?: string;
  describirEsquema(): Promise<EsquemaFuente>;
  buscarTitular(consulta: ConsultaTitular): Promise<Coincidencia[]>;
  obtenerRegistro(id: string): Promise<RegistroFuente | null>;
  /** Muestra de registros para el escaneo del inventario (RF-04). */
  muestras(cantidad: number): Promise<RegistroFuente[]>;
}

export class ErrorFuente extends Error {
  constructor(
    public readonly fuenteId: string,
    mensaje: string,
    public readonly reintentable = true,
  ) {
    super(mensaje);
    this.name = 'ErrorFuente';
  }
}
