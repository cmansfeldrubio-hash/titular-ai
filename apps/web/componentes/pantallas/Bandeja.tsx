'use client';

import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Link } from '@astryxdesign/core/Link';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { useToast } from '@astryxdesign/core/Toast';
import {
  clasificarConModelo,
  clasificarPorReglas,
  crearCliente,
  describirError,
  type Clasificacion,
} from '@ley/agent';
import type { CorreoGmail } from '@ley/connectors';
import {
  calcularPlazo,
  DERECHO_ETIQUETA,
  ESTADO_ETIQUETA,
  formatearFecha,
  semaforo,
  type EstadoSolicitud,
  type Solicitud,
} from '@ley/domain';
import { useMemo, useState } from 'react';
import { Encabezado, Pantalla } from '@/componentes/Encabezado';
import { Plazo } from '@/componentes/Plazo';
import { useClave } from '@/lib/clave';
import { useEstado } from '@/lib/estado';

const VARIANTE_ESTADO: Record<
  EstadoSolicitud,
  'neutral' | 'info' | 'success' | 'warning' | 'error'
> = {
  nueva: 'info',
  en_investigacion: 'info',
  borrador: 'warning',
  aprobada: 'success',
  enviada: 'success',
  no_enviada: 'success',
  rechazada: 'neutral',
};

function abierta(s: Solicitud) {
  return !s.respondidaEn;
}

export function Bandeja() {
  const { solicitudes, gmail, conectorGmail, agregarSolicitudes, registrar, ajustes } = useEstado();
  const { clave } = useClave();
  const toast = useToast();
  const [leyendo, setLeyendo] = useState(false);

  const ordenadas = useMemo(
    () =>
      [...solicitudes].sort((a, b) => {
        if (abierta(a) !== abierta(b)) return abierta(a) ? -1 : 1;
        return (
          calcularPlazo(a.recibidaEn, a.prorroga).diasRestantes -
          calcularPlazo(b.recibidaEn, b.prorroga).diasRestantes
        );
      }),
    [solicitudes],
  );
  const conteo = { verde: 0, amarillo: 0, rojo: 0 };
  for (const s of solicitudes.filter(abierta))
    conteo[semaforo(calcularPlazo(s.recibidaEn, s.prorroga).diasRestantes)]++;

  /** Importa correos nuevos de Gmail y el agente los clasifica (RF-07, RF-10). */
  async function leerGmail() {
    setLeyendo(true);
    try {
      const correos: CorreoGmail[] = await conectorGmail.listar();
      const nuevos = correos.filter((c) => !solicitudes.some((s) => s.gmail?.messageId === c.id));
      const creadas: Solicitud[] = [];
      for (const c of nuevos) {
        let cl: Clasificacion;
        try {
          cl = clave
            ? await clasificarConModelo(crearCliente(clave), ajustes.modelo, c.cuerpo, {
                nombre: c.remitenteNombre,
                email: c.remitente,
              })
            : clasificarPorReglas(c.cuerpo, { nombre: c.remitenteNombre, email: c.remitente });
        } catch (e) {
          toast({
            body: `No se pudo clasificar con el modelo: ${describirError(e)}. Se usaron reglas.`,
            type: 'error',
          });
          cl = clasificarPorReglas(c.cuerpo, { nombre: c.remitenteNombre, email: c.remitente });
        }
        const s: Solicitud = {
          id: `GM-${String(solicitudes.length + creadas.length + 1).padStart(3, '0')}`,
          titular: cl.titular,
          derecho: cl.derecho,
          recibidaEn: c.fecha,
          canal: 'gmail',
          asunto: c.asunto,
          mensaje: c.cuerpo,
          estado: 'nueva',
          clasificadaPor: cl.por === 'agente' ? 'agente' : 'persona',
          gmail: {
            threadId: c.threadId,
            messageId: c.id,
            remitente: c.remitente,
            messageIdHeader: c.messageId,
          },
          revisiones: {},
          versionBorrador: 0,
          uso: cl.uso,
        };
        creadas.push(s);
        await registrar({
          actor: 'sistema',
          tipo: 'recepcion',
          solicitudId: s.id,
          detalle: `Correo recibido en Gmail: «${c.asunto}»`,
        });
        await registrar({
          actor: cl.por === 'agente' ? 'agente' : 'sistema',
          tipo: 'clasificacion',
          solicitudId: s.id,
          detalle: `Clasificada como ${DERECHO_ETIQUETA[cl.derecho]} (confianza ${cl.confianza}, por ${cl.por === 'agente' ? 'el agente' : 'reglas'}); titular: ${cl.titular.nombre}`,
        });
      }
      if (creadas.length) await agregarSolicitudes(creadas);
      toast({
        body: creadas.length
          ? `${creadas.length} solicitud(es) nueva(s) desde Gmail`
          : 'No hay correos nuevos en la casilla',
      });
    } catch (e) {
      toast({
        body: `Error al leer Gmail: ${e instanceof Error ? e.message : String(e)}`,
        type: 'error',
      });
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <Pantalla>
      <Encabezado
        titulo="Bandeja de solicitudes"
        descripcion="Plazo legal de 30 días corridos desde la recepción, prorrogable una vez por 30 días."
        acciones={
          gmail.conectado ? (
            <Button
              label="Leer Gmail"
              variant="primary"
              clickAction={leerGmail}
              isLoading={leyendo}
            />
          ) : null
        }
      />
      <HStack gap={4} wrap="wrap">
        <Text>{`Abiertas: ${conteo.verde + conteo.amarillo + conteo.rojo}`}</Text>
        <Text>{`En plazo: ${conteo.verde}`}</Text>
        <Text>{`Atención (10 a 4 días): ${conteo.amarillo}`}</Text>
        <Text weight="semibold">{`Urgentes (3 días o menos): ${conteo.rojo}`}</Text>
      </HStack>
      <Table
        data={ordenadas}
        idKey="id"
        hasHover
        columns={[
          {
            key: 'titular',
            header: 'Solicitud',
            renderCell: (s: Solicitud) => (
              <Link
                href={`/solicitudes/${encodeURIComponent(s.id)}`}
              >{`${s.id} · ${s.titular.nombre}`}</Link>
            ),
          },
          {
            key: 'derecho',
            header: 'Derecho',
            renderCell: (s: Solicitud) => DERECHO_ETIQUETA[s.derecho],
          },
          {
            key: 'recibidaEn',
            header: 'Recibida',
            renderCell: (s: Solicitud) => formatearFecha(s.recibidaEn),
          },
          { key: 'plazo', header: 'Plazo', renderCell: (s: Solicitud) => <Plazo solicitud={s} /> },
          {
            key: 'estado',
            header: 'Estado',
            renderCell: (s: Solicitud) => (
              <Badge variant={VARIANTE_ESTADO[s.estado]} label={ESTADO_ETIQUETA[s.estado]} />
            ),
          },
          {
            key: 'canal',
            header: 'Canal',
            renderCell: (s: Solicitud) => (s.canal === 'gmail' ? 'Gmail' : 'Formulario web'),
          },
        ]}
      />
    </Pantalla>
  );
}
