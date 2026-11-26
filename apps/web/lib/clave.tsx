'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const CLAVE_SESION = 'ley21719.clave-anthropic';

interface ContextoClave {
  clave: string | null;
  recordar: boolean;
  definir: (clave: string, recordar: boolean) => void;
  borrar: () => void;
  /** Últimos cuatro caracteres, para mostrarla enmascarada (RK-05). */
  enmascarada: string | null;
}

const Ctx = createContext<ContextoClave | null>(null);

function leerInicial(): { clave: string | null; recordar: boolean } {
  if (typeof window === 'undefined') return { clave: null, recordar: false };
  const guardada = window.sessionStorage.getItem(CLAVE_SESION);
  return { clave: guardada, recordar: guardada !== null };
}

/**
 * La clave de Anthropic vive en memoria y se pierde al recargar (RK-02). Solo con la opción
 * explícita «recordar en esta pestaña» se guarda en sessionStorage; nunca en localStorage,
 * cookies ni IndexedDB (RK-03). No se registra en consola ni se envía a rutas del proyecto (RK-05).
 */
export function ProveedorClave({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState(leerInicial);

  const definir = useCallback((clave: string, recordar: boolean) => {
    const limpia = clave.trim();
    if (recordar) window.sessionStorage.setItem(CLAVE_SESION, limpia);
    else window.sessionStorage.removeItem(CLAVE_SESION);
    setEstado({ clave: limpia || null, recordar });
  }, []);

  const borrar = useCallback(() => {
    window.sessionStorage.removeItem(CLAVE_SESION);
    setEstado({ clave: null, recordar: false });
  }, []);

  const valor = useMemo<ContextoClave>(
    () => ({
      ...estado,
      definir,
      borrar,
      enmascarada: estado.clave ? `••••••••${estado.clave.slice(-4)}` : null,
    }),
    [estado, definir, borrar],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useClave(): ContextoClave {
  const c = useContext(Ctx);
  if (!c) throw new Error('useClave fuera de ProveedorClave');
  return c;
}
