import type { Coincidencia, Connector, RegistroFuente } from '@ley/connectors';
import {
  extraerEmails,
  extraerRuts,
  normalizarRut,
  type Empresa,
  type PropuestaRespuesta,
  type Solicitud,
  type UsoTokens,
} from '@ley/domain';
import type { AlEvento } from './eventos';
import {
  aplanarDatos,
  ejecutarHerramienta,
  type ContextoHerramientas,
  type ProponerRespuesta,
} from './herramientas';
import { MODELO_DEMO, usoVacio } from './modelos';
import { NOMBRE_FUENTE } from './catalogo';
import { accionPara, finalidadesYDestinatarios, redactarBorrador } from './plantillas';

export interface OpcionesDemo {
  empresa: Empresa;
  solicitud: Solicitud;
  conectores: Connector[];
  alEvento: AlEvento;
  signal?: AbortSignal;
  /** Pausa entre pasos en milisegundos, para que la demo se pueda seguir. */
  pausaMs?: number;
}

function esperar(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Cancelado', 'AbortError'));
    });
  });
}

/**
 * Modo demostración (RK-09): el razonamiento del agente está pregrabado, pero las búsquedas
 * en las fuentes simuladas son reales, así que los hallazgos y la bitácora también lo son.
 */
export async function investigarDemo(
  op: OpcionesDemo,
): Promise<{ propuesta: PropuestaRespuesta; uso: UsoTokens }> {
  const pausa = op.pausaMs ?? 450;
  const ctx: ContextoHerramientas = {
    solicitud: op.solicitud,
    conectores: op.conectores,
    alEvento: op.alEvento,
    registros: new Map<string, RegistroFuente>(),
  };
  let n = 0;
  const llamar = async (nombre: string, entrada: Record<string, unknown>) => {
    const id = `demo_${++n}`;
    op.alEvento({
      tipo: 'herramienta',
      id,
      nombre,
      entrada: nombre === 'proponer_respuesta' ? {} : entrada,
    });
    const r = await ejecutarHerramienta(nombre, entrada, ctx);
    op.alEvento({ tipo: 'resultado', id, nombre, resumen: r.resumen, error: r.error });
    return r;
  };
  const pensar = async (texto: string) => {
    op.alEvento({ tipo: 'pensamiento', texto });
    await esperar(pausa, op.signal);
  };

  op.alEvento({
    tipo: 'paso',
    texto:
      'Modo demostración: el razonamiento está pregrabado; las búsquedas en las fuentes simuladas son reales.',
  });
  await pensar('Primero reviso qué fuentes hay y cuánto plazo queda para responder.');
  await Promise.all([
    llamar('listar_fuentes', {}),
    llamar('calcular_plazo', { solicitud_id: op.solicitud.id }),
  ]);

  const t = op.solicitud.titular;
  const activos = op.conectores.filter((c) => c.estado === 'conectado' && c.tipo === 'simulado');
  await pensar(
    `Busco a ${t.nombre} en las ${activos.length} fuentes con nombre, RUT y correo a la vez.`,
  );

  const encontrados = new Map<string, Coincidencia[]>();
  const buscar = async (
    fuentes: Connector[],
    consulta: { nombre?: string; rut?: string; email?: string; telefono?: string },
  ) => {
    await Promise.all(
      fuentes.map(async (c) => {
        const r = await llamar('buscar_titular', { fuente_id: c.id, ...consulta });
        if (r.error) return;
        const lista = JSON.parse(r.contenido) as Coincidencia[];
        const fusion = new Map((encontrados.get(c.id) ?? []).map((x) => [x.registroId, x]));
        // Una búsqueda con más datos puede confirmar un registro que antes era dudoso.
        for (const x of lista) {
          const previo = fusion.get(x.registroId);
          if (!previo || x.confianza > previo.confianza) fusion.set(x.registroId, x);
        }
        encontrados.set(
          c.id,
          [...fusion.values()].sort((a, b) => b.confianza - a.confianza),
        );
      }),
    );
  };
  await buscar(activos, { nombre: t.nombre, rut: t.rut, email: t.email });

  // Trae los registros seguros para descubrir otros correos o el RUT del titular.
  const traer = async (fuenteId: string, coincidencias: Coincidencia[]) => {
    for (const co of coincidencias.slice(0, 3)) {
      if (!ctx.registros.has(`${fuenteId}:${co.registroId}`)) {
        await llamar('obtener_registro', { fuente_id: fuenteId, registro_id: co.registroId });
      }
    }
  };
  await pensar('Reviso el detalle de los registros encontrados para confirmar la identidad.');
  await Promise.all([...encontrados].map(([f, cs]) => traer(f, cs)));

  const conocidos = new Set(
    [t.email?.toLowerCase(), t.rut ? normalizarRut(t.rut) : undefined].filter(Boolean),
  );
  const nuevosEmails = new Set<string>();
  const telefonos = new Set<string>();
  let rutNuevo: string | undefined;
  for (const [fuenteId, cs] of encontrados) {
    for (const co of cs.filter((x) => !x.dudoso)) {
      const r = ctx.registros.get(`${fuenteId}:${co.registroId}`);
      if (!r) continue;
      const texto = JSON.stringify(r.datos);
      extraerEmails(texto).forEach((e) => !conocidos.has(e) && nuevosEmails.add(e));
      texto.match(/\+56 9 \d{4} \d{4}/g)?.forEach((tel) => telefonos.add(tel));
      const rut = extraerRuts(texto)[0];
      if (rut && !t.rut) rutNuevo = rut;
    }
  }
  const pendientes = activos.filter((c) => !(encontrados.get(c.id) ?? []).some((x) => !x.dudoso));
  if ((nuevosEmails.size > 0 || telefonos.size > 0 || rutNuevo) && pendientes.length > 0) {
    const datos = [
      nuevosEmails.size ? `otro correo (${[...nuevosEmails].join(', ')})` : '',
      telefonos.size ? `su teléfono (${[...telefonos].join(', ')})` : '',
      rutNuevo ? 'su RUT' : '',
    ].filter(Boolean);
    await pensar(
      `En registros confirmados encontré ${datos.join(' y ')}; vuelvo a buscar en ${pendientes.map((c) => NOMBRE_FUENTE[c.id]).join(', ')}.`,
    );
    const rut = rutNuevo ?? t.rut;
    for (const email of nuevosEmails) await buscar(pendientes, { nombre: t.nombre, email, rut });
    for (const telefono of telefonos) await buscar(pendientes, { nombre: t.nombre, telefono, rut });
    if (nuevosEmails.size === 0 && telefonos.size === 0 && rutNuevo)
      await buscar(pendientes, { nombre: t.nombre, rut: rutNuevo });
    await Promise.all([...encontrados].map(([f, cs]) => traer(f, cs)));
  }

  const hallazgos = [...encontrados].flatMap(([fuenteId, cs]) =>
    cs
      .slice(0, 3)
      .filter((co) => ctx.registros.has(`${fuenteId}:${co.registroId}`))
      .map((co) => ({ fuenteId, co })),
  );
  const dudosos = hallazgos.filter((h) => h.co.dudoso).length;
  await pensar(
    `Tengo ${hallazgos.length - dudosos} registro(s) confirmados${dudosos ? ` y ${dudosos} dudoso(s) que el encargado debe revisar` : ''}. Redacto la respuesta citando cada fuente.`,
  );

  const paraBorrador = hallazgos.map(({ fuenteId, co }) => {
    const r = ctx.registros.get(`${fuenteId}:${co.registroId}`)!;
    return {
      fuente_id: fuenteId,
      registro_id: co.registroId,
      dudoso: co.dudoso,
      datos: aplanarDatos(r.datos),
      sensibles: r.camposSensibles.filter((c) => r.datos[c] && r.datos[c] !== '0'),
    };
  });
  const seguros = hallazgos.filter((h) => !h.co.dudoso);
  const entrada: ProponerRespuesta = {
    hallazgos: hallazgos.map(({ fuenteId, co }) => ({
      fuente_id: fuenteId,
      registro_id: co.registroId,
      confianza: co.confianza,
      dudoso: co.dudoso,
      motivo: co.motivo,
    })),
    borrador: redactarBorrador(op.empresa, op.solicitud, paraBorrador),
    acciones: seguros.flatMap(({ fuenteId, co }) => {
      const a = accionPara(op.solicitud.derecho, fuenteId);
      return a ? [{ fuente_id: fuenteId, registro_id: co.registroId, ...a }] : [];
    }),
    ...finalidadesYDestinatarios(seguros.map((h) => h.fuenteId)),
  };
  await esperar(pausa, op.signal);
  const r = await llamar('proponer_respuesta', entrada);
  if (!r.propuesta) throw new Error(r.resumen);
  const uso = usoVacio(MODELO_DEMO);
  op.alEvento({ tipo: 'fin', propuesta: r.propuesta, uso });
  return { propuesta: r.propuesta, uso };
}
