import { evaluarCoincidencia, type Identidad } from './coincidencia';
import {
  ErrorFuente,
  type CampoEsquema,
  type Coincidencia,
  type ConsultaTitular,
  type Connector,
  type EsquemaFuente,
  type EstadoConector,
  type RegistroFuente,
} from './tipos';

export interface OpcionesSimulacion {
  /** Latencia mínima y máxima en milisegundos (RD-02: 200 a 1.500 ms). */
  latenciaMs: [number, number];
  /** Probabilidad de error transitorio por llamada, de 0 a 1. */
  tasaError: number;
  /** Fuente de aleatoriedad (inyectable para pruebas). */
  aleatorio?: () => number;
}

export const SIMULACION_POR_DEFECTO: OpcionesSimulacion = {
  latenciaMs: [200, 1500],
  tasaError: 0.08,
};

export interface DefinicionFuente {
  id: string;
  nombre: string;
  sePresentaComo: string;
  formato: string;
  entidad: string;
  campos: CampoEsquema[];
  cargarRegistros: () => RegistroFuente[];
  identidad: (r: RegistroFuente) => Identidad;
  resumen: (r: RegistroFuente) => string;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Conector simulado: misma interfaz que uno real, con latencia y errores ocasionales. */
export class ConectorSimulado implements Connector {
  readonly tipo = 'simulado' as const;
  readonly id: string;
  readonly nombre: string;
  readonly sePresentaComo: string;
  estado: EstadoConector = 'conectado';
  ultimaSincronizacion?: string;
  private registros?: RegistroFuente[];

  constructor(
    private readonly def: DefinicionFuente,
    public simulacion: OpcionesSimulacion = SIMULACION_POR_DEFECTO,
  ) {
    this.id = def.id;
    this.nombre = def.nombre;
    this.sePresentaComo = def.sePresentaComo;
  }

  private datos(): RegistroFuente[] {
    if (!this.registros) {
      this.registros = this.def.cargarRegistros();
      this.ultimaSincronizacion = new Date().toISOString();
    }
    return this.registros;
  }

  private async simularRed(operacion: string): Promise<void> {
    const azar = this.simulacion.aleatorio ?? Math.random;
    const [min, max] = this.simulacion.latenciaMs;
    await esperar(min + azar() * Math.max(0, max - min));
    if (this.estado === 'desconectado') {
      throw new ErrorFuente(this.id, `${this.nombre} está desconectada`, false);
    }
    if (azar() < this.simulacion.tasaError) {
      throw new ErrorFuente(
        this.id,
        `${this.nombre}: tiempo de espera agotado en ${operacion} (error simulado)`,
      );
    }
  }

  async describirEsquema(): Promise<EsquemaFuente> {
    await this.simularRed('describirEsquema');
    return {
      fuenteId: this.id,
      nombre: this.nombre,
      sePresentaComo: this.sePresentaComo,
      formato: this.def.formato,
      entidad: this.def.entidad,
      totalRegistros: this.datos().length,
      campos: this.def.campos,
    };
  }

  async buscarTitular(consulta: ConsultaTitular): Promise<Coincidencia[]> {
    await this.simularRed('buscarTitular');
    const resultados: Coincidencia[] = [];
    for (const r of this.datos()) {
      const ev = evaluarCoincidencia(consulta, this.def.identidad(r));
      if (ev) resultados.push({ registroId: r.id, resumen: this.def.resumen(r), ...ev });
    }
    return resultados.sort((a, b) => b.confianza - a.confianza);
  }

  async obtenerRegistro(id: string): Promise<RegistroFuente | null> {
    await this.simularRed('obtenerRegistro');
    return this.datos().find((r) => r.id === id) ?? null;
  }

  async muestras(cantidad: number): Promise<RegistroFuente[]> {
    await this.simularRed('muestras');
    return this.datos().slice(0, cantidad);
  }
}

export interface OpcionesReintento {
  intentos?: number;
  esperaBaseMs?: number;
  alReintentar?: (intento: number, error: unknown) => void;
}

/** Reintento con espera exponencial ante errores transitorios (RNF-11). */
export async function conReintentos<T>(
  fn: () => Promise<T>,
  opciones: OpcionesReintento = {},
): Promise<T> {
  const intentos = opciones.intentos ?? 3;
  const base = opciones.esperaBaseMs ?? 300;
  let ultimo: unknown;
  for (let i = 1; i <= intentos; i++) {
    try {
      return await fn();
    } catch (error) {
      ultimo = error;
      const reintentable = !(error instanceof ErrorFuente) || error.reintentable;
      if (!reintentable || i === intentos) break;
      opciones.alReintentar?.(i, error);
      await esperar(base * 2 ** (i - 1));
    }
  }
  throw ultimo;
}
