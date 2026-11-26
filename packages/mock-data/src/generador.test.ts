import { esRutValido, normalizarRut } from '@ley/domain';
import { describe, expect, it } from 'vitest';
import { generarEmpresa } from './generador';
import { leerCsv, aCsv } from './archivos';

const ahora = new Date('2026-11-25T12:00:00Z');
const empresa = generarEmpresa({ ahora });

function fuentesDe(rut: string, email: string, alt: string) {
  const r = normalizarRut(rut);
  const emails = new Set([email, alt]);
  const fuentes = new Set<string>();
  if (empresa.erp.some((x) => normalizarRut(x.rut) === r)) fuentes.add('erp');
  if (empresa.planillas.some((x) => normalizarRut(x.RUT) === r)) fuentes.add('planillas');
  if (empresa.rrhh.some((x) => normalizarRut(x.rut) === r)) fuentes.add('rrhh');
  if (empresa.crm.some((x) => emails.has(x.email))) fuentes.add('crm');
  if (empresa.tienda.some((x) => emails.has(x.cliente.email))) fuentes.add('tienda');
  if (empresa.marketing.some((x) => emails.has(x.email))) fuentes.add('marketing');
  return fuentes;
}

describe('generador de la empresa ficticia', () => {
  it('es determinista con la misma semilla (RD-03)', () => {
    expect(generarEmpresa({ ahora })).toEqual(empresa);
    expect(generarEmpresa({ semilla: 7, ahora }).personas[0]).not.toEqual(empresa.personas[0]);
  });

  it('tiene unos 60 titulares y al menos 15 en tres o más fuentes (RD-04)', () => {
    expect(empresa.personas.length).toBeGreaterThanOrEqual(60);
    const enTres = empresa.personas.filter(
      (p) => !p.homonimoDe && fuentesDe(p.rut, p.email, p.emailAlternativo).size >= 3,
    );
    expect(enTres.length).toBeGreaterThanOrEqual(15);
  });

  it('usa RUT válidos y solo dominios reservados (RD-05)', () => {
    for (const p of empresa.personas) {
      expect(esRutValido(p.rut)).toBe(true);
      expect(p.email).toMatch(/@(example\.com|[\w-]+\.example)$/);
      expect(p.emailAlternativo).toMatch(/@(example\.com|[\w-]+\.example)$/);
    }
  });

  it('incluye al menos cinco titulares con datos de salud (RD-06)', () => {
    expect(empresa.rrhh.filter((f) => f.detalle_licencias !== '').length).toBeGreaterThanOrEqual(5);
  });

  it('trae diez solicitudes con los seis derechos (RD-07)', () => {
    expect(empresa.solicitudes).toHaveLength(10);
    expect(new Set(empresa.solicitudes.map((s) => s.derecho)).size).toBe(6);
  });

  it('el CSV hace ida y vuelta', () => {
    expect(leerCsv(aCsv(empresa.rrhh))).toEqual(empresa.rrhh);
  });
});
