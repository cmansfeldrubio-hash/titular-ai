import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Google from 'next-auth/providers/google';

/** Google y Gmail están configurados solo si existen las variables de entorno (sección 5). */
export const googleConfigurado = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET,
);

export const SCOPES_GMAIL = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ');

/** Cuentas que pueden iniciar sesión (RG-02). */
export function cuentasPermitidas(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export interface TokensGoogle {
  accessToken: string;
  refreshToken?: string;
  /** Segundos desde la época. */
  expiraEn: number;
  error?: 'refresh';
}

/** Renueva el token de acceso con el token de actualización (RG-03). */
export async function renovarToken(t: TokensGoogle): Promise<TokensGoogle> {
  if (!t.refreshToken) return { ...t, error: 'refresh' };
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? '',
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? '',
      grant_type: 'refresh_token',
      refresh_token: t.refreshToken,
    }),
  });
  if (!res.ok) return { ...t, error: 'refresh' };
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? t.refreshToken,
    expiraEn: Math.floor(Date.now() / 1000) + json.expires_in,
  };
}

declare module 'next-auth' {
  interface Session {
    gmailConectado: boolean;
  }
}

type JWTConGoogle = JWT & { google?: TokensGoogle };

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleConfigurado
    ? [
        Google({
          authorization: {
            params: { scope: SCOPES_GMAIL, access_type: 'offline', prompt: 'consent' },
          },
        }),
      ]
    : [],
  session: { strategy: 'jwt' },
  pages: { signIn: '/ingresar', error: '/ingresar' },
  trustHost: true,
  callbacks: {
    signIn({ user }) {
      return cuentasPermitidas().includes(user.email?.toLowerCase() ?? '');
    },
    async jwt({ token, account }) {
      const t = token as JWTConGoogle;
      if (account?.access_token) {
        // Los tokens quedan dentro de la cookie de sesión cifrada (JWE) de Auth.js; nunca se envían al navegador.
        t.google = {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiraEn: account.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        };
        return t;
      }
      if (t.google && !t.google.error && Date.now() / 1000 > t.google.expiraEn - 60) {
        t.google = await renovarToken(t.google);
      }
      return t;
    },
    session({ session, token }) {
      const t = token as JWTConGoogle;
      // Solo se expone si Gmail está conectado, nunca los tokens.
      return { ...session, gmailConectado: Boolean(t.google && !t.google.error) };
    },
  },
});
