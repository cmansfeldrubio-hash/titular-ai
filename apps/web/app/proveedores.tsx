'use client';

import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import { LinkProvider } from '@astryxdesign/core/Link';
import { Theme } from '@astryxdesign/core/theme';
import esES from '@astryxdesign/core/locales/es-ES.generated.js';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { ProveedorClave } from '@/lib/clave';

export function Proveedores({ children }: { children: ReactNode }) {
  return (
    <Theme theme={themes[defaultThemeSlug as keyof typeof themes]}>
      <InternationalizationProvider locale="es-CL" messages={{ es: esES }}>
        <LinkProvider component={Link}>
          <ProveedorClave>{children}</ProveedorClave>
        </LinkProvider>
      </InternationalizationProvider>
    </Theme>
  );
}
