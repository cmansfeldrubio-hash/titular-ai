import { NextResponse } from 'next/server';
import { auth, googleConfigurado } from '@/auth';
import { casillaDemo } from '@/lib/servidor/gmail';

export const dynamic = 'force-dynamic';

/** Estado de la conexión con Gmail y el perfil del usuario, sin exponer tokens (RG-01). */
export async function GET() {
  if (!googleConfigurado) return NextResponse.json({ configurado: false, conectado: false });
  const sesion = await auth();
  return NextResponse.json({
    configurado: true,
    conectado: Boolean(sesion?.gmailConectado),
    cuenta: sesion?.user?.email ?? null,
    nombre: sesion?.user?.name ?? null,
    imagen: sesion?.user?.image ?? null,
    casilla: casillaDemo() || null,
  });
}
