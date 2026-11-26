import { normalizarRut, similitudNombre, tokensNombre } from '@ley/domain';
import type { ConsultaTitular } from './tipos';

export interface Identidad {
  nombre?: string;
  rut?: string;
  email?: string;
  telefono?: string;
}

export interface Evaluacion {
  confianza: number;
  dudoso: boolean;
  criterios: string[];
  motivo: string;
}

/**
 * Evalúa si un registro corresponde a la persona buscada. Tolera tildes, mayúsculas,
 * orden de apellidos y RUT con o sin puntos. Devuelve `null` si no hay coincidencia.
 */
export function evaluarCoincidencia(
  consulta: ConsultaTitular,
  registro: Identidad,
): Evaluacion | null {
  const rutC = consulta.rut ? normalizarRut(consulta.rut) : '';
  const rutR = registro.rut ? normalizarRut(registro.rut) : '';
  const emailC = consulta.email?.trim().toLowerCase() ?? '';
  const emailR = registro.email?.trim().toLowerCase() ?? '';
  const rutCoincide = rutC !== '' && rutC === rutR;
  const rutDistinto = rutC !== '' && rutR !== '' && rutC !== rutR;
  const emailCoincide = emailC !== '' && emailC === emailR;
  const telC = (consulta.telefono ?? '').replace(/\D/g, '').slice(-8);
  const telR = (registro.telefono ?? '').replace(/\D/g, '').slice(-8);
  const telefonoCoincide = telC.length === 8 && telC === telR;
  const sim =
    consulta.nombre && registro.nombre ? similitudNombre(consulta.nombre, registro.nombre) : 0;
  const tokensMin = Math.min(
    tokensNombre(consulta.nombre ?? '').length,
    tokensNombre(registro.nombre ?? '').length,
  );
  const nombreCoincide = sim >= 0.99 && tokensMin >= 2;
  const criterios: string[] = [];
  if (rutCoincide) criterios.push('RUT');
  if (emailCoincide) criterios.push('correo');
  if (telefonoCoincide) criterios.push('teléfono');
  if (nombreCoincide) criterios.push('nombre');
  else if (sim >= 0.66 && tokensMin >= 2) criterios.push('nombre parecido');

  if (rutCoincide) {
    return {
      confianza: nombreCoincide || emailCoincide ? 0.98 : 0.9,
      dudoso: false,
      criterios,
      motivo: nombreCoincide ? 'Coinciden RUT y nombre' : 'Coincide el RUT',
    };
  }
  if (emailCoincide) {
    if (rutDistinto) {
      return {
        confianza: 0.4,
        dudoso: true,
        criterios,
        motivo: 'Coincide el correo, pero el RUT es distinto',
      };
    }
    return sim >= 0.66 || !registro.nombre || tokensMin < 2
      ? { confianza: 0.9, dudoso: false, criterios, motivo: 'Coincide el correo' }
      : {
          confianza: 0.55,
          dudoso: true,
          criterios,
          motivo: 'Coincide el correo, pero el nombre no',
        };
  }
  if (telefonoCoincide && !rutDistinto && sim >= 0.66 && tokensMin >= 2) {
    return { confianza: 0.85, dudoso: false, criterios, motivo: 'Coinciden teléfono y nombre' };
  }
  if (nombreCoincide) {
    if (rutDistinto) {
      return {
        confianza: 0.25,
        dudoso: true,
        criterios,
        motivo: 'Mismo nombre con RUT distinto: posible homónimo',
      };
    }
    return {
      confianza: 0.6,
      dudoso: true,
      criterios,
      motivo: 'Solo coincide el nombre; no hay RUT ni correo que lo confirme',
    };
  }
  if (sim >= 0.66 && tokensMin >= 2 && !rutDistinto) {
    return {
      confianza: 0.4,
      dudoso: true,
      criterios,
      motivo: 'Nombre parecido, sin otro dato que lo confirme',
    };
  }
  return null;
}
