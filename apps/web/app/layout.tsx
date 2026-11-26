import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';
import { Proveedores } from './proveedores';

export const metadata: Metadata = {
  title: 'Agente Ley 21.719 · Prototipo académico',
  description: 'Prototipo académico con datos ficticios. No es asesoría legal.',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Leer los encabezados vuelve dinámica la página, necesario para el nonce de la CSP.
  await headers();
  return (
    <html lang="es-CL">
      <body>
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
