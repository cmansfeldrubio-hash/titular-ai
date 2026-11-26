import { expect, test } from '@playwright/test';

test('la bienvenida tras el ingreso lleva al panel de control', async ({ page }) => {
  await page.goto('/bienvenida');
  await expect(page.getByRole('heading', { name: 'AI Titular' })).toBeVisible();
  await expect(
    page.getByText('Tu agente que responde las solicitudes de datos personales de la Ley 21.719'),
  ).toBeVisible();
  await expect(page.getByText('Sesión iniciada con Google')).toBeVisible();
  await expect(page.getByText('Preparando tu panel de control…')).toBeVisible();
  // La transición termina sola en el panel, con la marca en el menú lateral.
  await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
  await expect(page.getByRole('heading', { name: 'Bandeja de solicitudes' })).toBeVisible();
  await expect(page.getByText('Tu agente de solicitudes de datos personales')).toBeVisible();
});
