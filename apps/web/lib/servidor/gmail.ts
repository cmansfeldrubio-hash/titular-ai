import 'server-only';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { cuentasPermitidas, googleConfigurado, renovarToken, type TokensGoogle } from '@/auth';
import type { CorreoGmail } from '@ley/connectors';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export function casillaDemo(): string {
  return (process.env.DEMO_INBOX_ADDRESS ?? '').trim().toLowerCase();
}

/** Ningún correo sale fuera de ALLOWED_EMAILS y DEMO_INBOX_ADDRESS (RG-07). */
export function destinatarioPermitido(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e !== '' && (e === casillaDemo() || cuentasPermitidas().includes(e));
}

/** Obtiene el token de Google desde la cookie cifrada, renovándolo si venció. Solo en el servidor. */
export async function tokenGmail(req: NextRequest): Promise<string | null> {
  if (!googleConfigurado) return null;
  const secureCookie = (process.env.AUTH_URL ?? req.nextUrl.origin).startsWith('https');
  const jwt = (await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie })) as {
    google?: TokensGoogle;
  } | null;
  if (!jwt?.google || jwt.google.error) return null;
  if (Date.now() / 1000 < jwt.google.expiraEn - 60) return jwt.google.accessToken;
  const nuevo = await renovarToken(jwt.google);
  return nuevo.error ? null : nuevo.accessToken;
}

async function gmail<T>(token: string, ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

interface Parte {
  mimeType?: string;
  body?: { data?: string };
  parts?: Parte[];
  headers?: { name: string; value: string }[];
}

const b64url = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

function textoPlano(p: Parte): string {
  if (p.mimeType === 'text/plain' && p.body?.data) return b64url(p.body.data);
  for (const h of p.parts ?? []) {
    const t = textoPlano(h);
    if (t) return t;
  }
  if (p.mimeType === 'text/html' && p.body?.data)
    return b64url(p.body.data).replace(/<[^>]+>/g, ' ');
  return '';
}

function separarRemitente(from: string): { nombre: string; email: string } {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  return m
    ? { nombre: (m[1] ?? '').trim(), email: (m[2] ?? '').trim().toLowerCase() }
    : { nombre: '', email: from.trim().toLowerCase() };
}

/** Correos de la casilla que parecen solicitudes de titulares (RG-04). */
export async function listarSolicitudes(
  token: string,
): Promise<(CorreoGmail & { messageIdHeader: string })[]> {
  const q = encodeURIComponent(
    'in:inbox newer_than:90d (label:ley21719 OR subject:(solicitud OR derecho OR "datos personales" OR "21.719"))',
  );
  const lista = await gmail<{ messages?: { id: string; threadId: string }[] }>(
    token,
    `/messages?q=${q}&maxResults=25`,
  );
  const mensajes = await Promise.all(
    (lista.messages ?? []).map((m) =>
      gmail<{
        id: string;
        threadId: string;
        internalDate: string;
        snippet: string;
        payload: Parte;
      }>(token, `/messages/${m.id}?format=full`),
    ),
  );
  return (
    mensajes
      .map((m) => {
        const h = (n: string) =>
          m.payload.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? '';
        return { m, h };
      })
      // Se excluyen las respuestas que envía la propia app.
      .filter(({ h }) => h('X-Ley21719') !== 'respuesta')
      .map(({ m, h }) => {
        const de = separarRemitente(h('From'));
        return {
          id: m.id,
          threadId: m.threadId,
          remitente: de.email,
          remitenteNombre: de.nombre,
          asunto: h('Subject'),
          fecha: new Date(Number(m.internalDate)).toISOString(),
          extracto: m.snippet,
          cuerpo: textoPlano(m.payload).slice(0, 8000),
          messageIdHeader: h('Message-ID'),
        };
      })
  );
}

const encabezado = (s: string) => `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;

export interface CorreoSaliente {
  para: string;
  asunto: string;
  cuerpo: string;
  tipo: 'respuesta' | 'simulada';
  threadId?: string;
  inReplyTo?: string;
  adjunto?: { nombre: string; base64: string; mime: string };
}

/** Envía un correo MIME desde la casilla de prueba, en el mismo hilo si corresponde (RG-05). */
export async function enviarCorreo(
  token: string,
  c: CorreoSaliente,
): Promise<{ id: string; threadId: string }> {
  if (!destinatarioPermitido(c.para)) throw new Error('Destinatario no permitido');
  const limite = `ley21719_${crypto.randomUUID()}`;
  const lineas = [
    `From: ${casillaDemo()}`,
    `To: ${c.para}`,
    `Subject: ${encabezado(c.asunto)}`,
    'MIME-Version: 1.0',
    `X-Ley21719: ${c.tipo}`,
    ...(c.inReplyTo ? [`In-Reply-To: ${c.inReplyTo}`, `References: ${c.inReplyTo}`] : []),
    `Content-Type: multipart/mixed; boundary="${limite}"`,
    '',
    `--${limite}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(c.cuerpo, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n'),
    ...(c.adjunto
      ? [
          `--${limite}`,
          `Content-Type: ${c.adjunto.mime}; name="${c.adjunto.nombre}"`,
          `Content-Disposition: attachment; filename="${c.adjunto.nombre}"`,
          'Content-Transfer-Encoding: base64',
          '',
          c.adjunto.base64.replace(/.{76}/g, '$&\r\n'),
        ]
      : []),
    `--${limite}--`,
  ];
  const raw = Buffer.from(lineas.join('\r\n'), 'utf8').toString('base64url');
  return gmail(token, '/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw, ...(c.threadId ? { threadId: c.threadId } : {}) }),
  });
}
