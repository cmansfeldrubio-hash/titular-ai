'use client';

import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Divider } from '@astryxdesign/core/Divider';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { CSSProperties } from 'react';
import { conectarGmail } from '@/app/acciones';
import { DESCRIPCION_PRODUCTO, LogoAITitular, NOMBRE_PRODUCTO } from '@/componentes/Marca';

const CAPACIDADES = [
  {
    icono: 'search',
    titulo: 'Encuentra a la persona en todas tus fuentes',
    detalle:
      'CRM, facturación, tienda, planillas, RR. HH. y marketing, aunque su nombre o RUT estén escritos distinto.',
  },
  {
    icono: 'copy',
    titulo: 'Redacta la respuesta citando cada dato',
    detalle: 'Cada dato del borrador indica de qué fuente y registro sale.',
  },
  {
    icono: 'clock',
    titulo: 'Cuida el plazo legal de 30 días',
    detalle: 'Semáforo por solicitud y registro de la prórroga.',
  },
  {
    icono: 'checkDouble',
    titulo: 'Tú decides',
    detalle: 'Nada se envía, borra ni modifica sin tu aprobación.',
  },
] as const;

/** Retraso de la animación de entrada de cada elemento, en milisegundos. */
const retraso = (ms: number) => ({ '--retraso': `${ms}ms` }) as CSSProperties;

/** Página de ingreso con animación inicial. Acceso solo para ALLOWED_EMAILS (RG-02, RNF-05). */
export function Ingresar({ error }: { error?: string }) {
  return (
    <VStack className="ai-ingreso-fondo" justify="center" padding={6}>
      <HStack gap={10} wrap="wrap" justify="center" align="center">
        <VStack gap={6} maxWidth={520}>
          <HStack gap={4} align="center">
            <LogoAITitular tamano={88} animado />
            <VStack gap={1}>
              <VStack className="ai-escalonado" style={retraso(500)}>
                <Heading level={1} type="display-2">
                  {NOMBRE_PRODUCTO}
                </Heading>
              </VStack>
              <VStack className="ai-escalonado" style={retraso(700)}>
                <Text type="large" color="secondary" textWrap="balance">
                  {DESCRIPCION_PRODUCTO}
                </Text>
              </VStack>
            </VStack>
          </HStack>

          <VStack gap={4}>
            {CAPACIDADES.map((c, i) => (
              <HStack
                key={c.titulo}
                gap={3}
                align="start"
                className="ai-escalonado"
                style={retraso(1000 + i * 150)}
              >
                <Icon icon={c.icono} color="teal" size="lg" />
                <VStack gap={0.5}>
                  <Text weight="semibold">{c.titulo}</Text>
                  <Text type="supporting" color="secondary">
                    {c.detalle}
                  </Text>
                </VStack>
              </HStack>
            ))}
          </VStack>
        </VStack>

        <VStack className="ai-escalonado" style={retraso(800)} width={400} maxWidth="100%">
          <Card width="100%" padding={6} elevation="med">
            <VStack gap={4}>
              <VStack gap={1}>
                <Heading level={2}>Ingresar</Heading>
                <Text color="secondary">
                  Entra con una cuenta autorizada del equipo, el docente o los evaluadores.
                </Text>
              </VStack>
              {error ? (
                <Banner
                  status="error"
                  title="No se pudo iniciar sesión"
                  description={
                    error === 'AccessDenied'
                      ? 'Esta cuenta no está en la lista de cuentas autorizadas.'
                      : 'Vuelve a intentarlo.'
                  }
                />
              ) : null}
              <form action={conectarGmail}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  label="Ingresar con Google"
                  width="100%"
                />
              </form>
              <Divider />
              <Text type="supporting" color="secondary">
                Al ingresar se conecta la casilla de prueba de Gmail: el agente lee las solicitudes
                que llegan y las respuestas salen solo después de que las apruebes.
              </Text>
            </VStack>
          </Card>
        </VStack>
      </HStack>
    </VStack>
  );
}
