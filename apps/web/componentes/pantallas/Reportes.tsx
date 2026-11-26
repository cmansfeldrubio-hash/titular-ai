'use client';

import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { Section } from '@astryxdesign/core/Section';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import {
  calcularMetricas,
  MINUTOS_CON_AGENTE_POR_SOLICITUD,
  MINUTOS_MANUAL_POR_SOLICITUD,
} from '@ley/domain';
import { bitacoraCsv, exportarRegistroXlsx, generarPdfCumplimiento } from '@ley/report';
import { Encabezado, Pantalla } from '@/componentes/Encabezado';
import { useEstado } from '@/lib/estado';
import { descargar, fechaArchivo, NOMBRE_FUENTE, numero, usd, XLSX_MIME } from '@/lib/utiles';

function Metrica({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <Card>
      <VStack gap={1}>
        <Text type="display-3">{valor}</Text>
        <Text color="secondary">{etiqueta}</Text>
      </VStack>
    </Card>
  );
}

/** Reportes de cumplimiento y exportaciones (RF-20 a RF-24). */
export function Reportes() {
  const { solicitudes, actividades, bitacora, empresa, registrar } = useEstado();
  const m = calcularMetricas(solicitudes);
  const costo = solicitudes.reduce((t, s) => t + (s.uso?.costoUsd ?? 0), 0);

  async function pdfCumplimiento() {
    const blob = await generarPdfCumplimiento({
      empresa: empresa.empresa,
      generado: new Date(),
      actividades,
      solicitudes,
      metricas: m,
      bitacora,
      nombresFuente: NOMBRE_FUENTE,
    });
    descargar(blob, `reporte-cumplimiento-${fechaArchivo()}.pdf`);
    await registrar({
      actor: 'persona',
      tipo: 'reporte',
      detalle: 'Descargó el reporte de cumplimiento en PDF',
    });
  }

  async function xlsx() {
    descargar(
      exportarRegistroXlsx(actividades, solicitudes, NOMBRE_FUENTE),
      `registro-y-solicitudes-${fechaArchivo()}.xlsx`,
      XLSX_MIME,
    );
    await registrar({
      actor: 'persona',
      tipo: 'reporte',
      detalle: 'Exportó el registro de actividades y las solicitudes a XLSX',
    });
  }

  async function csv() {
    descargar(bitacoraCsv(bitacora), `bitacora-${fechaArchivo()}.csv`, 'text/csv;charset=utf-8');
    await registrar({ actor: 'persona', tipo: 'reporte', detalle: 'Exportó la bitácora a CSV' });
  }

  return (
    <Pantalla>
      <Encabezado
        titulo="Reportes"
        acciones={
          <Button
            label="Descargar reporte de cumplimiento (PDF)"
            variant="primary"
            clickAction={pdfCumplimiento}
          />
        }
      />
      <Grid columns={{ minWidth: 220 }} gap={3}>
        <Metrica valor={String(m.recibidas)} etiqueta="Solicitudes recibidas" />
        <Metrica
          valor={`${m.respondidasEnPlazo} de ${m.respondidas}`}
          etiqueta="Respondidas en plazo"
        />
        <Metrica valor={`${m.porcentajeEnPlazo} %`} etiqueta="Porcentaje respondido en plazo" />
        <Metrica
          valor={
            m.tiempoPromedioDias == null ? 'Sin datos' : `${numero(m.tiempoPromedioDias)} días`
          }
          etiqueta="Tiempo promedio de respuesta"
        />
        <Metrica
          valor={`${numero(m.horasAhorradasEstimadas)} h`}
          etiqueta="Tiempo estimado ahorrado"
        />
        <Metrica
          valor={`${m.pendientes} (${m.vencidas} vencidas)`}
          etiqueta="Solicitudes pendientes"
        />
        <Metrica valor={usd(costo)} etiqueta="Costo estimado del modelo (todas las solicitudes)" />
      </Grid>
      <Banner
        status="info"
        title="Cómo se estima el tiempo ahorrado"
        description={`Supuesto: ${MINUTOS_MANUAL_POR_SOLICITUD} minutos por solicitud en el proceso manual y ${MINUTOS_CON_AGENTE_POR_SOLICITUD} minutos de revisión humana con el agente.`}
      />
      <Section>
        <VStack gap={3}>
          <Heading level={2}>Exportaciones</Heading>
          <Text color="secondary">
            La respuesta al titular en PDF se genera al aprobar cada solicitud, desde su pantalla de
            detalle.
          </Text>
          <Grid columns={{ minWidth: 260 }} gap={2}>
            <Button label="Registro de actividades y solicitudes (XLSX)" clickAction={xlsx} />
            <Button label="Bitácora completa (CSV)" clickAction={csv} />
          </Grid>
        </VStack>
      </Section>
    </Pantalla>
  );
}
