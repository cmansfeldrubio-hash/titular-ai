import { evaluarCoincidencia } from './coincidencia';
import type {
  Coincidencia,
  ConsultaTitular,
  Connector,
  EsquemaFuente,
  EstadoConector,
  RegistroFuente,
} from './tipos';

/** Correo resumido tal como lo devuelve `GET /api/gmail/requests`. */
export interface CorreoGmail {
  id: string;
  threadId: string;
  remitente: string;
  remitenteNombre: string;
  asunto: string;
  fecha: string;
  extracto: string;
  cuerpo: string;
  /** Encabezado Message-ID (RFC 5322) del correo. */
  messageId?: string;
}

/**
 * Conector real de Gmail. Corre en el navegador pero solo habla con las rutas del
 * propio proyecto; los tokens de Google nunca llegan al navegador (RG-03).
 */
export class ConectorGmail implements Connector {
  readonly id = 'gmail';
  readonly nombre = 'Gmail (casilla de prueba)';
  readonly tipo = 'real' as const;
  readonly sePresentaComo = 'Casilla de correo de solicitudes';
  estado: EstadoConector;
  ultimaSincronizacion?: string;
  private cache?: CorreoGmail[];

  constructor(
    conectado: boolean,
    private readonly baseUrl = '',
  ) {
    this.estado = conectado ? 'conectado' : 'desconectado';
  }

  async listar(): Promise<CorreoGmail[]> {
    if (this.estado !== 'conectado') return [];
    const res = await fetch(`${this.baseUrl}/api/gmail/requests`, { cache: 'no-store' });
    if (!res.ok) {
      this.estado = 'error';
      throw new Error(`Gmail respondió ${res.status}`);
    }
    const json = (await res.json()) as { correos: CorreoGmail[] };
    this.cache = json.correos;
    this.ultimaSincronizacion = new Date().toISOString();
    return json.correos;
  }

  async describirEsquema(): Promise<EsquemaFuente> {
    return {
      fuenteId: this.id,
      nombre: this.nombre,
      sePresentaComo: this.sePresentaComo,
      formato: 'Gmail API',
      entidad: 'Correos de titulares',
      totalRegistros: this.cache?.length ?? 0,
      campos: [
        {
          nombre: 'remitente',
          tipo: 'texto',
          descripcion: 'Correo del remitente',
          personal: true,
          sensible: false,
        },
        {
          nombre: 'asunto',
          tipo: 'texto',
          descripcion: 'Asunto',
          personal: false,
          sensible: false,
        },
        {
          nombre: 'cuerpo',
          tipo: 'texto',
          descripcion: 'Texto del correo',
          personal: true,
          sensible: false,
        },
      ],
    };
  }

  async buscarTitular(consulta: ConsultaTitular): Promise<Coincidencia[]> {
    const correos = this.cache ?? (await this.listar());
    return correos.flatMap((m) => {
      const ev = evaluarCoincidencia(consulta, { nombre: m.remitenteNombre, email: m.remitente });
      return ev ? [{ registroId: m.id, resumen: `Correo «${m.asunto}»`, ...ev }] : [];
    });
  }

  async obtenerRegistro(id: string): Promise<RegistroFuente | null> {
    const correos = this.cache ?? (await this.listar());
    const m = correos.find((x) => x.id === id);
    return m
      ? {
          id,
          fuenteId: this.id,
          datos: { remitente: m.remitente, asunto: m.asunto, fecha: m.fecha, cuerpo: m.cuerpo },
          camposSensibles: [],
        }
      : null;
  }

  async muestras(cantidad: number): Promise<RegistroFuente[]> {
    const correos = this.cache ?? (await this.listar());
    return correos.slice(0, cantidad).map((m) => ({
      id: m.id,
      fuenteId: this.id,
      datos: { remitente: m.remitente, asunto: m.asunto },
      camposSensibles: [],
    }));
  }
}
