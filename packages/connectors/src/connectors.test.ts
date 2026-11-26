import { generarEmpresa } from '@ley/mock-data';
import { describe, expect, it, vi } from 'vitest';
import { evaluarCoincidencia } from './coincidencia';
import { crearConectoresSimulados } from './fuentes';
import { conReintentos, ConectorSimulado } from './simulado';
import { ErrorFuente } from './tipos';

const empresa = generarEmpresa({ ahora: new Date('2026-11-25T12:00:00Z') });
const sinRed = { latenciaMs: [0, 0] as [number, number], tasaError: 0 };

describe('evaluarCoincidencia', () => {
  it('reconoce el RUT con o sin puntos', () => {
    const ev = evaluarCoincidencia({ rut: '12.345.678-5' }, { rut: '123456785', nombre: 'X' });
    expect(ev?.confianza).toBeGreaterThan(0.85);
    expect(ev?.dudoso).toBe(false);
  });
  it('marca como dudoso el mismo nombre con RUT distinto', () => {
    const ev = evaluarCoincidencia(
      { nombre: 'José Pérez Soto', rut: '12.345.678-5' },
      { nombre: 'JOSE PEREZ SOTO', rut: '11.111.111-1' },
    );
    expect(ev?.dudoso).toBe(true);
    expect(ev?.motivo).toMatch(/homónimo/);
  });
  it('no confunde personas distintas', () => {
    expect(
      evaluarCoincidencia({ nombre: 'Ana Díaz Soto' }, { nombre: 'Pedro Rojas Silva' }),
    ).toBeNull();
  });
});

describe('conectores simulados', () => {
  const conectores = crearConectoresSimulados(empresa, sinRed);

  it('son seis y exponen su esquema', async () => {
    expect(conectores.map((c) => c.id)).toEqual([
      'crm',
      'erp',
      'tienda',
      'planillas',
      'rrhh',
      'marketing',
    ]);
    const esquema = await conectores[4]!.describirEsquema();
    expect(esquema.campos.some((c) => c.sensible)).toBe(true);
  });

  it('encuentran a un titular de varias fuentes pese a las variaciones', async () => {
    const sol = empresa.solicitudes[0]!;
    const encontrados = [];
    for (const c of conectores) {
      const r = await c.buscarTitular(sol.titular);
      if (r.some((x) => !x.dudoso)) encontrados.push(c.id);
    }
    expect(encontrados.length).toBeGreaterThanOrEqual(3);
    expect(encontrados).toContain('rrhh');
  });

  it('marca al homónimo como dudoso', async () => {
    const sol = empresa.solicitudes[1]!; // persona con homónimo
    const crm = conectores[0]!;
    const tienda = conectores[2]!;
    const todos = [
      ...(await crm.buscarTitular(sol.titular)),
      ...(await tienda.buscarTitular(sol.titular)),
    ];
    expect(todos.some((x) => x.dudoso)).toBe(true);
  });

  it('lee las planillas desde un XLSX real', async () => {
    const m = await conectores[3]!.muestras(2);
    expect(m[0]?.datos).toHaveProperty('Cliente');
  });
});

describe('reintentos', () => {
  it('reintenta errores transitorios y luego tiene éxito', async () => {
    let n = 0;
    const alReintentar = vi.fn();
    const r = await conReintentos(
      async () => {
        n++;
        if (n < 3) throw new ErrorFuente('crm', 'falla');
        return 'ok';
      },
      { esperaBaseMs: 1, alReintentar },
    );
    expect(r).toBe('ok');
    expect(alReintentar).toHaveBeenCalledTimes(2);
  });

  it('simula errores según la tasa configurada', async () => {
    const [def] = crearConectoresSimulados(empresa, { latenciaMs: [0, 0], tasaError: 1 });
    const c = def as ConectorSimulado;
    await expect(c.describirEsquema()).rejects.toBeInstanceOf(ErrorFuente);
  });
});
