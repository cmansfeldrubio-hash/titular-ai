'use client';

import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useId } from 'react';

export const NOMBRE_PRODUCTO = 'AI Titular';
export const DESCRIPCION_PRODUCTO =
  'Tu agente que responde las solicitudes de datos personales de la Ley 21.719';
export const DESCRIPCION_CORTA = 'Tu agente de solicitudes de datos personales';

/**
 * Logo de AI Titular: la persona dueña de los datos (el titular) dentro de un escudo
 * redondeado, con un arco de búsqueda y un destello que representa al agente de IA.
 */
export function LogoAITitular({
  tamano = 40,
  className,
  animado = false,
}: {
  tamano?: number;
  className?: string;
  /** Animación de entrada: el fondo crece, el arco se dibuja, aparece el titular y brilla el destello. */
  animado?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const parte = (nombre: string) => (animado ? `ai-logo-${nombre}` : undefined);
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 64 64"
      role="img"
      aria-label={NOMBRE_PRODUCTO}
      className={
        [className, animado ? 'ai-logo-animado' : ''].filter(Boolean).join(' ') || undefined
      }
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${id}-fondo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0E7490" />
          <stop offset="1" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      <rect
        className={parte('fondo')}
        x="2"
        y="2"
        width="60"
        height="60"
        rx="16"
        fill={`url(#${id}-fondo)`}
      />
      {/* Arco de búsqueda alrededor del titular */}
      <path
        className={parte('arco')}
        d="M12 38a19 19 0 0 1 25-23"
        pathLength={1}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* El titular */}
      <g className={parte('titular')}>
        <circle cx="29" cy="28" r="8" fill="#FFFFFF" />
        <path d="M14 52a15 13 0 0 1 30 0z" fill="#FFFFFF" />
      </g>
      {/* Destello: el agente de IA */}
      <path
        className={parte('destello')}
        d="M47 8 Q48.2 15.8 56 17 Q48.2 18.2 47 26 Q45.8 18.2 38 17 Q45.8 15.8 47 8Z"
        fill="#FDE68A"
      />
    </svg>
  );
}

/** Logo con el nombre y una descripción breve que le dice al usuario dónde está. */
export function MarcaAITitular({ tamano = 'grande' }: { tamano?: 'grande' | 'compacta' }) {
  if (tamano === 'compacta') {
    return (
      <HStack gap={2} align="center">
        <LogoAITitular tamano={32} />
        <VStack gap={0}>
          <Text weight="bold">{NOMBRE_PRODUCTO}</Text>
          <Text type="supporting" color="secondary">
            {DESCRIPCION_CORTA}
          </Text>
        </VStack>
      </HStack>
    );
  }
  return (
    <VStack gap={2} hAlign="center">
      <LogoAITitular tamano={72} animado />
      <Heading level={1} justify="center">
        {NOMBRE_PRODUCTO}
      </Heading>
      <Text color="secondary" justify="center" textWrap="balance">
        {DESCRIPCION_PRODUCTO}
      </Text>
    </VStack>
  );
}
