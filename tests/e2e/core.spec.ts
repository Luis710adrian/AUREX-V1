import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { generate } from 'otplib';
const env = Object.fromEntries(
  readFileSync('apps/web/.env.local', 'utf8')
    .trim()
    .split('\n')
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(role + '@aurex.demo');
  await page.getByLabel('Contraseña').fill(env.AUREX_DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
test('Unauthenticated API and direct URL are protected', async ({ page }) => {
  const health = await page.request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ auth: 'reachable', database: 'reachable' });
  if (process.env.AUREX_E2E_PRODUCTION === '1') {
    const login = await page.request.get('/login');
    expect(login.headers()['content-security-policy']).not.toContain("'unsafe-eval'");
  }
  const r = await page.request.get('/api/data?table=leads');
  expect(r.status()).toBe(401);
  await page.goto('/finance');
  await expect(page).toHaveURL(/login/);
});
test('Sales cannot reach financial API or mutate payments', async ({ page }) => {
  await login(page, 'sales');
  await page.getByRole('link', { name: 'Continuar', exact: true }).click();
  await page.goto('/finance');
  await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('/api/data?table=payments')).status)).toBe(
    403,
  );
  const status = await page.evaluate(
    async (data) =>
      (
        await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      ).status,
    {
      action: 'record_payment',
      i: crypto.randomUUID(),
      amount: 100,
      paid_on: new Date().toISOString().slice(0, 10),
      method: 'Transfer',
      reference: 'TEST',
      key: crypto.randomUUID(),
    },
  );
  expect(status).toBe(403);
});
test('Cross-origin mutation is denied', async ({ page }) => {
  const r = await page.request.post('/api/actions', {
    headers: { Origin: 'https://untrusted.example' },
    data: { action: 'create_lead' },
  });
  expect(r.status()).toBe(403);
});
test('Browser lead-to-cash with real Auth, MFA and persisted KPIs', async ({ page }) => {
  await login(page, 'owner');
  const enrollment = page.getByRole('button', { name: 'Configurar MFA' });
  // Test-only bootstrap ensures fresh MFA factors before this run.
  await enrollment.click();
  const secret = await page.getByTestId('totp-secret').textContent();
  expect(secret).toBeTruthy();
  await page.getByLabel('Código MFA').fill(await generate({ secret: secret! }));
  await page.getByRole('button', { name: 'Verificar MFA' }).click();
  await expect(page).toHaveURL(/command/);
  await expect(page.getByText('DEMO · Datos de prueba persistentes')).toBeVisible();
  const name = 'E2E · ' + Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  async function action(
    title: string,
    fields: Record<string, string>,
    selects: Record<string, string> = {},
  ) {
    const details = page
      .locator('details')
      .filter({ has: page.locator('summary', { hasText: title }) });
    await details.locator('summary').click();
    for (const [label, value] of Object.entries(fields))
      await details.getByLabel(label, { exact: true }).fill(value);
    for (const [label, value] of Object.entries(selects))
      await details.getByLabel(label, { exact: true }).selectOption({ label: value });
    await details.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(details.getByRole('status')).toHaveText('Registro guardado.');
    await details.locator('summary').click();
  }
  await page.goto('/crm');
  await action('Nuevo lead', {
    Empresa: name,
    Contacto: 'Contacto E2E',
    Email: 'e2e@example.invalid',
    Necesidad: 'Diagnóstico estratégico',
    Origen: 'E2E',
    'Siguiente acción': 'Discovery',
  });
  await action(
    'Calificar lead',
    { Servicio: 'BI Research', 'Valor MXN': '10000', 'Fecha de cierre': future },
    { Lead: name },
  );
  await action(
    'Crear propuesta',
    { Alcance: 'Diagnóstico y estudio completo E2E', Vigencia: future },
    { Oportunidad: name },
  );
  for (const stage of ['Discovery', 'Solution Designed', 'Proposal Sent', 'Negotiation', 'Won'])
    await action(
      'Cambiar etapa',
      { Motivo: 'Criterio aprobado E2E' },
      { Oportunidad: name, Etapa: stage },
    );
  await page.goto('/projects');
  await action(
    'Nueva tarea',
    { Tarea: name + ' task', Vencimiento: future, 'Horas estimadas': '8' },
    { Proyecto: name },
  );
  await action(
    'Nuevo hito',
    { Hito: name + ' milestone', Vencimiento: future },
    { Proyecto: name },
  );
  await page.goto('/work');
  await action(
    'Registrar horas',
    { Minutos: '120', Fecha: today, Descripción: 'Análisis E2E' },
    { Tarea: name + ' task' },
  );
  await page.goto('/finance');
  await action(
    'Emitir factura',
    { Concepto: name + ' fee', 'Subtotal MXN': '10000', Impuestos: '1600', Vencimiento: future },
    { Proyecto: name },
  );
  await action(
    'Registrar pago',
    { Monto: '11600', Fecha: today, Método: 'Transfer', Referencia: name },
    { Factura: name + ' fee' },
  );
  await page.goto('/finance?table=invoice_balances');
  const invoice = page.getByRole('row').filter({ hasText: name + ' fee' });
  await expect(invoice).toContainText('paid');
  await page.goto('/command');
  await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/command-center.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/command-center-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/admin');
  const ownerRow = page.getByRole('row').filter({ hasText: 'owner@aurex.demo' });
  await ownerRow.getByRole('combobox').selectOption('analyst');
  await ownerRow.getByRole('button', { name: 'Guardar rol' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Debe permanecer' })).toContainText(
    'Debe permanecer al menos un Owner activo',
  );
  await ownerRow.getByRole('combobox').selectOption('owner');
  const analystRow = page.getByRole('row').filter({ hasText: 'analyst@aurex.demo' });
  await analystRow.getByRole('button', { name: 'Bloquear', exact: true }).click();
  await expect(analystRow.getByRole('cell', { name: 'Bloqueado', exact: true })).toBeVisible();
  await analystRow.getByRole('button', { name: 'Reactivar' }).click();
  await expect(analystRow.getByRole('cell', { name: 'Activo', exact: true })).toBeVisible();
  const invited = 'invited-' + Date.now() + '@aurex.demo';
  const form = page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: 'Invitar usuario' }) });
  await form.locator('summary').click();
  await form.getByLabel('Email del usuario').fill(invited);
  await form.getByLabel('Rol', { exact: true }).selectOption('analyst');
  await form.getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(form.getByRole('status')).toContainText('Invitación registrada.');
  const list = await (await page.request.get('http://127.0.0.1:54324/api/v1/messages')).json();
  const mail = list.messages.find((m: { To: { Address: string }[] }) =>
    m.To.some((to) => to.Address === invited),
  );
  expect(!!mail).toBe(true);
  const message = await (
    await page.request.get('http://127.0.0.1:54324/api/v1/message/' + mail.ID)
  ).json();
  const match = String(message.HTML).match(/href="([^"]+\/verify[^"]+)"/);
  expect(!!match).toBe(true);
  const link = match![1].replaceAll('&amp;', '&');
  const url = new URL(link);
  expect(url.hostname).toBe('127.0.0.1');
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Activa tu acceso' })).toBeVisible();
  await page.getByLabel('Nueva contraseña').fill(env.AUREX_DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Activar acceso' }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('Email', { exact: true }).fill(invited);
  await page.getByLabel('Contraseña').fill(env.AUREX_DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('link', { name: 'Continuar', exact: true }).click();
  await expect(page).toHaveURL(/command/);
  await expect(page.getByText('Sesión: analyst', { exact: false })).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('/api/admin/members')).status)).toBe(403);
});
