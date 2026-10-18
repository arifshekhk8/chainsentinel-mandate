import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseUnits } from 'ethers';
import { startLocalChain } from '../../scripts/local-chain.mjs';
import { OwnerService } from '../../app/service.mjs';
import { Store } from '../../app/store.mjs';
import { startServer } from '../../app/server.mjs';
import { sampleCsv } from '../../app/samples.mjs';

let chain, snapshotId, store, service, app, mode, walletSends;
test.beforeAll(async () => { chain = await startLocalChain(); snapshotId = await chain.provider.send('evm_snapshot', []); });
test.afterAll(async () => { await chain.close(); });
test.beforeEach(async ({ context, page }) => {
  await chain.provider.send('evm_revert', [snapshotId]); snapshotId = await chain.provider.send('evm_snapshot', []);
  store = new Store(); service = new OwnerService(chain.config, store, chain.vaultAbi, chain.tokenAbi);
  app = await startServer(service, { port: 0 }); mode = 'owner'; walletSends = 0;
  await context.exposeBinding('__mandateTestWallet', async (_, { method, params }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return { value: [mode === 'stranger' ? await chain.stranger.getAddress() : chain.config.ownerAddress] };
    if (method === 'eth_chainId' && mode === 'wrongChain') return { value: '0x1' };
    if (method === 'eth_sendTransaction') {
      if (mode === 'reject') return { error: { code: 4001, message: 'User rejected the request.' } };
      walletSends++;
    }
    try { return { value: await chain.provider.send(method, params ?? []) }; }
    catch (error) { return { error: { code: error.info?.error?.code ?? -32000, message: error.shortMessage ?? 'Local test RPC rejected the call.' } }; }
  });
  await context.addInitScript(() => {
    // EIP-1193 test double; signing is by Anvil's disposable unlocked accounts, not MetaMask.
    window.ethereum = { isMetaMask: true, on() {}, removeListener() {}, async request(args) {
      const result = await window.__mandateTestWallet(args);
      if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
      return result.value;
    } };
  });
  await page.goto(app.origin);
  await expect(page.locator('#vault-balance')).toHaveText('1000');
});
test.afterEach(async () => { await app.close(); service.close(); store.close(); });

async function samples(page) { await page.locator('#load-sample').click(); await expect(page.locator('#bills-body tr')).toHaveCount(3); }
async function review(page, number, screenshot = null) {
  const row = page.locator('#bills-body tr').filter({ hasText: number });
  await row.getByRole('button', { name: 'Review ↗', exact: true }).click();
  await expect(page.locator('#source-text')).toContainText(number);
  if (screenshot) { await mkdir('evidence', { recursive: true }); await page.screenshot({ path: screenshot }); }
  await page.locator('#source-checked').check(); await page.locator('#mark-reviewed').click();
  await expect(page.locator('#bill-dialog')).not.toBeVisible(); await expect(row).toContainText('Ready to approve');
}
async function previewSelected(page, number) {
  await page.getByRole('checkbox', { name: `Select ${number}`, exact: true }).check();
  await page.locator('#approve-selected').click(); await expect(page.locator('#transaction-dialog')).toBeVisible();
}
async function sign(page) {
  await page.locator('#tx-reviewed').check(); await page.locator('#send-transaction').click();
  await expect(page.locator('#notice')).toContainText('Owner action confirmed', { timeout: 15000 });
}

test('owner reviews sources and signs an exact two-bill batch; no tokens are paid', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await samples(page); expect(walletSends).toBe(0);
  await review(page, 'HOST-1001', 'evidence/step3-review.png'); await review(page, 'ART-2001');
  await page.locator('#wallet').click(); await expect(page.locator('#notice')).toContainText('Owner wallet connected');
  await page.getByRole('checkbox', { name: 'Select HOST-1001', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Select ART-2001', exact: true }).check();
  await page.locator('#approve-selected').click();
  await expect(page.locator('#transaction-details')).toContainText('200 MDT');
  await expect(page.locator('#transaction-details')).toContainText('150 MDT');
  await expect(page.locator('#transaction-details')).toContainText(await chain.host.getAddress());
  await sign(page);
  await expect(page.locator('#bills-body .pill.approved')).toHaveCount(2);
  expect(walletSends).toBe(1);
  expect(await chain.token.balanceOf(chain.config.vaultAddress)).toBe(parseUnits('1000', 6));
  expect(errors).toEqual([]);
  await mkdir('evidence', { recursive: true });
  await page.screenshot({ path: 'evidence/step3-desktop.png', fullPage: true });
  const confirmed = store.intents().find((row) => row.status === 'confirmed');
  const receipt = await chain.provider.getTransactionReceipt(confirmed.hash);
  await writeFile('evidence/step3-owner-approval.json', JSON.stringify({
    evidenceType: 'local-browser-workflow', walletType: 'EIP-1193 test double with disposable Anvil signers',
    realWalletExtensionTested: false, liveModelUsed: false, publicTestnetEvidence: false,
    chainId: 31337, recordedAt: new Date().toISOString(), vault: chain.config.vaultAddress,
    token: chain.config.tokenAddress, owner: chain.config.ownerAddress, action: confirmed.payload.method,
    approvals: confirmed.payload.args[0], receipt: confirmed.receipt,
    logs: receipt.logs.map((log) => ({ address: log.address, topics: log.topics, data: log.data })),
    finalVaultBalanceBaseUnits: (await chain.token.balanceOf(chain.config.vaultAddress)).toString(),
    tokensPaidByThisWorkflow: '0',
  }, null, 2) + '\n');
});
test('wrong owner, wrong chain and rejected signature never become approvals', async ({ page }) => {
  await samples(page); await review(page, 'HOST-1001');
  mode = 'stranger'; await page.locator('#wallet').click(); await expect(page.locator('#notice')).toContainText('Wrong owner account');
  mode = 'wrongChain'; await page.locator('#wallet').click(); await expect(page.locator('#notice')).toContainText('Wrong network');
  mode = 'owner'; await page.locator('#wallet').click(); await previewSelected(page, 'HOST-1001');
  mode = 'reject'; await page.locator('#tx-reviewed').check(); await page.locator('#send-transaction').click();
  await expect(page.locator('#transaction-status')).toContainText('Signature rejected');
  await expect(page.locator('#send-transaction')).toBeDisabled();
  await page.locator('#cancel-transaction').click(); await expect(page.locator('#transaction-dialog')).not.toBeVisible();
  expect(walletSends).toBe(0);
  expect((await service.state()).drafts[0].status).toBe('ready');
});
test('pending wallet action stays unconfirmed until its receipt is mined', async ({ page }) => {
  await samples(page); await review(page, 'HOST-1001'); await page.locator('#wallet').click();
  await previewSelected(page, 'HOST-1001');
  await chain.provider.send('evm_setAutomine', [false]);
  try {
    await page.locator('#tx-reviewed').check(); await page.locator('#send-transaction').click();
    await expect.poll(() => store.intents().find((row) => row.hash)?.status).toBe('submitted');
    expect((await service.state()).drafts[0].status).toBe('submitted');
    expect(walletSends).toBe(1);
    await chain.provider.send('evm_mine', []);
    await expect(page.locator('#notice')).toContainText('Owner action confirmed', { timeout: 15000 });
    await expect(page.locator('#bills-body .pill.approved')).toHaveCount(1);
    expect(walletSends).toBe(1);
  } finally { await chain.provider.send('evm_setAutomine', [true]); }
});
test('PDF review, correction and hostile HTML stay safe without any wallet use', async ({ page }) => {
  const response = await fetch(app.origin + '/api/sample.pdf');
  await page.locator('#upload').setInputFiles({ name: 'hosting.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await response.arrayBuffer()) });
  await expect(page.locator('#bills-body tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Review ↗', exact: true }).click();
  await expect(page.locator('#bill-form [name="amount"]')).toHaveValue('200.000000');
  await page.locator('#source-checked').check();
  await page.locator('#bill-form [name="amount"]').fill('80');
  await expect(page.locator('#source-checked')).not.toBeChecked();
  await page.locator('#save-draft').click();
  await expect(page.locator('#bill-form [name="amount"]')).toHaveValue('80');
  await page.locator('.close-dialog').click();
  const hostile = sampleCsv(await service.snapshot()).replaceAll('Synthetic bill for local test-token demonstration.', '<img src=x onerror=window.INVOICE_EXECUTED=1>');
  await page.locator('#upload').setInputFiles({ name: 'hostile.csv', mimeType: 'text/csv', buffer: Buffer.from(hostile) });
  await expect(page.locator('#bills-body tr')).toHaveCount(4);
  await page.locator('#bills-body tr').filter({ hasText: 'ART-2001' }).getByRole('button', { name: 'Review ↗', exact: true }).click();
  await expect(page.locator('#source-text')).toContainText('<img src=x');
  expect(await page.evaluate(() => window.INVOICE_EXECUTED)).toBeUndefined();
  await expect(page.locator('#bill-dialog img')).toHaveCount(0);
  expect(walletSends).toBe(0);
});
test('rules form previews exact values and confirms the owner-signed change', async ({ page }) => {
  await page.locator('#wallet').click();
  await page.locator('[data-tab="controls"]').click();
  await page.locator('#limits-form [name="maxPerBill"]').fill('240');
  await page.getByRole('button', { name: 'Review rule change ↗', exact: true }).click();
  await expect(page.locator('#transaction-details')).toContainText('240 MDT');
  await sign(page);
  expect(await chain.vault.maxPerBill()).toBe(parseUnits('240', 6));
  expect(walletSends).toBe(1);
});
test('closing the review during a save does not reopen it after the response', async ({ page }) => {
  await samples(page);
  await page.locator('#bills-body tr').filter({ hasText: 'HOST-1001' }).getByRole('button', { name: 'Review ↗', exact: true }).click();
  await page.locator('#bill-form [name="amount"]').fill('81');
  await page.route('**/api/drafts/*', async (route) => {
    if (route.request().method() === 'PATCH') await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.locator('#save-draft').click(); await page.locator('.close-dialog').click();
  await expect(page.locator('#notice')).toContainText('Changes saved');
  await expect(page.locator('#bill-dialog')).not.toBeVisible();
  expect((await service.state()).drafts[0].fields.amount).toBe('81');
});
test('mobile workspace and review drawer fit a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await samples(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/step3-mobile.png', fullPage: true });
  await page.locator('#bills-body tr').filter({ hasText: 'HOST-1001' }).getByRole('button', { name: 'Review ↗', exact: true }).click();
  await expect(page.locator('#bill-dialog')).toBeVisible();
  await expect(page.locator('#source-text')).toContainText('HOST-1001');
  await page.locator('#bill-form [name="amount"]').fill('199.999999');
  await page.locator('#save-draft').click();
  await expect(page.locator('#bill-form [name="amount"]')).toHaveValue('199.999999');
});
