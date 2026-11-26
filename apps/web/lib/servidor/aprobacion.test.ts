import { beforeAll, describe, expect, it } from 'vitest';
import { emitirAprobacion, verificarAprobacion } from './aprobacion';

const contenido = {
  solicitudId: 'GM-001',
  para: 'demo@example.com',
  asunto: 'Re: Solicitud',
  cuerpo: 'Texto aprobado',
};

describe('identificador de aprobación (RG-05)', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = 'secreto-de-prueba-solo-para-tests';
  });

  it('acepta el contenido exacto que se aprobó', () => {
    expect(verificarAprobacion(emitirAprobacion(contenido), contenido)).toBe(true);
  });

  it('rechaza si cambia el cuerpo o el destinatario', () => {
    const token = emitirAprobacion(contenido);
    expect(verificarAprobacion(token, { ...contenido, cuerpo: 'Otro texto' })).toBe(false);
    expect(verificarAprobacion(token, { ...contenido, para: 'otra@example.com' })).toBe(false);
  });

  it('rechaza firmas alteradas y aprobaciones vencidas', () => {
    const token = emitirAprobacion(contenido, 0);
    expect(verificarAprobacion(token, contenido, 16 * 60 * 1000)).toBe(false);
    const [h, exp] = emitirAprobacion(contenido).split('.');
    expect(verificarAprobacion(`${h}.${exp}.firmafalsa`, contenido)).toBe(false);
  });
});
