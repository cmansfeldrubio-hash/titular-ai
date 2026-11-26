'use client';

import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Section } from '@astryxdesign/core/Section';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import {
  crearCliente,
  describirError,
  infoModelo,
  investigarDemo,
  investigarSolicitud,
  type EventoAgente,
} from '@ley/agent';
import {
  DERECHO_ETIQUETA,
  DERECHOS_CON_ACCIONES,
  ESTADO_ETIQUETA,
  formatearFecha,
  formatearFechaHora,
  type Hallazgo,
  type RevisionHallazgo,
  type Solicitud,
  type UsoTokens,
} from '@ley/domain';
import { exportarDatosTitularXlsx, generarPdfRespuesta } from '@ley/report';
import { useRef, useState } from 'react';
import {
  aplicarEvento,
  BitacoraAgente,
  describirEntrada,
  type Paso,
} from '@/componentes/BitacoraAgente';
import { Encabezado, Pantalla } from '@/componentes/Encabezado';
import { Plazo } from '@/componentes/Plazo';
import { useClave } from '@/lib/clave';
import { useEstado, useFuentesAgente } from '@/lib/estado';
import { blobABase64, descargar, NOMBRE_FUENTE, usd, XLSX_MIME } from '@/lib/utiles';

const clave = (h: Hallazgo) => `${h.fuenteId}:${h.registroId}`;

function sumarUso(a: UsoTokens | undefined, b: UsoTokens): UsoTokens {
  if (!a) return b;
  return {
    entrada: a.entrada + b.entrada,
    salida: a.salida + b.salida,
    cacheLectura: a.cacheLectura + b.cacheLectura,
    cacheEscritura: a.cacheEscritura + b.cacheEscritura,
    costoUsd: a.costoUsd + b.costoUsd,
    modelo: b.modelo,
  };
}

function nivel(c: number) {
  return c >= 0.85 ? 'Alta' : c >= 0.5 ? 'Media' : 'Baja';
}

function Parrafos({ texto }: { texto: string }) {
  return (
    <VStack gap={1}>
      {texto.split('\n').map((linea, i) => (
        <Text key={i} display="block">
          {linea || ' '}
        </Text>
      ))}
    </VStack>
  );
}

export function DetalleSolicitud({ id }: { id: string }) {
  const { solicitudes, guardarSolicitud, registrar, empresa, ajustes, gmail } = useEstado();
  const fuentes = useFuentesAgente();
  const { clave: claveApi } = useClave();
  const toast = useToast();
  const s = solicitudes.find((x) => x.id === id);

  const [pasos, setPasos] = useState<Paso[]>([]);
  const [usoVivo, setUsoVivo] = useState<UsoTokens | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<string>(
    s?.borradorEditado ?? s?.propuesta?.borrador ?? '',
  );
  const [dialogo, setDialogo] = useState<null | 'prorroga' | 'version' | 'rechazo'>(null);
  const [textoDialogo, setTextoDialogo] = useState('');
  const control = useRef<AbortController | null>(null);

  if (!s) {
    return (
      <Pantalla>
        <EmptyState
          title="No encontramos esta solicitud"
          description="Puede que se haya restaurado el estado de la demo."
          actions={<Button label="Volver a la bandeja" href="/" />}
        />
      </Pantalla>
    );
  }
  const sol = s;
  const propuesta = sol.propuesta;
  const cerrada = Boolean(sol.respondidaEn);
  const pendientes = (propuesta?.hallazgos ?? []).filter(
    (h) => h.dudoso && !sol.revisiones[clave(h)],
  );
  const puedeEnviarGmail = gmail.conectado && sol.canal === 'gmail' && Boolean(sol.gmail);

  /** El agente investiga y redacta; muestra cada paso en vivo (RF-11 a RF-15). */
  async function investigar(instrucciones?: string) {
    const ctrl = new AbortController();
    control.current = ctrl;
    setCorriendo(true);
    setError(null);
    setPasos([]);
    setUsoVivo(null);
    const anterior = sol.estado;
    await guardarSolicitud({ ...sol, estado: 'en_investigacion' });
    await registrar({
      actor: 'persona',
      tipo: 'investigacion_inicio',
      solicitudId: sol.id,
      detalle: `Inició la investigación (${claveApi ? infoModelo(ajustes.modelo).etiqueta : 'modo demostración'})${instrucciones ? ' pidiendo otra versión' : ''}`,
    });
    const nombres = new Map<string, string>();
    const alEvento = (e: EventoAgente) => {
      setPasos((p) => aplicarEvento(p, e));
      if (e.tipo === 'uso') setUsoVivo(e.uso);
      if (e.tipo === 'herramienta') nombres.set(e.id, describirEntrada(e.nombre, e.entrada));
      if (e.tipo === 'resultado' && e.nombre !== 'proponer_respuesta') {
        void registrar({
          actor: 'agente',
          tipo: e.error
            ? 'error_fuente'
            : e.nombre === 'buscar_titular'
              ? 'busqueda'
              : 'herramienta',
          solicitudId: sol.id,
          detalle: `${nombres.get(e.id) ?? e.nombre} → ${e.resumen}`,
        });
      }
      if (e.tipo === 'reintento') {
        void registrar({
          actor: 'agente',
          tipo: 'error_fuente',
          solicitudId: sol.id,
          detalle: `Reintento ${e.intento} en ${e.fuenteId}: ${e.mensaje}`,
        });
      }
    };
    try {
      const r = claveApi
        ? await investigarSolicitud({
            cliente: crearCliente(claveApi),
            modelo: ajustes.modelo,
            empresa: empresa.empresa,
            solicitud: sol,
            conectores: fuentes,
            alEvento,
            signal: ctrl.signal,
            instruccionesExtra: instrucciones,
          })
        : await investigarDemo({
            empresa: empresa.empresa,
            solicitud: sol,
            conectores: fuentes,
            alEvento,
            signal: ctrl.signal,
          });
      const version = sol.versionBorrador + 1;
      await guardarSolicitud({
        ...sol,
        estado: 'borrador',
        propuesta: r.propuesta,
        borradorEditado: undefined,
        revisiones: {},
        versionBorrador: version,
        uso: sumarUso(sol.uso, r.uso),
      });
      setBorrador(r.propuesta.borrador);
      await registrar({
        actor: 'agente',
        tipo: 'borrador',
        solicitudId: sol.id,
        detalle: `Borrador versión ${version}: ${r.propuesta.hallazgos.length} hallazgo(s), ${r.propuesta.hallazgos.filter((h) => h.dudoso).length} dudoso(s), ${r.propuesta.acciones.length} acción(es) propuesta(s). Costo estimado ${usd(r.uso.costoUsd)}`,
      });
    } catch (e) {
      const mensaje = ctrl.signal.aborted
        ? 'Investigación cancelada por el encargado'
        : describirError(e);
      setError(mensaje);
      await guardarSolicitud({ ...sol, estado: anterior });
      await registrar({
        actor: 'sistema',
        tipo: 'error_fuente',
        solicitudId: sol.id,
        detalle: `La investigación no terminó: ${mensaje}`,
      });
    } finally {
      setCorriendo(false);
      control.current = null;
    }
  }

  async function revisar(h: Hallazgo, r: RevisionHallazgo) {
    await guardarSolicitud({ ...sol, revisiones: { ...sol.revisiones, [clave(h)]: r } });
    await registrar({
      actor: 'persona',
      tipo: 'revision_hallazgo',
      solicitudId: sol.id,
      detalle: `${r === 'confirmado' ? 'Confirmó' : 'Descartó'} la coincidencia dudosa ${clave(h)} (${h.motivo})`,
    });
  }

  async function guardarEdicion() {
    const original = sol.borradorEditado ?? propuesta?.borrador ?? '';
    if (borrador === original) return;
    await guardarSolicitud({ ...sol, borradorEditado: borrador });
    await registrar({
      actor: 'persona',
      tipo: 'edicion',
      solicitudId: sol.id,
      detalle: `Editó el borrador (versión ${sol.versionBorrador}, ${borrador.length} caracteres)`,
    });
  }

  /** Aprobación humana, PDF y envío por Gmail o descarga (RF-16, RF-17, RG-05, RG-08). */
  async function aprobar() {
    if (!propuesta) return;
    await guardarEdicion();
    const hallazgos = propuesta.hallazgos.filter(
      (h) => !h.dudoso || sol.revisiones[clave(h)] === 'confirmado',
    );
    await registrar({
      actor: 'persona',
      tipo: 'aprobacion',
      solicitudId: sol.id,
      detalle: `Aprobó la versión ${sol.versionBorrador} de la respuesta con ${hallazgos.length} hallazgo(s)`,
    });
    const ahora = new Date();
    let pdf: Blob;
    try {
      pdf = await generarPdfRespuesta({
        empresa: empresa.empresa,
        solicitud: sol,
        propuesta,
        texto: borrador,
        hallazgos,
        fecha: ahora,
        nombresFuente: NOMBRE_FUENTE,
      });
    } catch (e) {
      toast({
        body: `No se pudo generar el PDF: ${e instanceof Error ? e.message : String(e)}`,
        type: 'error',
      });
      await registrar({
        actor: 'sistema',
        tipo: 'no_enviado',
        solicitudId: sol.id,
        detalle: 'Falló la generación del PDF; la respuesta no se envió',
      });
      return;
    }
    const nombrePdf = `respuesta-${sol.id}.pdf`;
    if (sol.derecho === 'portabilidad') {
      descargar(
        exportarDatosTitularXlsx(hallazgos, NOMBRE_FUENTE),
        `datos-${sol.id}.xlsx`,
        XLSX_MIME,
      );
    }
    let estado: Solicitud['estado'] = 'no_enviada';
    if (puedeEnviarGmail && sol.gmail) {
      const para = sol.gmail.remitente;
      const asunto = sol.asunto.toLowerCase().startsWith('re:') ? sol.asunto : `Re: ${sol.asunto}`;
      try {
        const ap = await fetch('/api/aprobaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ solicitudId: sol.id, para, asunto, cuerpo: borrador }),
        });
        const apJson = (await ap.json()) as { aprobacion?: string; error?: string };
        if (!ap.ok || !apJson.aprobacion)
          throw new Error(apJson.error ?? 'No se obtuvo la aprobación');
        const env = await fetch('/api/gmail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            aprobacion: apJson.aprobacion,
            solicitudId: sol.id,
            para,
            asunto,
            cuerpo: borrador,
            threadId: sol.gmail.threadId,
            inReplyTo: sol.gmail.messageIdHeader,
            pdfBase64: await blobABase64(pdf),
            pdfNombre: nombrePdf,
          }),
        });
        const envJson = (await env.json()) as { enviado?: boolean; error?: string };
        if (!env.ok || !envJson.enviado)
          throw new Error(envJson.error ?? 'Gmail no confirmó el envío');
        estado = 'enviada';
        await registrar({
          actor: 'persona',
          tipo: 'envio',
          solicitudId: sol.id,
          detalle: `Respuesta enviada por Gmail a ${para} en el mismo hilo, con ${nombrePdf} adjunto`,
        });
        toast({ body: `Respuesta enviada a ${para}` });
      } catch (e) {
        estado = 'aprobada';
        descargar(pdf, nombrePdf);
        await registrar({
          actor: 'sistema',
          tipo: 'no_enviado',
          solicitudId: sol.id,
          detalle: `No se pudo enviar por Gmail (${e instanceof Error ? e.message : String(e)}); se descargó el PDF`,
        });
        toast({
          body: `No se pudo enviar: ${e instanceof Error ? e.message : String(e)}. Se descargó el PDF.`,
          type: 'error',
        });
      }
    } else {
      descargar(pdf, nombrePdf);
      await registrar({
        actor: 'sistema',
        tipo: 'no_enviado',
        solicitudId: sol.id,
        detalle: gmail.conectado
          ? 'Solicitud simulada: el titular es ficticio, así que no se envía correo. Se descargó el PDF.'
          : 'Gmail no está conectado: respuesta registrada como «no enviado» y PDF descargado.',
      });
      toast({ body: 'Respuesta aprobada. Se descargó el PDF (no enviado por correo).' });
    }
    await guardarSolicitud({
      ...sol,
      estado,
      borradorEditado: borrador,
      respondidaEn: ahora.toISOString(),
    });
  }

  async function confirmarDialogo() {
    const texto = textoDialogo.trim();
    if (!texto) return;
    const tipo = dialogo;
    setDialogo(null);
    setTextoDialogo('');
    if (tipo === 'prorroga') {
      await guardarSolicitud({
        ...sol,
        prorroga: { motivo: texto, registradaEn: new Date().toISOString() },
      });
      await registrar({
        actor: 'persona',
        tipo: 'prorroga',
        solicitudId: sol.id,
        detalle: `Registró una prórroga de 30 días: ${texto}`,
      });
    } else if (tipo === 'rechazo') {
      await guardarSolicitud({ ...sol, estado: 'rechazada' });
      await registrar({
        actor: 'persona',
        tipo: 'rechazo',
        solicitudId: sol.id,
        detalle: `Rechazó el borrador versión ${sol.versionBorrador}: ${texto}`,
      });
    } else if (tipo === 'version') {
      await registrar({
        actor: 'persona',
        tipo: 'nueva_version',
        solicitudId: sol.id,
        detalle: `Pidió otra versión: ${texto}`,
      });
      await investigar(texto);
    }
  }

  const uso = usoVivo ?? sol.uso;

  return (
    <Pantalla>
      <Encabezado
        titulo={`${sol.id} · ${sol.titular.nombre}`}
        descripcion={`${DERECHO_ETIQUETA[sol.derecho]} · ${ESTADO_ETIQUETA[sol.estado]}`}
        acciones={
          <>
            <Button label="Volver a la bandeja" variant="ghost" href="/" />
            {!sol.prorroga && !cerrada ? (
              <Button label="Registrar prórroga" onClick={() => setDialogo('prorroga')} />
            ) : null}
          </>
        }
      />

      <Section>
        <VStack gap={4}>
          <MetadataList columns="multi">
            <MetadataListItem label="Derecho ejercido">
              {DERECHO_ETIQUETA[sol.derecho]}
            </MetadataListItem>
            <MetadataListItem label="Plazo">
              <Plazo solicitud={sol} conVencimiento />
            </MetadataListItem>
            <MetadataListItem label="Recibida">
              {formatearFechaHora(sol.recibidaEn)}
            </MetadataListItem>
            <MetadataListItem label="Canal">
              {sol.canal === 'gmail' ? `Gmail (${sol.gmail?.remitente ?? ''})` : 'Simulada'}
            </MetadataListItem>
            <MetadataListItem label="RUT">{sol.titular.rut ?? 'No informado'}</MetadataListItem>
            <MetadataListItem label="Correo">
              {sol.titular.email ?? 'No informado'}
            </MetadataListItem>
            {sol.prorroga ? (
              <MetadataListItem label="Prórroga">{`${sol.prorroga.motivo} (registrada el ${formatearFecha(sol.prorroga.registradaEn)})`}</MetadataListItem>
            ) : null}
          </MetadataList>
          <VStack gap={1}>
            <Text weight="semibold">{sol.asunto}</Text>
            <Parrafos texto={sol.mensaje} />
          </VStack>
        </VStack>
      </Section>

      <Section>
        <VStack gap={3}>
          <HStack gap={2} justify="between" align="center" wrap="wrap">
            <Heading level={2}>Investigación del agente</Heading>
            <HStack gap={2}>
              {corriendo ? (
                <Button label="Cancelar" variant="ghost" onClick={() => control.current?.abort()} />
              ) : null}
              <Button
                label={propuesta ? 'Investigar de nuevo' : 'Investigar'}
                variant={propuesta ? 'secondary' : 'primary'}
                clickAction={() => investigar()}
                isLoading={corriendo}
                isDisabled={cerrada}
              />
            </HStack>
          </HStack>
          <Text color="secondary">
            {claveApi
              ? `El agente (${infoModelo(ajustes.modelo).etiqueta}) busca al titular en ${fuentes.length} fuentes y redacta la respuesta. No envía correos ni modifica datos.`
              : 'Modo demostración: el razonamiento está pregrabado, pero las búsquedas en las fuentes simuladas son reales. Configura tu clave para usar el agente.'}
          </Text>
          {error ? (
            <Banner status="error" title="La investigación no terminó" description={error} />
          ) : null}
          {pasos.length > 0 ? <BitacoraAgente pasos={pasos} /> : null}
          {uso?.modelo === 'demo' ? (
            <Text type="supporting" color="secondary">
              Modo demostración: sin consumo de tokens ni costo.
            </Text>
          ) : uso ? (
            <Text type="supporting" color="secondary">
              {`Uso acumulado de esta solicitud: ${uso.entrada.toLocaleString('es-CL')} tokens de entrada, ${uso.salida.toLocaleString('es-CL')} de salida, ${uso.cacheLectura.toLocaleString('es-CL')} leídos de caché · costo estimado ${usd(uso.costoUsd)}`}
            </Text>
          ) : null}
        </VStack>
      </Section>

      {propuesta ? (
        <>
          <Section>
            <VStack gap={3}>
              <Heading level={2}>Hallazgos</Heading>
              {pendientes.length > 0 ? (
                <Banner
                  status="warning"
                  title={`${pendientes.length} coincidencia(s) dudosa(s) por revisar`}
                  description="Confirma o descarta cada una antes de aprobar. Las descartadas no se incluyen en la respuesta."
                />
              ) : null}
              <Table
                data={propuesta.hallazgos}
                idKey={(h: Hallazgo) => clave(h)}
                verticalAlign="top"
                columns={[
                  {
                    key: 'fuente',
                    header: 'Fuente',
                    renderCell: (h: Hallazgo) => NOMBRE_FUENTE[h.fuenteId] ?? h.fuenteId,
                  },
                  {
                    key: 'registro',
                    header: 'Registro',
                    renderCell: (h: Hallazgo) => <Text type="code">{h.registroId}</Text>,
                  },
                  {
                    key: 'datos',
                    header: 'Datos encontrados',
                    renderCell: (h: Hallazgo) => (
                      <VStack gap={0.5}>
                        {Object.entries(h.datos)
                          .filter(([, v]) => v)
                          .slice(0, 8)
                          .map(([k, v]) => (
                            <Text key={k} type="supporting" maxLines={2}>{`${k}: ${v}`}</Text>
                          ))}
                        {h.contieneSensibles ? (
                          <Badge variant="warning" label="Contiene datos sensibles de salud" />
                        ) : null}
                      </VStack>
                    ),
                  },
                  {
                    key: 'confianza',
                    header: 'Confianza',
                    renderCell: (h: Hallazgo) => (
                      <VStack gap={0.5}>
                        <Text>{`${nivel(h.confianza)} (${Math.round(h.confianza * 100)} %)`}</Text>
                        <Text type="supporting" color="secondary">
                          {h.motivo}
                        </Text>
                      </VStack>
                    ),
                  },
                  {
                    key: 'revision',
                    header: 'Revisión',
                    renderCell: (h: Hallazgo) => {
                      const r = sol.revisiones[clave(h)];
                      if (!h.dudoso) return <Badge variant="success" label="Coincidencia segura" />;
                      if (r === 'confirmado')
                        return <Badge variant="success" label="Confirmado por el encargado" />;
                      if (r === 'descartado') return <Badge variant="neutral" label="Descartado" />;
                      return (
                        <VStack gap={1}>
                          <Badge variant="warning" label="Dudosa" />
                          <HStack gap={1} wrap="wrap">
                            <Button
                              size="sm"
                              label="Es el titular"
                              clickAction={() => revisar(h, 'confirmado')}
                              isDisabled={cerrada}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              label="Descartar"
                              clickAction={() => revisar(h, 'descartado')}
                              isDisabled={cerrada}
                            />
                          </HStack>
                        </VStack>
                      );
                    },
                  },
                ]}
              />
            </VStack>
          </Section>

          {DERECHOS_CON_ACCIONES.includes(sol.derecho) ? (
            <Section>
              <VStack gap={2}>
                <Heading level={2}>Acciones propuestas por fuente</Heading>
                <Text color="secondary">
                  El agente solo propone. Ninguna acción se ejecuta en las fuentes desde el
                  prototipo: la decide y la aplica una persona.
                </Text>
                {propuesta.acciones.length === 0 ? (
                  <Text>No hay acciones propuestas.</Text>
                ) : (
                  propuesta.acciones.map((a) => (
                    <Text key={`${a.fuenteId}:${a.registroId}`} display="block">
                      {`• ${NOMBRE_FUENTE[a.fuenteId] ?? a.fuenteId} (${a.registroId}): ${a.accion}. ${a.justificacion}`}
                    </Text>
                  ))
                )}
              </VStack>
            </Section>
          ) : null}

          <Section>
            <VStack gap={3}>
              <Heading level={2}>Borrador de respuesta</Heading>
              <TextArea
                label={`Borrador (versión ${sol.versionBorrador})`}
                description="Puedes editarlo. Las citas [fuente:registro] indican de dónde sale cada dato."
                value={borrador}
                onChange={setBorrador}
                onBlur={() => void guardarEdicion()}
                rows={20}
                isReadOnly={cerrada || corriendo}
              />
              {cerrada ? (
                <Banner
                  status="success"
                  title={`Respuesta ${ESTADO_ETIQUETA[sol.estado].toLowerCase()} el ${formatearFecha(sol.respondidaEn!)}`}
                />
              ) : (
                <HStack gap={2} wrap="wrap" align="center">
                  <Button
                    label={
                      puedeEnviarGmail ? 'Aprobar y enviar por Gmail' : 'Aprobar y descargar PDF'
                    }
                    variant="primary"
                    clickAction={aprobar}
                    isDisabled={corriendo || pendientes.length > 0 || !borrador.trim()}
                    tooltip={
                      pendientes.length > 0 ? 'Primero revisa las coincidencias dudosas' : undefined
                    }
                  />
                  <Button
                    label="Pedir otra versión"
                    onClick={() => setDialogo('version')}
                    isDisabled={corriendo}
                  />
                  <Button
                    label="Rechazar borrador"
                    variant="destructive"
                    onClick={() => setDialogo('rechazo')}
                    isDisabled={corriendo}
                  />
                  {!puedeEnviarGmail ? (
                    <Text type="supporting" color="secondary">
                      {gmail.conectado
                        ? 'Solicitud simulada: no se envía correo a titulares ficticios.'
                        : 'Gmail no conectado: el envío quedará como «no enviado».'}
                    </Text>
                  ) : null}
                </HStack>
              )}
            </VStack>
          </Section>
        </>
      ) : null}

      <Dialog
        isOpen={dialogo !== null}
        onOpenChange={(o) => !o && setDialogo(null)}
        purpose="form"
        width={520}
      >
        <VStack gap={3}>
          <DialogHeader
            title={
              dialogo === 'prorroga'
                ? 'Registrar prórroga única de 30 días'
                : dialogo === 'version'
                  ? 'Pedir otra versión'
                  : 'Rechazar borrador'
            }
            onOpenChange={(o) => !o && setDialogo(null)}
          />
          <TextArea
            label={dialogo === 'version' ? 'Indicaciones para el agente' : 'Motivo'}
            value={textoDialogo}
            onChange={setTextoDialogo}
            rows={4}
            isRequired
          />
          <HStack gap={2} justify="end">
            <Button label="Cancelar" variant="ghost" onClick={() => setDialogo(null)} />
            <Button
              label="Confirmar"
              variant="primary"
              clickAction={confirmarDialogo}
              isDisabled={!textoDialogo.trim()}
            />
          </HStack>
        </VStack>
      </Dialog>
    </Pantalla>
  );
}
