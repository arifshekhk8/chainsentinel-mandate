import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { startGateway } from '../scripts/hosting/gateway.mjs';

test('browser form sign-in and sign-out preserve Origin while anonymous API access stays blocked', { timeout: 30000 }, async () => {
  const secret = 'synthetic-browser-check-secret-0123456789';
  const upstream = createServer((req, res) => {
    if (req.url === '/api/state') { res.setHeader('content-type', 'application/json'); return res.end('{"safe":true}'); }
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><html><head></head><body><div class="shell">Synthetic owner workspace</div></body></html>');
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const gateway = await startGateway({ upstream: `http://127.0.0.1:${upstream.address().port}`,
    publicOrigin: origin, password: secret, sessionSecret: secret, port, host: '127.0.0.1', allowInsecureLocal: true,
    state: { healthy: true, async assertCurrent() {}, async persist() {} } });
  let browser;
  try {
    browser = await chromium.launch({ ...(process.env.CI ? {} : { channel: 'chrome' }), headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const postedOrigins = [];
    page.on('request', (req) => { if (req.method() === 'POST') postedOrigins.push(req.headers().origin); });
    assert.equal((await context.request.get(origin + '/api/state')).status(), 401);
    await page.goto(origin);
    await page.getByLabel('Workspace password').fill(secret);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(origin + '/');
    assert.deepEqual(await (await context.request.get(origin + '/api/state')).json(), { safe: true });
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL(origin + '/login');
    assert.equal((await context.request.get(origin + '/api/state')).status(), 401);
    assert.deepEqual(postedOrigins, [origin, origin]);
  } finally {
    await browser?.close(); await gateway.close();
    await new Promise((resolve) => upstream.close(resolve));
  }
});
