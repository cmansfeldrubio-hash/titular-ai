import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verificarAprobacion } from '@/lib/servidor/aprobacion';
import { destinatarioPermitido, enviarCorreo, tokenGmail } from '@/lib/servidor/gmail';

const Entrada = z.object({
  aprobacion: z.string().min(1),
  solicitudId: z.string().min(1),
  para: z.string().email(),
  asunto: z.string().min(1).max(300),
  cuerpo: z.string().min(1).max(50_000),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  pdfBase64: z.string().max(8_000_000),
  pdfNombre: z.string().regex(/^[\w.-]+\.pdf$/),
});

/** Envía la respuesta aprobada en el mismo hilo, con el PDF adjunto (RG-05, RG-07). */
export async function POST(req: NextRequest) {
  const token = await tokenGmail(req);
  if (!token) return NextResponse.json({ error: 'Gmail no está conectado' }, { status: 401 });
  const parsed = Entrada.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;
  if (!verificarAprobacion(d.aprobacion, d)) {
    return NextResponse.json(
      { error: 'Falta una aprobación válida para este contenido' },
      { status: 403 },
    );
  }
  if (!destinatarioPermitido(d.para)) {
    return NextResponse.json({ error: 'Destinatario no permitido (RG-07)' }, { status: 403 });
  }
  try {
    const r = await enviarCorreo(token, {
      para: d.para,
      asunto: d.asunto,
      cuerpo: d.cuerpo,
      tipo: 'respuesta',
      threadId: d.threadId,
      inReplyTo: d.inReplyTo,
      adjunto: { nombre: d.pdfNombre, base64: d.pdfBase64, mime: 'application/pdf' },
    });
    return NextResponse.json({ enviado: true, id: r.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error de Gmail' },
      { status: 502 },
    );
  }
}
