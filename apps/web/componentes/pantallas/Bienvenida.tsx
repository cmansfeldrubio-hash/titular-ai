'use client';

import { Button } from '@astryxdesign/core/Button';
import { Center } from '@astryxdesign/core/Center';
import { HStack } from '@astryxdesign/core/HStack';
import { Spinner } from '@astryxdesign/core/Spinner';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MarcaAITitular } from '@/componentes/Marca';

/** Tiempo en que aparece cada paso y en que se pasa al panel (ms). */
const TIEMPOS = [450, 900, 1350, 1900, 2250];

/** Transición tras el ingreso: confirma la sesión y Gmail, y entra al panel de control. */
export function Bienvenida({
  nombre,
  gmailConectado,
}: {
  nombre: string | null;
  gmailConectado: boolean;
}) {
  const router = useRouter();
  const [fase, setFase] = useState(0);

  useEffect(() => {
    router.prefetch('/');
    const temporizadores = TIEMPOS.map((t, i) =>
      setTimeout(() => (i === TIEMPOS.length - 1 ? router.replace('/') : setFase(i + 1)), t),
    );
    return () => temporizadores.forEach(clearTimeout);
  }, [router]);

  const pasos = [
    { texto: 'Sesión iniciada con Google', listo: true },
    {
      texto: gmailConectado
        ? 'Casilla de Gmail conectada'
        : 'Gmail sin conectar: verás las solicitudes del formulario web',
      listo: gmailConectado,
    },
    { texto: 'Preparando tu panel de control…', listo: false, cargando: true },
  ];

  return (
    <Center height="100dvh">
      <VStack
        gap={6}
        hAlign="center"
        maxWidth={460}
        padding={6}
        className={fase >= 4 ? 'ai-salida' : 'ai-entrada'}
      >
        <MarcaAITitular />
        <Text type="large" weight="semibold" justify="center">
          {nombre ? `Hola, ${nombre}` : 'Hola'}
        </Text>
        <VStack gap={2}>
          {pasos.slice(0, fase).map((p) => (
            <HStack key={p.texto} gap={2} align="center" className="ai-paso">
              {p.cargando ? (
                <Spinner size="sm" aria-label="Cargando" />
              ) : (
                <StatusDot
                  variant={p.listo ? 'success' : 'warning'}
                  label={p.listo ? 'Listo' : 'Aviso'}
                />
              )}
              <Text>{p.texto}</Text>
            </HStack>
          ))}
        </VStack>
        <Button
          label="Ir al panel ahora"
          variant="ghost"
          size="sm"
          onClick={() => router.replace('/')}
        />
      </VStack>
    </Center>
  );
}
