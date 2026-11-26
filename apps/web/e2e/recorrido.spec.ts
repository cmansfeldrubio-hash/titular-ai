import { expect, test } from '@playwright/test';

test('recorrido completo de una solicitud en modo demostración', async ({ page }) => {
  const inicio = Date.now();
  await page.goto('/');
  await expect(
    page.getByText('Prototipo académico · Datos ficticios · No es asesoría legal'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bandeja de solicitudes' })).toBeVisible();

  // Semáforo con texto junto al color (RNF-08).
  await expect(page.getByText(/Urgente: (Queda|Quedan)/).first()).toBeVisible();

  await page.getByRole('link', { name: /^SOL-001 · / }).click();
  await expect(page.getByRole('heading', { name: 'Investigación del agente' })).toBeVisible();

  await page.getByRole('button', { name: 'Investigar', exact: true }).click();
  // El primer paso aparece en vivo (RNF-10).
  await expect(
    page.getByText('Modo demostración: el razonamiento está pregrabado; las búsquedas'),
  ).toBeVisible({ timeout: 3_000 });
  await expect(page.getByRole('heading', { name: 'Hallazgos' })).toBeVisible();

  // El agente cita las fuentes y encuentra datos sensibles de salud.
  const borrador = page.getByRole('textbox', { name: /Borrador/ });
  await expect(borrador).toHaveValue(/\[(crm|erp|tienda|planillas|rrhh|marketing):/);
  await expect(page.getByText('Contiene datos sensibles de salud').first()).toBeVisible();

  // No se puede aprobar con coincidencias dudosas pendientes: el encargado las revisa (RF-13).
  const descartar = page.getByRole('button', { name: 'Descartar' });
  while ((await descartar.count()) > 0) {
    await descartar.first().click();
  }

  await borrador.fill(`${await borrador.inputValue()}\n\nNota agregada por el encargado.`);
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Aprobar y descargar PDF' }).click();
  expect((await descarga).suggestedFilename()).toBe('respuesta-SOL-001.pdf');
  await expect(page.getByText(/Respuesta aprobada · no enviada el/)).toBeVisible();

  // Bitácora de solo agregar con aprobación y «no enviado» (RF-18, RG-08).
  await page.getByRole('link', { name: 'Bitácora' }).click();
  await expect(page.getByText('Aprobó la versión 1 de la respuesta').first()).toBeVisible();
  await expect(page.getByText(/Gmail no está conectado/).first()).toBeVisible();

  // Reporte de cumplimiento con métricas (RF-21, RF-22).
  await page.getByRole('link', { name: 'Reportes' }).click();
  await expect(page.getByText('Respondidas en plazo')).toBeVisible();
  const reporte = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar reporte de cumplimiento (PDF)' }).click();
  expect((await reporte).suggestedFilename()).toMatch(
    /^reporte-cumplimiento-\d{4}-\d{2}-\d{2}\.pdf$/,
  );

  // Criterio de aceptación: el recorrido toma menos de 3 minutos.
  expect(Date.now() - inicio).toBeLessThan(180_000);
});

test('la clave de API vive en memoria y se enmascara', async ({ page }) => {
  await page.goto('/configuracion');
  const campo = page.getByLabel('Clave de API');
  await expect(campo).toHaveAttribute('type', 'password');
  await campo.fill('sk-ant-prueba-falsa-1234');
  // Sin red real a Anthropic en la prueba: solo se verifica el enmascarado y que no se persista.
  await page.route('https://api.anthropic.com/**', (r) =>
    r.fulfill({
      status: 401,
      body: '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}',
      contentType: 'application/json',
    }),
  );
  await page.getByRole('button', { name: 'Guardar y probar' }).click();
  await expect(page.getByText('Configurada: ••••••••1234')).toBeVisible();
  await expect(page.getByText('La clave no funcionó')).toBeVisible();
  const enAlmacenamiento = await page.evaluate(
    () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
  );
  expect(enAlmacenamiento).not.toContain('sk-ant-prueba-falsa-1234');
  await page.reload();
  await expect(page.getByText('Sin clave: la app funciona en modo demostración.')).toBeVisible();
});
