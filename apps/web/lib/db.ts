import type { ActividadTratamiento, EventoBitacora, Solicitud } from '@ley/domain';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * Persistencia local en IndexedDB (sección 3): solicitudes, bitácora y registro de actividades.
 * Nada de esto sale del navegador (RNF-02). La clave de API nunca se guarda aquí (RK-03).
 */
export interface Ajustes {
  semilla: number;
  modelo: string;
  latenciaMaxMs: number;
  tasaError: number;
  /** Fuentes que el encargado desconectó desde el panel. */
  fuentesDesconectadas: string[];
}

export const AJUSTES_INICIALES: Ajustes = {
  semilla: 21719,
  modelo: 'claude-sonnet-5-5',
  latenciaMaxMs: 1500,
  tasaError: 0.08,
  fuentesDesconectadas: [],
};

interface Esquema extends DBSchema {
  solicitudes: { key: string; value: Solicitud };
  bitacora: { key: string; value: EventoBitacora; indexes: { fecha: string } };
  actividades: { key: string; value: ActividadTratamiento };
  ajustes: { key: string; value: unknown };
}

let conexion: Promise<IDBPDatabase<Esquema>> | null = null;

export function db() {
  conexion ??= openDB<Esquema>('ley21719-prototipo', 1, {
    upgrade(d) {
      d.createObjectStore('solicitudes', { keyPath: 'id' });
      d.createObjectStore('bitacora', { keyPath: 'id' }).createIndex('fecha', 'fecha');
      d.createObjectStore('actividades', { keyPath: 'id' });
      d.createObjectStore('ajustes');
    },
  });
  return conexion;
}

export async function leerTodo() {
  const d = await db();
  const [solicitudes, bitacora, actividades, ajustes] = await Promise.all([
    d.getAll('solicitudes'),
    d.getAllFromIndex('bitacora', 'fecha'),
    d.getAll('actividades'),
    d.get('ajustes', 'ajustes') as Promise<Ajustes | undefined>,
  ]);
  return { solicitudes, bitacora, actividades, ajustes: { ...AJUSTES_INICIALES, ...ajustes } };
}

export async function guardarSolicitud(s: Solicitud) {
  await (await db()).put('solicitudes', s);
}

export async function guardarSolicitudes(lista: Solicitud[]) {
  const tx = (await db()).transaction('solicitudes', 'readwrite');
  await Promise.all([...lista.map((s) => tx.store.put(s)), tx.done]);
}

/** La bitácora es de solo agregar (RF-18): `add` falla si el evento ya existe y no hay función para editar. */
export async function agregarEvento(e: EventoBitacora) {
  await (await db()).add('bitacora', e);
}

export async function guardarActividades(lista: ActividadTratamiento[]) {
  const tx = (await db()).transaction('actividades', 'readwrite');
  await tx.store.clear();
  await Promise.all([...lista.map((a) => tx.store.put(a)), tx.done]);
}

export async function guardarAjustes(a: Ajustes) {
  await (await db()).put('ajustes', a, 'ajustes');
}

/** Restaura el estado inicial antes de una demo (RD-09). Única operación que vacía la bitácora. */
export async function borrarTodo() {
  const d = await db();
  const tx = d.transaction(['solicitudes', 'bitacora', 'actividades'], 'readwrite');
  await Promise.all([
    tx.objectStore('solicitudes').clear(),
    tx.objectStore('bitacora').clear(),
    tx.objectStore('actividades').clear(),
    tx.done,
  ]);
}
