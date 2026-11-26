'use client';

import { HStack } from '@astryxdesign/core/HStack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { calcularPlazo, formatearDiaIso, semaforo, textoPlazo, type Solicitud } from '@ley/domain';

const VARIANTE = { verde: 'success', amarillo: 'warning', rojo: 'error' } as const;
const NOMBRE = { verde: 'En plazo', amarillo: 'Atención', rojo: 'Urgente' } as const;

/** Semáforo de plazo con texto junto al color: el estado nunca depende solo del color (RF-08, RNF-08). */
export function Plazo({
  solicitud,
  conVencimiento = false,
}: {
  solicitud: Solicitud;
  conVencimiento?: boolean;
}) {
  if (solicitud.respondidaEn) {
    return (
      <HStack gap={1} align="center">
        <StatusDot variant="neutral" label="Cerrada" />
        <Text>Cerrada</Text>
      </HStack>
    );
  }
  const p = calcularPlazo(solicitud.recibidaEn, solicitud.prorroga);
  const s = semaforo(p.diasRestantes);
  return (
    <HStack gap={1} align="center">
      <StatusDot variant={VARIANTE[s]} label={NOMBRE[s]} />
      <Text weight={s === 'rojo' ? 'semibold' : undefined}>
        {`${NOMBRE[s]}: ${textoPlazo(p.diasRestantes)}${conVencimiento ? ` · vence ${formatearDiaIso(p.vence)}` : ''}${p.conProrroga ? ' · con prórroga' : ''}`}
      </Text>
    </HStack>
  );
}
