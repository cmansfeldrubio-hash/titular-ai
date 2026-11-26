import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth, googleConfigurado } from '@/auth';
import { emitirAprobacion } from '@/lib/servidor/aprobacion';
import { destinatarioPermitido } from '@/lib/servidor/gmail';

const Entrada = z.object({
  solicitudId: z.string().min(1),
  para: z.string().email(),
  asunto: z.string().min(1).max(300),
  cuerpo: z.string().min(1).max(50_000),
});

/** Registra la aprobación humana y entrega el identificador que exige el envío (RG-05). */
export async function POST(req: NextRequest) {
  if (!googleConfigurado || !(await auth()))
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const parsed = Entrada.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  if (!destinatarioPermitido(parsed.data.para)) {
    return NextResponse.json(
      { error: 'El destinatario no está en la lista de direcciones permitidas (RG-07)' },
      { status: 403 },
    );
  }
  return NextResponse.json({ aprobacion: emitirAprobacion(parsed.data) });
}
