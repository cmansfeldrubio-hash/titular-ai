import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Identificador de aprobación (RG-05): firma con AUTH_SECRET la solicitud, el destinatario y el
 * contenido exacto aprobado. El envío solo procede si el contenido coincide y no venció.
 */
export interface ContenidoAprobado {
  solicitudId: string;
  para: string;
  asunto: string;
  cuerpo: string;
}

const VIGENCIA_MS = 15 * 60 * 1000;

export const huella = (c: ContenidoAprobado) =>
  createHash('sha256')
    .update(JSON.stringify([c.solicitudId, c.para.toLowerCase(), c.asunto, c.cuerpo]))
    .digest('base64url');

function firmar(datos: string): string {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto) throw new Error('AUTH_SECRET no está configurado');
  return createHmac('sha256', secreto).update(datos).digest('base64url');
}

export function emitirAprobacion(c: ContenidoAprobado, ahora = Date.now()): string {
  const datos = `${huella(c)}.${ahora + VIGENCIA_MS}`;
  return `${datos}.${firmar(datos)}`;
}

export function verificarAprobacion(
  token: string,
  c: ContenidoAprobado,
  ahora = Date.now(),
): boolean {
  const [h, exp, firma] = token.split('.');
  if (!h || !exp || !firma) return false;
  const esperada = Buffer.from(firmar(`${h}.${exp}`));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return false;
  return Number(exp) > ahora && h === huella(c);
}
