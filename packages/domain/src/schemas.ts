import { z } from 'zod';

/** Derechos que un titular puede ejercer bajo la Ley 21.719. */
export const DERECHOS = [
  'acceso',
  'rectificacion',
  'supresion',
  'oposicion',
  'portabilidad',
  'bloqueo',
] as const;
export const DerechoSchema = z.enum(DERECHOS);
export type Derecho = z.infer<typeof DerechoSchema>;

export const DERECHO_ETIQUETA: Record<Derecho, string> = {
  acceso: 'Acceso',
  rectificacion: 'Rectificación',
  supresion: 'Supresión',
  oposicion: 'Oposición',
  portabilidad: 'Portabilidad',
  bloqueo: 'Bloqueo',
};

/** Derechos para los que el agente solo propone acciones por fuente (RF-15). */
export const DERECHOS_CON_ACCIONES: readonly Derecho[] = [
  'supresion',
  'oposicion',
  'bloqueo',
  'rectificacion',
];

/** Datos con los que se identifica a la persona que hace la solicitud. */
export const IdentificacionTitularSchema = z.object({
  nombre: z.string().min(1),
  rut: z.string().optional(),
  email: z.string().optional(),
});
export type IdentificacionTitular = z.infer<typeof IdentificacionTitularSchema>;

export const ESTADOS_SOLICITUD = [
  'nueva',
  'en_investigacion',
  'borrador',
  'aprobada',
  'enviada',
  'no_enviada',
  'rechazada',
] as const;
export const EstadoSolicitudSchema = z.enum(ESTADOS_SOLICITUD);
export type EstadoSolicitud = z.infer<typeof EstadoSolicitudSchema>;

export const ESTADO_ETIQUETA: Record<EstadoSolicitud, string> = {
  nueva: 'Nueva',
  en_investigacion: 'En investigación',
  borrador: 'Borrador listo',
  aprobada: 'Aprobada',
  enviada: 'Enviada',
  no_enviada: 'Aprobada · no enviada',
  rechazada: 'Borrador rechazado',
};

export const ProrrogaSchema = z.object({
  motivo: z.string().min(1),
  registradaEn: z.string(),
});
export type Prorroga = z.infer<typeof ProrrogaSchema>;

/** Nivel de confianza de que un registro corresponda al titular. */
export const HallazgoSchema = z.object({
  fuenteId: z.string(),
  registroId: z.string(),
  /** Datos encontrados: nombre de campo → valor (o descripción, si es sensible). */
  datos: z.record(z.string(), z.string()),
  confianza: z.number().min(0).max(1),
  /** Coincidencia dudosa que el encargado debe confirmar o descartar (RF-13). */
  dudoso: z.boolean(),
  motivo: z.string(),
  contieneSensibles: z.boolean(),
});
export type Hallazgo = z.infer<typeof HallazgoSchema>;

export const RevisionHallazgoSchema = z.enum(['pendiente', 'confirmado', 'descartado']);
export type RevisionHallazgo = z.infer<typeof RevisionHallazgoSchema>;

export const AccionPropuestaSchema = z.object({
  fuenteId: z.string(),
  registroId: z.string(),
  accion: z.string(),
  justificacion: z.string(),
});
export type AccionPropuesta = z.infer<typeof AccionPropuestaSchema>;

/** Salida validada de la herramienta `proponer_respuesta`. */
export const PropuestaRespuestaSchema = z.object({
  hallazgos: z.array(HallazgoSchema),
  borrador: z.string().min(1),
  acciones: z.array(AccionPropuestaSchema),
  finalidades: z.array(z.string()),
  destinatarios: z.array(z.string()),
  conservacion: z.string(),
});
export type PropuestaRespuesta = z.infer<typeof PropuestaRespuestaSchema>;

export const UsoTokensSchema = z.object({
  entrada: z.number(),
  salida: z.number(),
  cacheLectura: z.number(),
  cacheEscritura: z.number(),
  costoUsd: z.number(),
  modelo: z.string(),
});
export type UsoTokens = z.infer<typeof UsoTokensSchema>;

export const SolicitudSchema = z.object({
  id: z.string(),
  titular: IdentificacionTitularSchema,
  derecho: DerechoSchema,
  /** ISO 8601 */
  recibidaEn: z.string(),
  canal: z.enum(['gmail', 'simulada']),
  asunto: z.string(),
  mensaje: z.string(),
  estado: EstadoSolicitudSchema,
  prorroga: ProrrogaSchema.optional(),
  clasificadaPor: z.enum(['agente', 'persona', 'semilla']).default('semilla'),
  gmail: z
    .object({
      threadId: z.string(),
      messageId: z.string(),
      remitente: z.string(),
      /** Encabezado Message-ID del correo original, para responder en el mismo hilo. */
      messageIdHeader: z.string().optional(),
    })
    .optional(),
  propuesta: PropuestaRespuestaSchema.optional(),
  revisiones: z.record(z.string(), RevisionHallazgoSchema).default({}),
  borradorEditado: z.string().optional(),
  versionBorrador: z.number().default(0),
  respondidaEn: z.string().optional(),
  motivoRechazo: z.string().optional(),
  uso: UsoTokensSchema.optional(),
});
export type Solicitud = z.infer<typeof SolicitudSchema>;

export const TIPOS_EVENTO = [
  'recepcion',
  'clasificacion',
  'investigacion_inicio',
  'busqueda',
  'herramienta',
  'error_fuente',
  'borrador',
  'edicion',
  'revision_hallazgo',
  'nueva_version',
  'aprobacion',
  'rechazo',
  'envio',
  'no_enviado',
  'prorroga',
  'inventario',
  'configuracion',
  'reporte',
] as const;
export const TipoEventoSchema = z.enum(TIPOS_EVENTO);
export type TipoEvento = z.infer<typeof TipoEventoSchema>;

export const EventoBitacoraSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  actor: z.enum(['agente', 'persona', 'sistema']),
  tipo: TipoEventoSchema,
  solicitudId: z.string().optional(),
  detalle: z.string(),
});
export type EventoBitacora = z.infer<typeof EventoBitacoraSchema>;

/** Fila del registro de actividades de tratamiento (RF-04 a RF-06). */
export const ActividadTratamientoSchema = z.object({
  id: z.string(),
  fuenteId: z.string(),
  nombre: z.string(),
  categorias: z.array(z.string()),
  datosSensibles: z.boolean(),
  finalidad: z.string(),
  accesos: z.string(),
  conservacion: z.string(),
  estado: z.enum(['sugerido', 'confirmado']),
});
export type ActividadTratamiento = z.infer<typeof ActividadTratamientoSchema>;

export const EmpresaSchema = z.object({
  nombre: z.string(),
  rut: z.string(),
  rubro: z.string(),
  encargado: z.object({ nombre: z.string(), email: z.string(), cargo: z.string() }),
  direccion: z.string(),
});
export type Empresa = z.infer<typeof EmpresaSchema>;
