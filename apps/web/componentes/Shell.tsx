'use client';

import { AppShell } from '@astryxdesign/core/AppShell';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Center } from '@astryxdesign/core/Center';
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useClave } from '@/lib/clave';
import { useEstado } from '@/lib/estado';
import { calcularPlazo } from '@ley/domain';

const NAV = [
  { href: '/', label: 'Bandeja de solicitudes', icon: 'calendar' as const },
  { href: '/inventario', label: 'Inventario de datos', icon: 'search' as const },
  { href: '/bitacora', label: 'Bitácora', icon: 'clock' as const },
  { href: '/reportes', label: 'Reportes', icon: 'upload' as const },
  { href: '/configuracion', label: 'Configuración', icon: 'wrench' as const },
];

/** Marco de la app: navegación, aviso permanente (RNF-14) e indicador de modo (RK-09). */
export function Shell({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const { cargado, solicitudes, empresa, gmail } = useEstado();
  const { clave } = useClave();
  const urgentes = solicitudes.filter(
    (s) => !s.respondidaEn && calcularPlazo(s.recibidaEn, s.prorroga).diasRestantes <= 3,
  ).length;

  const seleccionado = (href: string) =>
    href === '/' ? ruta === '/' || ruta.startsWith('/solicitudes') : ruta.startsWith(href);

  return (
    <AppShell
      banner={
        <Banner
          status="warning"
          container="section"
          collapsible={false}
          title="Prototipo académico · Datos ficticios · No es asesoría legal"
          description={`${empresa.empresa.nombre} es una empresa inventada. Modo: ${clave ? 'agente con tu clave de Anthropic' : 'demostración (respuestas del agente pregrabadas)'} · Gmail: ${gmail.conectado ? 'conectado' : 'no conectado (envíos registrados como «no enviado»)'}.`}
        />
      }
      sideNav={
        <SideNav
          header={
            <SideNavHeading heading="Agente Ley 21.719" subheading={empresa.empresa.nombre} />
          }
          footer={
            <VStack padding={2} gap={1}>
              <Text type="supporting" color="secondary">
                Rol: encargado de cumplimiento
              </Text>
            </VStack>
          }
        >
          <SideNavSection title="Cumplimiento" isHeaderHidden>
            {NAV.map((n) => (
              <SideNavItem
                key={n.href}
                label={n.label}
                href={n.href}
                as={Link}
                icon={n.icon}
                isSelected={seleccionado(n.href)}
                endContent={
                  n.href === '/' && urgentes > 0 ? (
                    <Badge variant="error" label={`${urgentes} urgentes`} />
                  ) : undefined
                }
              />
            ))}
          </SideNavSection>
        </SideNav>
      }
    >
      {cargado ? (
        children
      ) : (
        <Center height="60dvh">
          <Spinner size="lg" label="Cargando el estado local…" />
        </Center>
      )}
    </AppShell>
  );
}
