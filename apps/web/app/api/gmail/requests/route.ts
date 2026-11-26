import { NextResponse, type NextRequest } from 'next/server';
import { listarSolicitudes, tokenGmail } from '@/lib/servidor/gmail';

export const dynamic = 'force-dynamic';

/** Lista los correos de la casilla que parecen solicitudes de titulares (RG-04). */
export async function GET(req: NextRequest) {
  const token = await tokenGmail(req);
  if (!token) return NextResponse.json({ error: 'Gmail no está conectado' }, { status: 401 });
  try {
    const correos = await listarSolicitudes(token);
    return NextResponse.json({
      correos: correos.map(({ messageIdHeader, ...c }) => ({ ...c, messageId: messageIdHeader })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error de Gmail' },
      { status: 502 },
    );
  }
}
