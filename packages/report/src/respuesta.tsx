import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  DERECHO_ETIQUETA,
  formatearFecha,
  type Empresa,
  type Hallazgo,
  type PropuestaRespuesta,
  type Solicitud,
} from '@ley/domain';
import { MarcaYPie, Tabla } from './comunes';
import { estilos } from './estilos';

export interface DatosRespuesta {
  empresa: Empresa;
  solicitud: Solicitud;
  propuesta: PropuestaRespuesta;
  /** Texto final aprobado por el encargado. */
  texto: string;
  /** Hallazgos confirmados (sin los descartados ni los dudosos pendientes). */
  hallazgos: Hallazgo[];
  fecha: Date;
  nombresFuente: Record<string, string>;
}

const CAMPOS_SENSIBLES = new Set(['isapre', 'licencias_medicas', 'detalle_licencias']);

/** Respuesta al titular en PDF (RF-20). Los datos de salud no se incluyen en un archivo que viaja por correo. */
export function RespuestaTitularPdf({
  empresa,
  solicitud,
  propuesta,
  texto,
  hallazgos,
  fecha,
  nombresFuente,
}: DatosRespuesta) {
  return (
    <Document
      title={`Respuesta ${solicitud.id}`}
      author={empresa.nombre}
      subject="Respuesta Ley 21.719"
    >
      <Page size="A4" style={estilos.pagina}>
        <MarcaYPie izquierda={`${empresa.nombre} · ${solicitud.id}`} />
        <View style={estilos.cabecera}>
          <Text style={estilos.empresa}>{`${empresa.nombre} · RUT ${empresa.rut}`}</Text>
          <Text
            style={estilos.titulo}
          >{`Respuesta a su solicitud de ${DERECHO_ETIQUETA[solicitud.derecho].toLowerCase()}`}</Text>
        </View>
        <View style={estilos.meta}>
          <Text>{`Solicitud: ${solicitud.id}`}</Text>
          <Text>{`Titular: ${solicitud.titular.nombre}`}</Text>
          <Text>{`Recibida: ${formatearFecha(solicitud.recibidaEn)}`}</Text>
          <Text>{`Respondida: ${formatearFecha(fecha)}`}</Text>
        </View>
        {texto.split(/\n{2,}/).map((p, i) => (
          <Text key={i} style={estilos.parrafo}>
            {p}
          </Text>
        ))}

        <Text style={estilos.subtitulo} break={hallazgos.length > 3}>
          Anexo: datos encontrados por fuente
        </Text>
        {hallazgos.length === 0 ? (
          <Text>No se encontraron datos personales asociados al titular.</Text>
        ) : (
          <Tabla
            columnas={['Fuente', 'Registro', 'Datos']}
            anchos={[1.2, 1, 4]}
            filas={hallazgos.map((h) => [
              nombresFuente[h.fuenteId] ?? h.fuenteId,
              h.registroId,
              Object.entries(h.datos)
                .filter(([, v]) => v)
                .map(([k, v]) =>
                  CAMPOS_SENSIBLES.has(k)
                    ? `${k}: [dato sensible, se entrega por canal seguro]`
                    : `${k}: ${v}`,
                )
                .join('\n'),
            ])}
          />
        )}

        <Text style={estilos.subtitulo}>Finalidades, destinatarios y conservación</Text>
        <Text
          style={estilos.parrafo}
        >{`Finalidades: ${propuesta.finalidades.join('; ') || 'No aplica'}`}</Text>
        <Text
          style={estilos.parrafo}
        >{`Destinatarios: ${propuesta.destinatarios.join('; ') || 'No aplica'}`}</Text>
        <Text style={estilos.parrafo}>{`Plazo de conservación: ${propuesta.conservacion}`}</Text>

        <Text style={estilos.subtitulo}>Cómo reclamar</Text>
        <Text style={estilos.parrafo}>
          Si no queda conforme con esta respuesta, puede presentar un reclamo ante la Agencia de
          Protección de Datos Personales, de acuerdo con la Ley 21.719.
        </Text>
      </Page>
    </Document>
  );
}
