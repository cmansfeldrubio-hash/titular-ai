import { NextResponse, type NextRequest } from 'next/server';
import { auth, googleConfigurado } from './auth';

/**
 * Política de seguridad de contenido estricta (RNF-04): scripts solo con nonce, y conexiones
 * solo al propio dominio y a api.anthropic.com, donde el navegador usa la clave del usuario.
 */
function politica(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development';
  return [
    `default-src 'self'`,
    // 'wasm-unsafe-eval' permite compilar WebAssembly (lo usa el generador de PDF) sin habilitar eval().
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? ` 'unsafe-eval'` : ''}`,
    // Los componentes aplican estilos en línea (atributo style), que no admiten nonce.
    `style-src 'self' 'unsafe-inline'`,
    // Foto de perfil de la cuenta de Google.
    `img-src 'self' blob: data: https://lh3.googleusercontent.com`,
    `font-src 'self' data:`,
    // data: solo permite leer el módulo WebAssembly incrustado del generador de PDF; no abre otros dominios.
    `connect-src 'self' data: https://api.anthropic.com${dev ? ' ws: wss:' : ''}`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://accounts.google.com`,
    `frame-ancestors 'none'`,
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

const RUTAS_PUBLICAS = ['/ingresar', '/api/auth'];

function responder(request: NextRequest, autenticado: boolean) {
  const { pathname } = request.nextUrl;
  // Con Google configurado, solo entran las cuentas de ALLOWED_EMAILS (RNF-05).
  if (googleConfigurado && !autenticado && !RUTAS_PUBLICAS.some((r) => pathname.startsWith(r))) {
    if (pathname.startsWith('/api/'))
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    return NextResponse.redirect(new URL('/ingresar', request.url));
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = politica(nonce);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const proxy = googleConfigurado
  ? auth((request) => responder(request, Boolean(request.auth)))
  : (request: NextRequest) => responder(request, true);

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
