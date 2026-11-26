import type { ReactNode } from 'react';
import { Shell } from '@/componentes/Shell';
import { ProveedorEstado } from '@/lib/estado';

export default function LayoutApp({ children }: { children: ReactNode }) {
  return (
    <ProveedorEstado>
      <Shell>{children}</Shell>
    </ProveedorEstado>
  );
}
