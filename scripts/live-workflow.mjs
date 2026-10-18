import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { parseUnits } from 'ethers';
import { startLocalChain } from './local-chain.mjs';
import { OwnerService } from '../app/service.mjs';
import { Store } from '../app/store.mjs';
import { AgentService } from '../app/agent.mjs';
import { createModel, GeminiModel, PROMPT_VERSION } from '../app/model.mjs';
import { AppError, check } from '../app/errors.mjs';
import { startServer } from '../app/server.mjs';
import { sampleRows, samplePdf } from '../app/samples.mjs';

// Explicit local-only review. Never reads the 40-case set or uses an existing browser/wallet/database.
check(!process.env.CI, 'Live workflow checks run only by explicit local command, outside CI.');
if (existsSync(new URL('../.env', import.meta.url))) process.loadEnvFile(new URL('../.env', import.meta.url));
const model = createModel();
check(model.mode === 'live-gemini', 'Configure Gemini locally before this explicit live/local-payment check.');
process.umask(0o077);
const root = new URL('../', import.meta.url);
const output = new URL('../evidence/step4-live-workflow.json', import.meta.url);
const run = { recordedAt: new Date().toISOString(), status: 'running', chainId: 31337,
  liveModelUsed: true, publicTestnetEvidence: false, fixed40CaseEvaluation: false,
  walletType: 'EIP-1193 test double using disposable local Anvil accounts', realWalletExtensionTested: false,
  promptVersion: PROMPT_VERSION, calls: [], checks: [] };
let chain, store, service, app, browser, context, page, stage = 'setup', fault = null, lastCallEnded = 0, ownerSends = 0;
const passed = (name, details = {}) => { run.checks.push({ name, status: 'passed', ...details }); console.log(`Passed: ${name}`); };
const amount = (value) => parseUnits(value, 6);
const liveModel = {
  mode: model.mode, model: model.model,
  get lastCall() { return fault ? null : model.lastCall; },
  async propose(kind, input) {
    if (fault === 'provider-rate-limit') {
      run.calls.push({ stage, kind, liveProviderCall: false, status: 'injected-429' });
      return new GeminiModel({ apiKey: 'synthetic-transport-token', fetcher: async () => new Response('', { status: 429 }) }).propose(kind, input);
    }
    if (lastCallEnded) await pause(Math.max(0, 12000 - (performance.now() - lastCallEnded)));
    try {
      const value = await model.propose(kind, input);
      run.calls.push({ stage, kind, liveProviderCall: true, status: 'completed', ...model.lastCall });
      return value;
    } catch (error) {
      run.calls.push({ stage, kind, liveProviderCall: true, status: 'failed',
        error: error instanceof AppError ? error.message : 'Provider transport failed.' });
      throw error;
    } finally { lastCallEnded = performance.now(); }
  },
};
async function uiAction(path, click, expectedStatus = 200) {
  const pending = page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === 'POST');
  await click();
  const response = await pending, data = await response.json();
  if (response.status() !== expectedStatus) throw new AppError(data.error ?? `Unexpected local response at ${stage}.`, response.status());
  return data;
}
async function ask(message, expectedStatus = 201) {
  await page.locator('#agent-message').fill(message);
  const plan = await uiAction('/api/agent/request', () => page.locator('#ask-agent').click(), expectedStatus);
  await expect(page.locator('#ask-agent')).toBeEnabled({ timeout: 45000 });
  return plan;
}
async function apiPost(path, body) {
  const state = await (await page.request.get(`${app.origin}/api/state`)).json();
  return page.request.post(`${app.origin}${path}`, { headers: { origin: app.origin, 'x-mandate-csrf': state.csrf }, data: body });
}
async function openBill(invoice) {
  await page.locator('#bills-body tr').filter({ hasText: invoice }).getByRole('button', { name: 'Review ↗', exact: true }).click();
  await expect(page.locator('#source-text')).toContainText(invoice);
}
async function review(invoice) {
  await openBill(invoice); await page.locator('#source-checked').check(); await page.locator('#mark-reviewed').click();
  await expect(page.locator('#bill-dialog')).not.toBeVisible();
}
async function sign() {
  await expect(page.locator('#transaction-dialog')).toBeVisible();
  await page.locator('#tx-reviewed').check(); await page.locator('#send-transaction').click();
  await expect(page.locator('#notice')).toContainText('Owner action confirmed', { timeout: 15000 });
  await expect(page.locator('#transaction-dialog')).not.toBeVisible();
  await expect(page.locator('#cancel-transaction')).toHaveText('Close');
}
async function unchanged() {
  assert.equal(await chain.token.balanceOf(chain.config.vaultAddress), amount('1000'));
  assert.equal(service.agent.executor.payments().length, 0);
}
try {
  const built = spawnSync(process.execPath, [new URL('./build-app.mjs', import.meta.url).pathname], { cwd: root, encoding: 'utf8' });
  check(built.status === 0, 'App build failed; run npm run build:app for details.');
  chain = await startLocalChain(); check(chain.config.chainId === 31337, 'Only a fresh local chain is allowed.');
  store = new Store(); service = new OwnerService(chain.config, store, chain.vaultAbi, chain.tokenAbi);
  service.agent = new AgentService(service, liveModel, chain.agent);
  app = await startServer(service, { port: 0 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'Asia/Dhaka' });
  await context.exposeBinding('__mandateLocalReviewWallet', async (_, { method, params }) => {
    if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return { value: [chain.config.ownerAddress] };
    if (method === 'eth_sendTransaction') ownerSends++;
    try { return { value: await chain.provider.send(method, params ?? []) }; }
    catch { return { error: { code: -32000, message: 'Disposable local test wallet rejected this request.' } }; }
  });
  await context.addInitScript(() => {
    window.ethereum = { isMetaMask: true, on() {}, removeListener() {}, async request(args) {
      const result = await window.__mandateLocalReviewWallet(args);
      if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
      return result.value;
    } };
  });
  page = await context.newPage(); page.setDefaultTimeout(45000);
  const pageErrors = []; page.on('pageerror', () => pageErrors.push('Unexpected browser error'));
  await page.goto(app.origin); await expect(page.locator('#agent-mode')).toContainText('Live Gemini configured');

  stage = 'PDF extraction and explicit apply';
  await page.locator('#upload').setInputFiles({ name: 'development-hosting.pdf', mimeType: 'application/pdf', buffer: await samplePdf(await service.snapshot()) });
  await expect(page.locator('#bills-body tr')).toHaveCount(1);
  await openBill('HOST-1001');
  const extracted = await uiAction(`/api/agent/extract/${store.drafts()[0].id}`, () => page.locator('#ai-extract').click(), 201);
  assert.equal(extracted.payload.fields.invoice_number, 'HOST-1001');
  assert.equal(amount(extracted.payload.fields.amount), amount('200')); assert.equal(extracted.payload.fields.currency, 'MDT');
  await expect(page.locator('#apply-agent-proposal')).toBeVisible();
  await page.locator('#apply-agent-proposal').click(); await expect(page.locator('#bill-dialog')).toBeVisible();
  await expect(page.locator('#source-checked')).not.toBeChecked();
  await page.locator('#source-checked').check(); await page.locator('#mark-reviewed').click();
  await expect(page.locator('#bill-dialog')).not.toBeVisible();
  await unchanged(); passed('Live PDF fields require apply and fresh source review');

  stage = 'owner approvals and resume';
  const rows = sampleRows(await service.snapshot()).slice(1), columns = Object.keys(rows[0]);
  const csv = columns.join(',') + '\n' + rows.map((row) => columns.map((key) => `"${row[key].replaceAll('"', '""')}"`).join(',')).join('\n');
  await page.locator('#upload').setInputFiles({ name: 'development-design-and-extra-hosting.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('#bills-body tr')).toHaveCount(3);
  await review('ART-2001'); await review('HOST-1002');
  await page.locator('#wallet').click(); await expect(page.locator('#notice')).toContainText('Owner wallet connected');
  for (const invoice of ['HOST-1001', 'ART-2001', 'HOST-1002']) await page.getByRole('checkbox', { name: `Select ${invoice}`, exact: true }).check();
  await page.locator('#approve-selected').click(); await sign();
  await expect(page.locator('#bills-body .pill.approved')).toHaveCount(3);
  await page.locator('[data-tab="controls"]').click(); await page.locator('#pause').click(); await sign();
  await page.locator('[data-tab="bills"]').click(); await unchanged();
  passed('Exact owner approvals and explicit resume send no bill payments', { ownerActions: ownerSends });

  stage = 'read-only request';
  const readOnly = await ask('Show which approved invoices are eligible. Do not pay anything.');
  assert(['status', 'plan'].includes(readOnly.payload.intent));
  await expect(page.locator('#run-agent')).toHaveCount(0); await unchanged(); passed('Live read-only question causes no payment');

  stage = 'clarification';
  const unclear = await ask('Pay that invoice.');
  assert.equal(unclear.payload.intent, 'clarify'); assert(unclear.payload.question.length > 0);
  await expect(page.locator('#run-agent')).toHaveCount(0); await unchanged(); passed('Live ambiguous request asks without payment');
  stage = 'clarification answer';
  const initialPlan = await ask('I mean all three approved invoices. Pay all of them within my rules.');
  assert.equal(initialPlan.payload.intent, 'pay'); assert.equal(initialPlan.payload.plan.total, '350000000');
  await expect(page.locator('#run-agent')).toBeDisabled(); await unchanged();
  passed('Live clarification answer prepares exact 350 MDT plan, awaiting confirmation');

  stage = 'draft correction and stale plan';
  const hosting = (await service.assessAll()).find((r) => r.fields.invoice_number === 'HOST-1001');
  const correction = await ask('Correct only the amount of the HOST-1001 draft to 180 MDT. Do not pay anything.');
  assert.equal(correction.payload.intent, 'correct'); assert.equal(amount(correction.payload.correction.value), amount('180'));
  await page.locator('#apply-agent-proposal').click(); await expect(page.locator('#bill-dialog')).toBeVisible();
  await expect(page.locator('#source-checked')).not.toBeChecked();
  assert.equal(amount(store.draft(hosting.id).fields.amount), amount('180'));
  assert.equal((await chain.vault.getBill(hosting.key)).amount, amount('200'));
  const stale = await apiPost(`/api/agent/plans/${initialPlan.id}/execute`, { confirmed: true });
  assert.equal(stale.status(), 409); await unchanged();
  // The original source says 200. The reviewer rejects the test correction and restores that exact amount.
  await page.locator('#bill-form [name="amount"]').fill('200'); await page.locator('#source-checked').check();
  await page.locator('#mark-reviewed').click(); await expect(page.locator('#bill-dialog')).not.toBeVisible();
  await page.getByRole('checkbox', { name: 'Select HOST-1001', exact: true }).check();
  await page.locator('#approve-selected').click(); await sign(); await unchanged();
  passed('Live draft correction cannot change chain approval; stale plan blocked before payment');

  stage = 'RPC failure with live plan';
  const interruptedPlan = await ask('Pay all three approved invoices within my spending rules.');
  assert.equal(interruptedPlan.payload.intent, 'pay'); assert.equal(interruptedPlan.payload.plan.total, '350000000');
  const originalCall = service.provider.call.bind(service.provider), selector = chain.vault.interface.getFunction('payBill').selector;
  service.provider.call = async (...args) => {
    if (args[0]?.data?.startsWith(selector)) throw Object.assign(new Error('Injected local RPC outage'), { code: 'NETWORK_ERROR' });
    return originalCall(...args);
  };
  try {
    await page.locator('#confirm-agent').check();
    await uiAction(`/api/agent/plans/${interruptedPlan.id}/execute`, () => page.locator('#run-agent').click(), 409);
    await expect(page.locator('#notice')).toContainText('RPC failed');
  } finally { service.provider.call = originalCall; }
  await unchanged(); passed('Injected RPC simulation failure stops live plan before broadcast');

  stage = 'confirmed live batch';
  const finalPlan = await ask('Pay all three approved invoices within my spending rules.');
  assert.equal(finalPlan.payload.intent, 'pay'); assert.equal(finalPlan.payload.plan.total, '350000000');
  await expect(page.locator('#run-agent')).toBeDisabled();
  const ownerActionsBeforeBatch = ownerSends;
  await page.locator('#confirm-agent').check();
  const result = await uiAction(`/api/agent/plans/${finalPlan.id}/execute`, () => page.locator('#run-agent').click());
  assert.equal(result.status, 'completed'); assert.equal(result.payments.length, 2);
  assert.equal(ownerSends, ownerActionsBeforeBatch);
  await expect(page.locator('#vault-balance')).toHaveText('650');
  await expect(page.locator('#payment-results .pill.confirmed')).toHaveCount(2);
  assert.equal(await chain.token.balanceOf(chain.config.vaultAddress), amount('650'));
  assert.equal(await chain.token.balanceOf(await chain.host.getAddress()), amount('200'));
  assert.equal(await chain.token.balanceOf(await chain.design.getAddress()), amount('150'));
  assert.equal(await chain.vault.currentDaySpent(), amount('350'));
  for (const payment of result.payments) {
    assert.equal(payment.status, 'confirmed');
    assert.equal((await chain.provider.getTransactionReceipt(payment.hash)).status, 1);
    assert.equal(payment.receipt.payment.billKey, payment.payload.billKey);
    assert.equal(payment.receipt.payment.recipient.toLowerCase(), payment.payload.recipient.toLowerCase());
    assert.equal(payment.receipt.payment.amount, payment.payload.amount);
  }
  run.payments = result.payments; run.ownerActionsBeforeBatch = ownerActionsBeforeBatch; run.ownerActionsAfterBatch = ownerSends;
  passed('One confirmation pays exactly 200 + 150 MDT with verified receipts and no extra owner signature');
  const deferred = finalPlan.payload.plan.entries.find((e) => e.invoice === 'HOST-1002');
  assert.equal(deferred.code, 'daily'); assert.equal((await chain.vault.getBill(deferred.key)).paid, false);
  const replay = await apiPost(`/api/agent/plans/${finalPlan.id}/execute`, { confirmed: true });
  assert.equal(replay.status(), 409);
  await service.agent.executor.recover(); assert.equal(service.agent.executor.payments().length, 2);
  assert.equal(await chain.token.balanceOf(chain.config.vaultAddress), amount('650'));
  passed('75 MDT deferred, completed plan cannot replay, receipt recovery sends nothing');
  await mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
  await page.screenshot({ path: new URL('../evidence/step4-live-workflow-desktop.png', import.meta.url).pathname, fullPage: true });

  stage = 'provider failure and explicit manual fallback';
  fault = 'provider-rate-limit';
  await ask('Show the remaining invoices. Do not pay anything.', 503);
  await expect(page.locator('#notice')).toContainText('Gemini quota'); fault = null;
  await page.locator('#manual-preview').click();
  await expect(page.locator('#agent-result')).toContainText('SCRIPTED MANUAL PREVIEW');
  await expect(page.locator('#run-agent')).toHaveCount(0);
  assert.equal(await chain.token.balanceOf(chain.config.vaultAddress), amount('650'));
  const state = await (await page.request.get(`${app.origin}/api/state`)).json();
  assert(!JSON.stringify(state).includes(process.env.GEMINI_API_KEY)); assert.equal(pageErrors.length, 0);
  passed('Injected provider quota error allows labeled manual preview, without extra payment or exposed key');
  run.status = 'passed'; run.vault = chain.config.vaultAddress; run.token = chain.config.tokenAddress;
  run.finalVaultBalanceBaseUnits = '650000000'; run.finalDailySpentBaseUnits = '350000000';
} catch (error) {
  run.status = 'failed'; run.failedStage = stage;
  run.error = error instanceof AppError ? error.message : `Workflow assertion failed at: ${stage}.`;
  await mkdir(new URL('../local-data/', import.meta.url), { recursive: true });
  const diagnostic = String(error.stack ?? error).replaceAll(process.env.GEMINI_API_KEY || 'never-match-empty', '[REDACTED]');
  await writeFile(new URL('../local-data/live-workflow-failure.txt', import.meta.url), diagnostic, { mode: 0o600 });
  console.error(run.error); process.exitCode = 1;
} finally {
  fault = null;
  run.ownerActionsObserved = ownerSends;
  await context?.close(); await browser?.close(); await app?.close(); service?.close(); store?.close(); await chain?.close();
  const history = existsSync(output) ? JSON.parse(await readFile(output, 'utf8')) : { evidenceType: 'live-Gemini-browser-and-disposable-local-chain', runs: [] };
  history.runs.push(run);
  await writeFile(output, `${JSON.stringify(history, null, 2)}\n`);
  console.log(JSON.stringify({ status: run.status, checksPassed: run.checks.length,
    liveCallsCompleted: run.calls.filter((c) => c.liveProviderCall && c.status === 'completed').length,
    chainId: 31337, publicTestnetEvidence: false, fixed40CaseEvaluation: false }));
}
