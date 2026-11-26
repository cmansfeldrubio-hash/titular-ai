import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { casillaDemo, enviarCorreo, tokenGmail } from '@/lib/servidor/gmail';

const Entrada = z.object({
  asunto: z.string().min(1).max(200),
  cuerpo: z.string().min(1).max(5000),
});

/** Envía a la casilla de prueba el correo de un titular ficticio, para preparar la demo (RG-06). */
export async function POST(req: NextRequest) {
  const token = await tokenGmail(req);
  if (!token) return NextResponse.json({ error: 'Gmail no está conectado' }, { status: 401 });
  const parsed = Entrada.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  try {
    // Siempre va a la casilla de prueba: el titular es ficticio y su correo no existe.
    const r = await enviarCorreo(token, {
      para: casillaDemo(),
      asunto: parsed.data.asunto,
      cuerpo: parsed.data.cuerpo,
      tipo: 'simulada',
    });
    return NextResponse.json({ enviado: true, id: r.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error de Gmail' },
      { status: 502 },
    );
  }
}
