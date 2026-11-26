import base from '@ley/config/eslint';
import next from 'eslint-config-next/core-web-vitals';

const config = [
  ...next,
  ...base,
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'astryx-themes.js',
    ],
  },
];

export default config;
