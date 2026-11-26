'use client';

import { AppShell } from '@astryxdesign/core/AppShell';
import { Badge } from '@astryxdesign/core/Badge';
import { Center } from '@astryxdesign/core/Center';
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { DESCRIPCION_CORTA, LogoAITitular, NOMBRE_PRODUCTO } from '@/componentes/Marca';
import { UsuarioMenu } from '@/componentes/UsuarioMenu';
import { useEstado } from '@/lib/estado';
import { calcularPlazo } from '@ley/domain';

const NAV = [
  { href: '/', label: 'Bandeja de solicitudes', icon: 'calendar' as const },
  { href: '/inventario', label: 'Inventario de datos', icon: 'search' as const },
  { href: '/bitacora', label: 'Bitácora', icon: 'clock' as const },
  { href: '/reportes', label: 'Reportes', icon: 'upload' as const },
  { href: '/configuracion', label: 'Configuración', icon: 'wrench' as const },
];

/** Marco de la app: menú lateral contraíble con el usuario conectado, y contenido. */
export function Shell({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const { cargado, solicitudes, empresa, gmail } = useEstado();
  const [contraido, setContraido] = useState(false);
  const urgentes = solicitudes.filter(
    (s) => !s.respondidaEn && calcularPlazo(s.recibidaEn, s.prorroga).diasRestantes <= 3,
  ).length;

  const seleccionado = (href: string) =>
    href === '/' ? ruta === '/' || ruta.startsWith('/solicitudes') : ruta.startsWith(href);

  return (
    <AppShell
      sideNav={
        <SideNav
          header={
            <SideNavHeading
              heading={NOMBRE_PRODUCTO}
              subheading={DESCRIPCION_CORTA}
              icon={<LogoAITitular tamano={28} />}
            />
          }
          collapsible={{
            isCollapsed: contraido,
            onCollapsedChange: setContraido,
            hasButton: true,
          }}
          footer={
            <VStack padding={2} gap={2}>
              {contraido ? null : (
                <VStack gap={0.5}>
                  <Text type="supporting" color="secondary">
                    {empresa.empresa.nombre}
                  </Text>
                  <Text type="supporting" color="secondary">
                    Rol: encargado de cumplimiento
                  </Text>
                </VStack>
              )}
              <UsuarioMenu gmail={gmail} compacto={contraido} />
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
        <VStack className="ai-entrada">{children}</VStack>
      ) : (
        <Center height="60dvh">
          <Spinner size="lg" label="Cargando el estado local…" />
        </Center>
      )}
    </AppShell>
  );
}
