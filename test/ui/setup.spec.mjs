import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { JsonRpcProvider } from 'ethers';
import { startLocalChain } from '../../scripts/local-chain.mjs';
import { readArtifacts } from '../../scripts/sepolia-config.mjs';
import { SetupService } from '../../app/setup.mjs';
import { Store } from '../../app/store.mjs';
import { startServer } from '../../app/server.mjs';

let chain, snapshot, service, store, app, provider, mode, walletSends, originalHash;
test.beforeAll(async () => { chain = await startLocalChain(); snapshot = await chain.provider.send('evm_snapshot', []); });
test.afterAll(async () => { await chain.close(); });
test.beforeEach(async ({ page, context }) => {
  await chain.provider.send('evm_revert', [snapshot]); snapshot = await chain.provider.send('evm_snapshot', []);
  await chain.provider.send('anvil_setNextBlockBaseFeePerGas', ['0x0']); await chain.provider.send('evm_mine', []);
  provider = new JsonRpcProvider(chain.config.rpcUrl, undefined, { cacheTimeout: -1, batchMaxCount: 1 }); provider.pollingInterval = 50;
  provider.getFeeData = async () => ({ maxFeePerGas: 10000000n, maxPriorityFeePerGas: 1n });
  store = new Store(); mode = 'owner'; walletSends = 0; originalHash = null;
  service = new SetupService({ seed: { instanceId: 'independent-browser-setup', ownerAddress: chain.config.ownerAddress,
    agentAddress: await chain.agent.getAddress(), vendors: { 'V-HOST': await chain.host.getAddress(), 'V-DESIGN': await chain.design.getAddress() } },
  provider, store, artifacts: readArtifacts(), expectedChainId: 31337, confirmations: 1 });
  app = await startServer(service, { port: 0, publicDir: new URL('../../dist/setup/', import.meta.url) });
  await context.exposeBinding('__setupTestWallet', async (_, { method, params }) => {
    if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return { value: [mode === 'wrong-owner' ? await chain.stranger.getAddress() : chain.config.ownerAddress] };
    if (method === 'eth_chainId') return { value: mode === 'wrong-network' ? '0x1' : '0x7a69' };
    if (method === 'eth_sendTransaction') {
      if (mode === 'reject') return { error: { code: 4001, message: 'User rejected the request.' } };
      walletSends++;
      originalHash = await chain.provider.send(method, params);
      if (mode === 'lost-response') return { error: { code: -32000, message: 'Simulated lost wallet response. Check the original hash.' } };
      return { value: originalHash };
    }
    return { error: { code: -32601, message: 'Unsupported development wallet method.' } };
  });
  await context.addInitScript(() => { window.ethereum = { async request(args) {
    const r = await window.__setupTestWallet(args); if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code }); return r.value;
  } }; });
  await page.goto(app.origin); await expect(page.locator('#network')).toHaveText('Local deployment rehearsal');
});
test.afterEach(async () => { await app.close(); service.close(); store.close(); });
async function review(page) {
  await page.locator('[data-prepare="token"]').click(); await expect(page.locator('#review')).toBeVisible();
  await expect(page.locator('#details')).toContainText(chain.config.ownerAddress);
  await expect(page.locator('#details')).toContainText('1,000 MDT');
}
test('deployment review stays read-only and excludes unsupported routes and cross-origin writes', async ({ page }) => {
  await page.locator('#connect').click(); await expect(page.locator('#connect')).toHaveText('Owner wallet connected');
  await review(page); await page.locator('#reviewed').check(); await expect(page.locator('#send')).toBeDisabled();
  expect(walletSends).toBe(0); expect(service.address('token')).toBeNull();
  expect((await fetch(`${app.origin}/.env`)).status).toBe(404);
  const state = await (await fetch(`${app.origin}/api/state`)).json();
  const rejected = await fetch(`${app.origin}/api/prepare`, { method: 'POST', headers: { origin: 'https://example.invalid', 'x-mandate-csrf': state.csrf, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'token' }) });
  expect(rejected.status).toBe(403);
  await mkdir('evidence', { recursive: true }); await page.screenshot({ path: 'evidence/step5-sepolia-setup-review-local.png', fullPage: true });
});
test('wrong network, wrong owner and wallet rejection cause no setup transaction', async ({ page }) => {
  service.allowWalletRequests = true; await page.locator('#refresh').click(); await review(page);
  for (const invalid of ['wrong-network', 'wrong-owner', 'reject']) {
    mode = invalid; await page.locator('#reviewed').check(); await page.locator('#send').click();
    await expect(page.locator('#review')).not.toBeVisible(); expect(walletSends).toBe(0);
    if (invalid === 'reject') expect(service.intents()[0].status).toBe('cancelled');
    else {
      expect(service.intents()[0].status).toBe('prepared'); await page.locator('[data-view]').click();
    }
  }
});
test('lost wallet response locks the action across reload and verifies the original transaction once', async ({ page }) => {
  service.allowWalletRequests = true; await page.locator('#refresh').click(); mode = 'lost-response'; await review(page);
  await page.locator('#reviewed').check(); await page.locator('#send').click();
  await expect(page.locator('#review')).not.toBeVisible(); expect(walletSends).toBe(1);
  expect(service.intents()[0].status).toBe('wallet_requested');
  await page.reload(); await expect(page.locator('[data-original]')).toBeVisible();
  await page.locator('[data-original]').fill(originalHash); await page.locator('[data-record]').click();
  await expect(page.locator('#history')).toContainText('Confirmed'); expect(walletSends).toBe(1);
  expect(service.address('token')).not.toBeNull(); await expect(page.locator('[data-prepare="token"]')).toBeDisabled();
});
