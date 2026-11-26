'use client';

import { HStack } from '@astryxdesign/core/HStack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { EventoAgente } from '@ley/agent';
import { NOMBRE_FUENTE } from '@/lib/utiles';

export interface Paso {
  id: string;
  tipo: 'paso' | 'pensamiento' | 'herramienta' | 'reintento' | 'texto' | 'error';
  texto: string;
  detalle?: string;
  estado: 'en_curso' | 'ok' | 'error' | 'info';
}

/** Describe la entrada de una herramienta sin mostrar datos personales en el registro en vivo. */
export function describirEntrada(nombre: string, entrada: Record<string, unknown>): string {
  const fuente =
    typeof entrada.fuente_id === 'string'
      ? (NOMBRE_FUENTE[entrada.fuente_id] ?? entrada.fuente_id)
      : '';
  const etiquetas: Record<string, string> = {
    nombre: 'nombre',
    rut: 'RUT',
    email: 'correo',
    telefono: 'teléfono',
  };
  const criterios = Object.keys(etiquetas)
    .filter((k) => entrada[k])
    .map((k) => etiquetas[k]);
  switch (nombre) {
    case 'buscar_titular':
      return `buscar_titular en ${fuente} por ${criterios.join(', ') || 'sin criterios'}`;
    case 'obtener_registro':
      return `obtener_registro ${String(entrada.registro_id)} de ${fuente}`;
    case 'listar_fuentes':
      return 'listar_fuentes';
    case 'calcular_plazo':
      return 'calcular_plazo';
    case 'proponer_respuesta':
      return 'proponer_respuesta: entrega hallazgos y borrador';
    default:
      return nombre;
  }
}

/** Aplica un evento del agente a la lista de pasos que se muestra en vivo (RF-11). */
export function aplicarEvento(pasos: Paso[], e: EventoAgente): Paso[] {
  switch (e.tipo) {
    case 'paso':
      return [...pasos, { id: `p${pasos.length}`, tipo: 'paso', texto: e.texto, estado: 'info' }];
    case 'pensamiento':
      return [
        ...pasos,
        { id: `p${pasos.length}`, tipo: 'pensamiento', texto: e.texto, estado: 'info' },
      ];
    case 'texto': {
      const ultimo = pasos.at(-1);
      if (ultimo?.tipo === 'texto')
        return [...pasos.slice(0, -1), { ...ultimo, texto: ultimo.texto + e.delta }];
      return [...pasos, { id: `p${pasos.length}`, tipo: 'texto', texto: e.delta, estado: 'info' }];
    }
    case 'herramienta':
      return [
        ...pasos,
        {
          id: e.id,
          tipo: 'herramienta',
          texto: describirEntrada(e.nombre, e.entrada),
          estado: 'en_curso',
        },
      ];
    case 'resultado':
      return pasos.map((p) =>
        p.id === e.id ? { ...p, detalle: e.resumen, estado: e.error ? 'error' : 'ok' } : p,
      );
    case 'reintento':
      return [
        ...pasos,
        {
          id: `p${pasos.length}`,
          tipo: 'reintento',
          texto: `Reintento ${e.intento} en ${NOMBRE_FUENTE[e.fuenteId] ?? e.fuenteId}`,
          detalle: e.mensaje,
          estado: 'error',
        },
      ];
    default:
      return pasos;
  }
}

const VARIANTE = { en_curso: 'accent', ok: 'success', error: 'error', info: 'neutral' } as const;
const ETIQUETA = { en_curso: 'En curso', ok: 'Listo', error: 'Error', info: 'Nota' } as const;

export function BitacoraAgente({ pasos }: { pasos: Paso[] }) {
  return (
    <VStack gap={1.5}>
      {pasos.map((p) => (
        <HStack key={p.id} gap={2} align="start">
          <StatusDot
            variant={VARIANTE[p.estado]}
            label={ETIQUETA[p.estado]}
            isPulsing={p.estado === 'en_curso'}
          />
          <VStack gap={0.5}>
            <Text
              type={p.tipo === 'herramienta' ? 'code' : 'body'}
              color={p.tipo === 'pensamiento' || p.tipo === 'texto' ? 'secondary' : 'primary'}
            >
              {p.tipo === 'pensamiento' ? `Razonamiento: ${p.texto}` : p.texto}
            </Text>
            {p.detalle ? (
              <Text type="supporting" color="secondary">
                {`→ ${p.detalle}`}
              </Text>
            ) : null}
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
}
