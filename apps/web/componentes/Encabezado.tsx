'use client';

import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { ReactNode } from 'react';

/** Encabezado de pantalla: título, descripción y acciones. */
export function Encabezado({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <HStack gap={4} justify="between" align="start" wrap="wrap">
      <VStack gap={1}>
        <Heading level={1}>{titulo}</Heading>
        {descripcion ? <Text color="secondary">{descripcion}</Text> : null}
      </VStack>
      {acciones ? (
        <HStack gap={2} wrap="wrap">
          {acciones}
        </HStack>
      ) : null}
    </HStack>
  );
}

/** Contenedor de pantalla con ancho máximo y espaciado consistente. */
export function Pantalla({ children }: { children: ReactNode }) {
  return (
    <VStack gap={6} padding={6} maxWidth={1280}>
      {children}
    </VStack>
  );
}
