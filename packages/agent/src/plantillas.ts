import {
  DERECHO_ETIQUETA,
  formatearFecha,
  type Derecho,
  type Empresa,
  type Solicitud,
} from '@ley/domain';
import { NOMBRE_FUENTE, TRATAMIENTO_POR_FUENTE } from './catalogo';
import type { ProponerRespuesta } from './herramientas';

export interface HallazgoBorrador {
  fuente_id: string;
  registro_id: string;
  dudoso: boolean;
  datos: Record<string, string>;
  sensibles: string[];
}

const CAMPOS_TECNICOS = new Set([
  'id',
  'hoja',
  'propietario',
  'creado',
  'giro',
  'origen',
  'Vendedor',
]);

function lineaDatos(h: HallazgoBorrador): string {
  const visibles = Object.entries(h.datos)
    .filter(([k, v]) => v && !CAMPOS_TECNICOS.has(k) && !h.sensibles.includes(k))
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v.length > 140 ? `${v.slice(0, 140)}…` : v}`);
  const sens = h.sensibles.length
    ? ' Además, existen registros de salud (licencias médicas e institución de salud), que se le entregarán por un canal seguro una vez verificada su identidad.'
    : '';
  return `• ${NOMBRE_FUENTE[h.fuente_id] ?? h.fuente_id}: ${visibles.join('; ')}.${sens} [${h.fuente_id}:${h.registro_id}]`;
}

/** Acción que se propone en una fuente según el derecho ejercido (RF-15). */
export function accionPara(
  derecho: Derecho,
  fuenteId: string,
): { accion: string; justificacion: string } | null {
  switch (derecho) {
    case 'supresion':
      if (fuenteId === 'erp')
        return {
          accion: 'Bloquear y conservar solo lo exigido por la normativa tributaria',
          justificacion: 'Las boletas y facturas deben conservarse por obligación legal.',
        };
      if (fuenteId === 'rrhh')
        return {
          accion: 'Revisar con Recursos Humanos antes de suprimir',
          justificacion: 'Puede haber obligaciones laborales y previsionales vigentes.',
        };
      return {
        accion: 'Eliminar el registro',
        justificacion: 'No hay obligación legal que exija conservarlo.',
      };
    case 'oposicion':
      if (fuenteId === 'marketing')
        return {
          accion: 'Dar de baja de la newsletter',
          justificacion: 'El titular se opone al uso de sus datos para marketing.',
        };
      if (fuenteId === 'crm')
        return {
          accion: 'Marcar «no contactar con fines comerciales»',
          justificacion: 'Evita nuevas campañas comerciales.',
        };
      return null;
    case 'bloqueo':
      return {
        accion: 'Bloquear temporalmente el registro',
        justificacion: 'Mientras se resuelve el reclamo del titular.',
      };
    case 'rectificacion':
      if (['crm', 'erp', 'tienda', 'planillas', 'rrhh'].includes(fuenteId))
        return {
          accion: 'Actualizar dirección y teléfono con los datos que entregó el titular',
          justificacion: 'El titular informó datos de contacto nuevos.',
        };
      return null;
    default:
      return null;
  }
}

const PARRAFO_DERECHO: Record<Derecho, string> = {
  acceso:
    'A continuación le informamos los datos personales suyos que encontramos en nuestros sistemas, agrupados por fuente:',
  portabilidad:
    'Encontramos los siguientes datos suyos. Una vez aprobada esta respuesta, le entregaremos una copia en un formato estructurado y de uso común (planilla XLSX):',
  rectificacion:
    'Identificamos los registros donde figuran sus datos de contacto. Una vez aprobada la rectificación por el encargado, se actualizarán en las siguientes fuentes:',
  supresion:
    'Identificamos sus datos en las siguientes fuentes. Le detallamos lo que proponemos hacer en cada una, sujeto a la aprobación del encargado:',
  oposicion:
    'Identificamos el uso de sus datos para comunicaciones comerciales. Sujeto a aprobación, dejaremos de tratarlos con ese fin en las siguientes fuentes:',
  bloqueo:
    'Identificamos sus datos en las siguientes fuentes. Sujeto a aprobación, se bloquearán temporalmente mientras se resuelve su reclamo:',
};

/** Borrador de respuesta por plantilla, usado en el modo demostración. */
export function redactarBorrador(
  empresa: Empresa,
  solicitud: Solicitud,
  hallazgos: HallazgoBorrador[],
): string {
  const seguros = hallazgos.filter((h) => !h.dudoso);
  const dudosos = hallazgos.filter((h) => h.dudoso);
  const fuentes = [...new Set(seguros.map((h) => h.fuente_id))];
  const cuerpo =
    seguros.length === 0
      ? 'Revisamos todas nuestras fuentes y no encontramos datos personales asociados a los identificadores que nos entregó.'
      : `${PARRAFO_DERECHO[solicitud.derecho]}\n\n${seguros
          .map((h) => {
            const accion = accionPara(solicitud.derecho, h.fuente_id);
            return accion && !['acceso', 'portabilidad'].includes(solicitud.derecho)
              ? `${lineaDatos(h)}\n  Acción propuesta: ${accion.accion}.`
              : lineaDatos(h);
          })
          .join('\n')}`;
  const verificacion = dudosos.length
    ? `\n\nAdemás, estamos verificando ${dudosos.length} registro(s) que podrían corresponder a otra persona con un nombre parecido. Si se confirma que son suyos, se los informaremos.`
    : '';
  const finalidades = fuentes
    .map((f) => `• ${NOMBRE_FUENTE[f]}: ${TRATAMIENTO_POR_FUENTE[f]?.finalidad}`)
    .join('\n');
  const destinatarios = fuentes
    .map((f) => `• ${NOMBRE_FUENTE[f]}: ${TRATAMIENTO_POR_FUENTE[f]?.destinatarios}`)
    .join('\n');
  return `Estimado/a ${solicitud.titular.nombre}:

Con fecha ${formatearFecha(solicitud.recibidaEn)} recibimos su solicitud de ${DERECHO_ETIQUETA[solicitud.derecho].toLowerCase()} de datos personales, presentada en virtud de la Ley 21.719.

${cuerpo}${verificacion}
${fuentes.length ? `\nFinalidades del tratamiento:\n${finalidades}\n\nDestinatarios:\n${destinatarios}\n\nPlazo de conservación: se conservan solo por el tiempo necesario para cada finalidad o el que exija la ley.` : ''}

Si no queda conforme con esta respuesta, puede presentar un reclamo ante la Agencia de Protección de Datos Personales.

Atentamente,
${empresa.encargado.nombre}
${empresa.nombre}`;
}

export function finalidadesYDestinatarios(
  fuentes: string[],
): Pick<ProponerRespuesta, 'finalidades' | 'destinatarios' | 'conservacion'> {
  const unicas = [...new Set(fuentes)];
  return {
    finalidades: unicas.map((f) => TRATAMIENTO_POR_FUENTE[f]?.finalidad ?? '').filter(Boolean),
    destinatarios: [
      ...new Set(unicas.map((f) => TRATAMIENTO_POR_FUENTE[f]?.destinatarios ?? '').filter(Boolean)),
    ],
    conservacion:
      'Solo por el tiempo necesario para cada finalidad o el que exija la ley; ver detalle por fuente.',
  };
}
