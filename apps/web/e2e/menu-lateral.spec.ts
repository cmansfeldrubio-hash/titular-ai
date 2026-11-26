import { expect, test } from '@playwright/test';

// Foto de perfil de prueba (un círculo SVG); en producción viene de lh3.googleusercontent.com.
const FOTO =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#0E7490"/><circle cx="20" cy="16" r="7" fill="#fff"/><path d="M6 38a14 12 0 0 1 28 0z" fill="#fff"/></svg>',
  ).toString('base64');

test.beforeEach(async ({ page }) => {
  // Simula una sesión de Google para no depender de una cuenta real.
  await page.route('**/api/gmail/estado', (r) =>
    r.fulfill({
      json: {
        configurado: true,
        conectado: true,
        cuenta: 'encargada@example.com',
        nombre: 'Encargada Demo',
        imagen: FOTO,
        casilla: 'casilla@example.com',
      },
    }),
  );
});

test('el menú lateral muestra al usuario y ofrece cerrar sesión', async ({ page }) => {
  await page.goto('/');
  const usuario = page.getByRole('button', { name: 'Encargada Demo' });
  await expect(usuario).toBeVisible();
  await page.screenshot({ path: 'test-results/menu-expandido.png' });
  await usuario.click();
  await expect(page.getByText('encargada@example.com')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'test-results/menu-usuario.png',
    clip: { x: 0, y: 650, width: 420, height: 250 },
  });
});

test('el menú lateral se contrae y se expande', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Inventario de datos' })).toBeVisible();
  await page.getByRole('button', { name: /Contraer la barra lateral/ }).click();
  await expect(page.getByRole('button', { name: /Expandir la barra lateral/ })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/menu-contraido.png' });
  await page.getByRole('button', { name: /Expandir la barra lateral/ }).click();
  await expect(page.getByRole('button', { name: /Contraer la barra lateral/ })).toBeVisible();
});
