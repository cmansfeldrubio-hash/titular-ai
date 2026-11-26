import { defineConfig, devices } from '@playwright/test';

const PUERTO = 3100;

/** Recorrido completo en modo demostración: sin clave de Anthropic ni Gmail (RNF-13). */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // Requiere `next build` previo (en CI lo hace turbo). Sin variables de Google: modo demostración.
    command: `node node_modules/next/dist/bin/next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { AUTH_GOOGLE_ID: '', AUTH_GOOGLE_SECRET: '' },
  },
});
