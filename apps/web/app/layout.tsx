import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';
import { Proveedores } from './proveedores';

export const metadata: Metadata = {
  title: 'AI Titular',
  description: 'Tu agente que responde las solicitudes de datos personales de la Ley 21.719.',
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
