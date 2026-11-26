import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  calcularPlazo,
  DERECHO_ETIQUETA,
  ESTADO_ETIQUETA,
  formatearFecha,
  formatearFechaHora,
  MINUTOS_CON_AGENTE_POR_SOLICITUD,
  MINUTOS_MANUAL_POR_SOLICITUD,
  type ActividadTratamiento,
  type Empresa,
  type EventoBitacora,
  type MetricasCumplimiento,
  type Solicitud,
} from '@ley/domain';
import { MarcaYPie, Tabla } from './comunes';
import { estilos } from './estilos';

export interface DatosCumplimiento {
  empresa: Empresa;
  generado: Date;
  actividades: ActividadTratamiento[];
  solicitudes: Solicitud[];
  metricas: MetricasCumplimiento;
  bitacora: EventoBitacora[];
  nombresFuente: Record<string, string>;
}

function Metrica({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <View style={estilos.metrica}>
      <Text style={estilos.metricaValor}>{valor}</Text>
      <Text style={estilos.metricaEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

/** Reporte de cumplimiento en PDF (RF-21, RF-22). */
export function ReporteCumplimientoPdf({
  empresa,
  generado,
  actividades,
  solicitudes,
  metricas,
  bitacora,
  nombresFuente,
}: DatosCumplimiento) {
  const porTipo = new Map<string, number>();
  for (const e of bitacora) porTipo.set(e.tipo, (porTipo.get(e.tipo) ?? 0) + 1);
  const porActor = new Map<string, number>();
  for (const e of bitacora) porActor.set(e.actor, (porActor.get(e.actor) ?? 0) + 1);
  return (
    <Document title="Reporte de cumplimiento" author={empresa.nombre}>
      <Page size="A4" orientation="landscape" style={estilos.pagina}>
        <MarcaYPie izquierda={`${empresa.nombre} · Reporte de cumplimiento`} />
        <View style={estilos.cabecera}>
          <Text
            style={estilos.empresa}
          >{`${empresa.nombre} · RUT ${empresa.rut} · ${empresa.rubro}`}</Text>
          <Text style={estilos.titulo}>Reporte de cumplimiento · Ley 21.719</Text>
          <Text
            style={estilos.empresa}
          >{`Generado el ${formatearFechaHora(generado)} · Encargado: ${empresa.encargado.nombre}`}</Text>
        </View>

        <Text style={estilos.subtitulo}>Métricas del período</Text>
        <View style={estilos.metricas}>
          <Metrica valor={String(metricas.recibidas)} etiqueta="Solicitudes recibidas" />
          <Metrica
            valor={`${metricas.respondidasEnPlazo} de ${metricas.respondidas}`}
            etiqueta="Respondidas en plazo"
          />
          <Metrica
            valor={`${metricas.porcentajeEnPlazo} %`}
            etiqueta="Porcentaje respondido en plazo"
          />
          <Metrica
            valor={
              metricas.tiempoPromedioDias == null
                ? 'Sin datos'
                : `${metricas.tiempoPromedioDias.toLocaleString('es-CL')} días`
            }
            etiqueta="Tiempo promedio de respuesta"
          />
          <Metrica
            valor={`${metricas.horasAhorradasEstimadas.toLocaleString('es-CL')} h`}
            etiqueta="Tiempo estimado ahorrado"
          />
          <Metrica
            valor={`${metricas.pendientes} (${metricas.vencidas} vencidas)`}
            etiqueta="Pendientes"
          />
        </View>
        <Text style={estilos.aviso}>
          {`El tiempo ahorrado es una estimación: supone ${MINUTOS_MANUAL_POR_SOLICITUD} minutos por solicitud en el proceso manual y ${MINUTOS_CON_AGENTE_POR_SOLICITUD} minutos de revisión humana con el agente.`}
        </Text>

        <Text style={estilos.subtitulo}>Registro de actividades de tratamiento</Text>
        <Tabla
          columnas={[
            'Fuente',
            'Categorías',
            'Sensibles',
            'Finalidad',
            'Accesos',
            'Conservación',
            'Estado',
          ]}
          anchos={[1, 2, 0.7, 2, 1.5, 2, 0.9]}
          filas={actividades.map((a) => [
            nombresFuente[a.fuenteId] ?? a.fuenteId,
            a.categorias.join(', '),
            a.datosSensibles ? 'Sí' : 'No',
            a.finalidad,
            a.accesos,
            a.conservacion,
            a.estado === 'confirmado' ? 'Confirmado' : 'Sugerido por el agente',
          ])}
        />

        <Text style={estilos.subtitulo} break>
          Solicitudes del período
        </Text>
        <Tabla
          columnas={['ID', 'Titular', 'Derecho', 'Recibida', 'Estado', 'Plazo']}
          anchos={[0.8, 2, 1.2, 1, 1.5, 1.5]}
          filas={solicitudes.map((s) => {
            const p = calcularPlazo(
              s.recibidaEn,
              s.prorroga,
              s.respondidaEn ? new Date(s.respondidaEn) : new Date(),
            );
            const plazo = s.respondidaEn
              ? p.diasRestantes >= 0
                ? 'Respondida en plazo'
                : 'Respondida fuera de plazo'
              : p.diasRestantes >= 0
                ? `${p.diasRestantes} días restantes`
                : `Vencida (${-p.diasRestantes} días)`;
            return [
              s.id,
              s.titular.nombre,
              DERECHO_ETIQUETA[s.derecho],
              formatearFecha(s.recibidaEn),
              ESTADO_ETIQUETA[s.estado],
              `${plazo}${s.prorroga ? ' · con prórroga' : ''}`,
            ];
          })}
        />

        <Text style={estilos.subtitulo}>Resumen de la bitácora</Text>
        <Text style={estilos.parrafo}>
          {`${bitacora.length} eventos registrados: ${[...porActor].map(([a, n]) => `${n} del ${a === 'persona' ? 'encargado' : a}`).join(', ')}.`}
        </Text>
        <Tabla
          columnas={['Tipo de evento', 'Cantidad']}
          anchos={[3, 1]}
          filas={[...porTipo]
            .sort((a, b) => b[1] - a[1])
            .map(([t, n]) => [t.replace(/_/g, ' '), String(n)])}
        />
      </Page>
    </Document>
  );
}
