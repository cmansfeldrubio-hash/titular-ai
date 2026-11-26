import type Anthropic from '@anthropic-ai/sdk';
import { crearConectoresSimulados } from '@ley/connectors';
import { generarEmpresa } from '@ley/mock-data';
import { describe, expect, it } from 'vitest';
import { investigarSolicitud, parametrosModelo } from './agente';
import { clasificarPorReglas } from './clasificar';
import { investigarDemo } from './demo';
import type { EventoAgente } from './eventos';
import { ejecutarHerramienta, HERRAMIENTAS, registroParaModelo } from './herramientas';
import { leerFuentes, proponerActividadesPorReglas } from './inventario';
import { acumularUso, costo, usoVacio } from './modelos';

const empresaFicticia = generarEmpresa({ ahora: new Date('2026-11-25T12:00:00Z') });
const conectores = () =>
  crearConectoresSimulados(empresaFicticia, { latenciaMs: [0, 0], tasaError: 0 });

describe('herramientas', () => {
  it('no incluyen enviar, borrar ni modificar (art. 8 bis por diseño)', () => {
    const nombres = HERRAMIENTAS.map((h) => h.name);
    expect(nombres).toEqual([
      'listar_fuentes',
      'buscar_titular',
      'obtener_registro',
      'calcular_plazo',
      'proponer_respuesta',
    ]);
  });

  it('ocultan al modelo el contenido de los datos sensibles (RNF-03)', async () => {
    const rrhh = conectores().find((c) => c.id === 'rrhh')!;
    const [r] = await rrhh.muestras(1);
    const paraModelo = registroParaModelo(r!);
    expect(String(paraModelo.detalle_licencias)).toMatch(/DATO SENSIBLE/);
    expect(JSON.stringify(paraModelo)).not.toMatch(/Licencia por/);
  });

  it('rechaza entradas inválidas sin ejecutar', async () => {
    const r = await ejecutarHerramienta(
      'buscar_titular',
      { nombre: 3 },
      {
        solicitud: empresaFicticia.solicitudes[0]!,
        conectores: conectores(),
        alEvento: () => {},
        registros: new Map(),
      },
    );
    expect(r.error).toBe(true);
  });
});

describe('modo demostración', () => {
  it('encuentra al titular en varias fuentes y redacta con citas', async () => {
    const eventos: EventoAgente[] = [];
    const sol = empresaFicticia.solicitudes[0]!;
    const { propuesta } = await investigarDemo({
      empresa: empresaFicticia.empresa,
      solicitud: sol,
      conectores: conectores(),
      alEvento: (e) => eventos.push(e),
      pausaMs: 0,
    });
    const fuentes = new Set(propuesta.hallazgos.filter((h) => !h.dudoso).map((h) => h.fuenteId));
    expect(fuentes.size).toBeGreaterThanOrEqual(3);
    expect(propuesta.borrador).toMatch(/\[(crm|erp|tienda|planillas|rrhh|marketing):/);
    expect(propuesta.hallazgos.some((h) => h.contieneSensibles)).toBe(true);
    expect(eventos.some((e) => e.tipo === 'herramienta' && e.nombre === 'buscar_titular')).toBe(
      true,
    );
  });

  it('propone acciones para supresión sin ejecutarlas', async () => {
    const sol = empresaFicticia.solicitudes.find((s) => s.derecho === 'supresion')!;
    const { propuesta } = await investigarDemo({
      empresa: empresaFicticia.empresa,
      solicitud: sol,
      conectores: conectores(),
      alEvento: () => {},
      pausaMs: 0,
    });
    expect(propuesta.acciones.length).toBeGreaterThan(0);
  });
});

/** Cliente falso que reproduce respuestas del modelo en orden. */
function clienteFalso(respuestas: Partial<Anthropic.Beta.Messages.BetaMessage>[]) {
  const pedidos: unknown[] = [];
  let i = 0;
  const cliente = {
    beta: {
      messages: {
        stream: (params: unknown) => {
          pedidos.push(structuredClone(params));
          const msg = {
            stop_reason: 'tool_use',
            usage: {
              input_tokens: 1000,
              output_tokens: 200,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
            ...respuestas[i++],
          };
          return {
            async *[Symbol.asyncIterator]() {},
            finalMessage: async () => msg,
          };
        },
      },
    },
  } as unknown as Anthropic;
  return { cliente, pedidos };
}

describe('bucle del agente', () => {
  it('ejecuta herramientas, devuelve resultados y termina con proponer_respuesta', async () => {
    const sol = empresaFicticia.solicitudes[0]!;
    const { cliente, pedidos } = clienteFalso([
      {
        content: [
          {
            type: 'tool_use',
            id: 't1',
            name: 'buscar_titular',
            input: { fuente_id: 'crm', email: sol.titular.email },
          },
          { type: 'tool_use', id: 't2', name: 'calcular_plazo', input: { solicitud_id: sol.id } },
        ] as Anthropic.Beta.Messages.BetaContentBlock[],
      },
      {
        content: [
          {
            type: 'tool_use',
            id: 't3',
            name: 'proponer_respuesta',
            input: {
              hallazgos: [],
              borrador: 'Estimado/a...',
              acciones: [],
              finalidades: [],
              destinatarios: [],
              conservacion: 'x',
            },
          },
        ] as Anthropic.Beta.Messages.BetaContentBlock[],
      },
    ]);
    const eventos: EventoAgente[] = [];
    const { propuesta, uso } = await investigarSolicitud({
      cliente,
      modelo: 'claude-sonnet-5-5',
      empresa: empresaFicticia.empresa,
      solicitud: sol,
      conectores: conectores(),
      alEvento: (e) => eventos.push(e),
    });
    expect(propuesta.borrador).toBe('Estimado/a...');
    expect(uso.entrada).toBe(2000);
    // Los dos resultados del primer turno vuelven juntos en un solo mensaje.
    const segundo = pedidos[1] as { messages: { role: string; content: unknown[] }[] };
    expect(segundo.messages.at(-1)?.content).toHaveLength(2);
    expect(eventos.filter((e) => e.tipo === 'resultado')).toHaveLength(3);
  });

  it('usa pensamiento adaptativo y respaldo en Sonnet 5.5, y nada de eso en Haiku 4.5', () => {
    expect(parametrosModelo('claude-sonnet-5-5')).toMatchObject({
      thinking: { type: 'adaptive' },
      fallbacks: 'default',
    });
    expect(parametrosModelo('claude-haiku-4-5')).toEqual({});
  });
});

describe('clasificación e inventario por reglas', () => {
  it('reconoce el derecho y extrae RUT y correo', () => {
    const c = clasificarPorReglas(
      'Mi nombre es Ana Rojas Soto, RUT 12.345.678-5. Quiero que eliminen mis datos.',
      {
        email: 'ana@example.com',
      },
    );
    expect(c.derecho).toBe('supresion');
    expect(c.titular).toEqual({
      nombre: 'Ana Rojas Soto',
      rut: '12.345.678-5',
      email: 'ana@example.com',
    });
  });

  it('propone una actividad por fuente y marca la de datos sensibles', async () => {
    const act = proponerActividadesPorReglas(await leerFuentes(conectores()));
    expect(act).toHaveLength(6);
    expect(act.find((a) => a.fuenteId === 'rrhh')?.datosSensibles).toBe(true);
    expect(act.every((a) => a.estado === 'sugerido')).toBe(true);
  });
});

describe('costos', () => {
  it('estima el costo por modelo', () => {
    expect(costo('claude-sonnet-5-5', 1_000_000, 100_000)).toBeCloseTo(3);
    const u = acumularUso(usoVacio('claude-haiku-4-5'), {
      input_tokens: 1_000_000,
      output_tokens: 0,
    });
    expect(u.costoUsd).toBeCloseTo(1);
  });
});
