'use client';

import { ConectorGmail, crearConectoresSimulados, type Connector } from '@ley/connectors';
import {
  generarId,
  type ActividadTratamiento,
  type EventoBitacora,
  type Solicitud,
} from '@ley/domain';
import { generarEmpresa, type EmpresaFicticia } from '@ley/mock-data';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as almacen from './db';
import type { Ajustes } from './db';

export interface EstadoGmail {
  configurado: boolean;
  conectado: boolean;
  cuenta?: string | null;
  casilla?: string | null;
}

export type NuevoEvento = Omit<EventoBitacora, 'id' | 'fecha'>;

interface ContextoEstado {
  cargado: boolean;
  ajustes: Ajustes;
  empresa: EmpresaFicticia;
  conectores: Connector[];
  conectorGmail: ConectorGmail;
  gmail: EstadoGmail;
  solicitudes: Solicitud[];
  bitacora: EventoBitacora[];
  actividades: ActividadTratamiento[];
  registrar: (e: NuevoEvento) => Promise<void>;
  guardarSolicitud: (s: Solicitud) => Promise<void>;
  agregarSolicitudes: (lista: Solicitud[]) => Promise<void>;
  guardarActividades: (lista: ActividadTratamiento[]) => Promise<void>;
  cambiarAjustes: (parcial: Partial<Ajustes>) => Promise<void>;
  restaurar: (semilla?: number) => Promise<void>;
  refrescarGmail: () => Promise<void>;
}

const Ctx = createContext<ContextoEstado | null>(null);

function solicitudesIniciales(empresa: EmpresaFicticia): {
  solicitudes: Solicitud[];
  eventos: EventoBitacora[];
} {
  const eventos = empresa.solicitudes.map<EventoBitacora>((s) => ({
    id: generarId('evt'),
    fecha: s.recibidaEn,
    actor: 'sistema',
    tipo: 'recepcion',
    solicitudId: s.id,
    detalle: `Solicitud de ${s.derecho} recibida (simulada) de ${s.titular.nombre}`,
  }));
  return { solicitudes: empresa.solicitudes, eventos };
}

export function ProveedorEstado({ children }: { children: ReactNode }) {
  const [cargado, setCargado] = useState(false);
  const [ajustes, setAjustes] = useState<Ajustes>(almacen.AJUSTES_INICIALES);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [bitacora, setBitacora] = useState<EventoBitacora[]>([]);
  const [actividades, setActividades] = useState<ActividadTratamiento[]>([]);
  const [gmail, setGmail] = useState<EstadoGmail>({ configurado: false, conectado: false });
  const iniciado = useRef(false);

  const empresa = useMemo(() => generarEmpresa({ semilla: ajustes.semilla }), [ajustes.semilla]);

  const conectores = useMemo(() => {
    const lista = crearConectoresSimulados(empresa, {
      latenciaMs: [Math.min(200, ajustes.latenciaMaxMs), ajustes.latenciaMaxMs],
      tasaError: ajustes.tasaError,
    });
    for (const c of lista)
      if (ajustes.fuentesDesconectadas.includes(c.id)) c.estado = 'desconectado';
    return lista;
  }, [empresa, ajustes.latenciaMaxMs, ajustes.tasaError, ajustes.fuentesDesconectadas]);

  const conectorGmail = useMemo(() => new ConectorGmail(gmail.conectado), [gmail.conectado]);

  const refrescarGmail = useCallback(async () => {
    try {
      const r = await fetch('/api/gmail/estado', { cache: 'no-store' });
      if (r.ok) setGmail((await r.json()) as EstadoGmail);
    } catch {
      setGmail({ configurado: false, conectado: false });
    }
  }, []);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    void (async () => {
      const datos = await almacen.leerTodo();
      if (datos.solicitudes.length === 0 && datos.bitacora.length === 0) {
        const { solicitudes: s, eventos } = solicitudesIniciales(
          generarEmpresa({ semilla: datos.ajustes.semilla }),
        );
        await almacen.guardarSolicitudes(s);
        for (const e of eventos) await almacen.agregarEvento(e);
        datos.solicitudes = s;
        datos.bitacora = eventos;
      }
      setAjustes(datos.ajustes);
      setSolicitudes(datos.solicitudes);
      setBitacora(datos.bitacora);
      setActividades(datos.actividades);
      setCargado(true);
      await refrescarGmail();
    })();
  }, [refrescarGmail]);

  const registrar = useCallback(async (e: NuevoEvento) => {
    const evento: EventoBitacora = { ...e, id: generarId('evt'), fecha: new Date().toISOString() };
    await almacen.agregarEvento(evento);
    setBitacora((b) => [...b, evento]);
  }, []);

  const guardarSolicitud = useCallback(async (s: Solicitud) => {
    await almacen.guardarSolicitud(s);
    setSolicitudes((lista) =>
      lista.some((x) => x.id === s.id) ? lista.map((x) => (x.id === s.id ? s : x)) : [...lista, s],
    );
  }, []);

  const agregarSolicitudes = useCallback(async (nuevas: Solicitud[]) => {
    await almacen.guardarSolicitudes(nuevas);
    setSolicitudes((lista) => [
      ...lista.filter((x) => !nuevas.some((n) => n.id === x.id)),
      ...nuevas,
    ]);
  }, []);

  const guardarActividades = useCallback(async (lista: ActividadTratamiento[]) => {
    await almacen.guardarActividades(lista);
    setActividades(lista);
  }, []);

  const cambiarAjustes = useCallback(
    async (parcial: Partial<Ajustes>) => {
      const nuevo = { ...ajustes, ...parcial };
      setAjustes(nuevo);
      await almacen.guardarAjustes(nuevo);
    },
    [ajustes],
  );

  const restaurar = useCallback(
    async (semilla?: number) => {
      const s = semilla ?? ajustes.semilla;
      await almacen.borrarTodo();
      const nuevos = { ...ajustes, semilla: s, fuentesDesconectadas: [] };
      await almacen.guardarAjustes(nuevos);
      const inicial = solicitudesIniciales(generarEmpresa({ semilla: s }));
      await almacen.guardarSolicitudes(inicial.solicitudes);
      const reinicio: EventoBitacora = {
        id: generarId('evt'),
        fecha: new Date().toISOString(),
        actor: 'persona',
        tipo: 'configuracion',
        detalle: `Se restauró el estado inicial de la demo con la semilla ${s}`,
      };
      for (const e of [...inicial.eventos, reinicio]) await almacen.agregarEvento(e);
      setAjustes(nuevos);
      setSolicitudes(inicial.solicitudes);
      setBitacora([...inicial.eventos, reinicio]);
      setActividades([]);
    },
    [ajustes],
  );

  const valor: ContextoEstado = {
    cargado,
    ajustes,
    empresa,
    conectores,
    conectorGmail,
    gmail,
    solicitudes,
    bitacora,
    actividades,
    registrar,
    guardarSolicitud,
    agregarSolicitudes,
    guardarActividades,
    cambiarAjustes,
    restaurar,
    refrescarGmail,
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useEstado(): ContextoEstado {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEstado fuera de ProveedorEstado');
  return c;
}

/** Fuentes que puede usar el agente: las simuladas y, si está conectado, Gmail. */
export function useFuentesAgente(): Connector[] {
  const { conectores, conectorGmail, gmail } = useEstado();
  return useMemo(
    () => (gmail.conectado ? [...conectores, conectorGmail] : conectores),
    [conectores, conectorGmail, gmail.conectado],
  );
}
