import { describe, expect, it } from 'vitest';
import {
  calcularDv,
  calcularMetricas,
  calcularPlazo,
  esRutValido,
  extraerRuts,
  formatearFecha,
  formatearRut,
  normalizarRut,
  semaforo,
  similitudNombre,
  textoPlazo,
  type Solicitud,
} from './index';

describe('RUT', () => {
  it('calcula el dígito verificador', () => {
    expect(calcularDv('11111111')).toBe('1');
    expect(calcularDv('12345678')).toBe('5');
    expect(calcularDv('10000013')).toBe('K');
  });
  it('valida con y sin puntos', () => {
    expect(esRutValido('12.345.678-5')).toBe(true);
    expect(esRutValido('123456785')).toBe(true);
    expect(esRutValido('12.345.678-4')).toBe(false);
  });
  it('normaliza y formatea', () => {
    expect(normalizarRut('12.345.678-k')).toBe('12345678K');
    expect(formatearRut('123456785')).toBe('12.345.678-5');
    expect(formatearRut('123456785', false)).toBe('12345678-5');
  });
  it('extrae RUT válidos de un texto', () => {
    expect(extraerRuts('Mi RUT es 12.345.678-5 y no 11.111.111-2')).toEqual(['12.345.678-5']);
  });
});

describe('plazos', () => {
  const recibida = '2026-11-01T15:00:00Z';
  it('cuenta 30 días corridos', () => {
    const p = calcularPlazo(recibida, undefined, new Date('2026-11-01T18:00:00Z'));
    expect(p.diasRestantes).toBe(30);
    expect(p.vence).toBe('2026-12-01');
  });
  it('suma una prórroga de 30 días', () => {
    const p = calcularPlazo(
      recibida,
      { motivo: 'x', registradaEn: recibida },
      new Date('2026-11-01T18:00:00Z'),
    );
    expect(p.diasRestantes).toBe(60);
  });
  it('semáforo según días restantes', () => {
    expect(semaforo(11)).toBe('verde');
    expect(semaforo(10)).toBe('amarillo');
    expect(semaforo(4)).toBe('amarillo');
    expect(semaforo(3)).toBe('rojo');
    expect(semaforo(-2)).toBe('rojo');
  });
  it('texto del plazo', () => {
    expect(textoPlazo(0)).toBe('Vence hoy');
    expect(textoPlazo(-1)).toBe('Vencida hace 1 día');
    expect(textoPlazo(5)).toBe('Quedan 5 días');
  });
  it('formatea fechas DD-MM-AAAA en Santiago', () => {
    // 02:00 UTC del 2 de noviembre es todavía 1 de noviembre en Santiago (UTC-3)
    expect(formatearFecha('2026-11-02T02:00:00Z')).toBe('01-11-2026');
  });
});

describe('nombres', () => {
  it('tolera tildes y orden de apellidos', () => {
    expect(similitudNombre('José Pérez Soto', 'jose perez soto')).toBe(1);
    expect(similitudNombre('María José Rojas', 'Rojas Maria Jose')).toBe(1);
    expect(similitudNombre('Ana Díaz', 'Pedro Soto')).toBe(0);
  });
});

describe('métricas', () => {
  const base = {
    titular: { nombre: 'A' },
    derecho: 'acceso',
    canal: 'simulada',
    asunto: '',
    mensaje: '',
    clasificadaPor: 'semilla',
    revisiones: {},
    versionBorrador: 0,
  } as const;
  it('calcula respondidas en plazo y vencidas', () => {
    const solicitudes: Solicitud[] = [
      {
        ...base,
        id: '1',
        recibidaEn: '2026-10-01T12:00:00Z',
        estado: 'enviada',
        respondidaEn: '2026-10-10T12:00:00Z',
      },
      {
        ...base,
        id: '2',
        recibidaEn: '2026-09-01T12:00:00Z',
        estado: 'enviada',
        respondidaEn: '2026-10-20T12:00:00Z',
      },
      { ...base, id: '3', recibidaEn: '2026-10-01T12:00:00Z', estado: 'nueva' },
    ];
    const m = calcularMetricas(solicitudes, new Date('2026-11-25T12:00:00Z'));
    expect(m.recibidas).toBe(3);
    expect(m.respondidas).toBe(2);
    expect(m.respondidasEnPlazo).toBe(1);
    expect(m.porcentajeEnPlazo).toBe(50);
    expect(m.vencidas).toBe(1);
    expect(m.tiempoPromedioDias).toBe(29);
  });
});
