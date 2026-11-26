import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Los paquetes internos se publican como TypeScript y Next los compila.
  transpilePackages: [
    '@ley/agent',
    '@ley/connectors',
    '@ley/domain',
    '@ley/mock-data',
    '@ley/report',
  ],
  poweredByHeader: false,
  async headers() {
    // La política de seguridad de contenido (con nonce) se fija en proxy.ts.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
