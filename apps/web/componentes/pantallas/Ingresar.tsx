'use client';

import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { conectarGmail } from '@/app/acciones';

/** Acceso restringido a las cuentas de ALLOWED_EMAILS (RG-02, RNF-05). */
export function Ingresar({ error }: { error?: string }) {
  return (
    <Center height="100dvh">
      <Card width={460} padding={6}>
        <VStack gap={4}>
          <Heading level={1}>Agente Ley 21.719</Heading>
          <Text color="secondary">
            Prototipo académico con datos ficticios. Solo pueden ingresar las cuentas autorizadas
            del equipo, el docente y los evaluadores.
          </Text>
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
            <Button type="submit" variant="primary" label="Ingresar con Google" width="100%" />
          </form>
          <Text type="supporting" color="secondary">
            Al ingresar se conecta la casilla de prueba de Gmail para leer solicitudes y enviar
            respuestas aprobadas.
          </Text>
        </VStack>
      </Card>
    </Center>
  );
}
