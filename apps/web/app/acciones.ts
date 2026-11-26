'use server';

import { signIn, signOut } from '@/auth';

/** Conecta Gmail con OAuth de Google desde el servidor (RG-01). */
export async function conectarGmail() {
  await signIn('google', { redirectTo: '/configuracion' });
}

export async function desconectarGmail() {
  await signOut({ redirectTo: '/ingresar' });
}
