import { test, expect } from '@playwright/test';
import { startLocalChain } from '../../scripts/local-chain.mjs';
import { OwnerService } from '../../app/service.mjs';
import { Store } from '../../app/store.mjs';
import { AgentService } from '../../app/agent.mjs';
import { OpenAIModel } from '../../app/model.mjs';
import { startServer } from '../../app/server.mjs';
import { sampleRows } from '../../app/samples.mjs';
import { id, parseUnits } from 'ethers';

let chain, snapshotId, store, service, app, output;
const proposal = (intent, extra = {}) => ({ intent, scope: 'all', billIds: [], question: '', correction: null, ...extra });
test.beforeAll(async () => { chain = await startLocalChain(); snapshotId = await chain.provider.send('evm_snapshot', []); });
test.afterAll(async () => { await chain.close(); });
test.beforeEach(async ({ page }) => {
  await chain.provider.send('evm_revert', [snapshotId]); snapshotId = await chain.provider.send('evm_snapshot', []);
  store = new Store(); service = new OwnerService(chain.config, store, chain.vaultAbi, chain.tokenAbi);
  const fields = sampleRows(await service.snapshot());
  store.importDocument({ filename: 'development-browser.csv', hash: id('development-browser'), sourceText: 'Synthetic development source. Never a live-model evaluation.', records: fields.map((fields) => ({ fields, extractionWarnings: [] })) });
  const rows = await service.assessAll(); for (const r of rows) await service.reviewDraft(r.id, { version: r.version, checked: true });
  const p = await service.prepare('bills', { ids: rows.map((r) => r.id) });
  const tx = await chain.owner.sendTransaction({ to: p.payload.to, data: p.payload.data }); await service.submitted(p.id, tx.hash);
  await (await chain.vault.setPaused(false)).wait();
  output = proposal('status');
  service.agent = new AgentService(service, { mode: 'scripted-test', async propose() { return output; } }, chain.agent);
  app = await startServer(service, { port: 0 });
  await page.goto(app.origin); await expect(page.locator('#agent-workspace')).toBeVisible();
});
test.afterEach(async () => { await app.close(); service.close(); store.close(); });
async function ask(page, message) {
  await page.locator('#agent-message').fill(message); await page.locator('#ask-agent').click();
  await expect(page.locator('#ask-agent')).toBeEnabled();
}
test('AI-off manual preview pays one exact batch with real local receipts and no browser wallet', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  service.agent.model = new OpenAIModel({ apiKey: '', model: '' }); await page.locator('#refresh').click();
  await expect(page.locator('#ask-agent')).toBeDisabled();
  await page.locator('#manual-preview').click();
  await expect(page.locator('#agent-result')).toContainText('SCRIPTED MANUAL PREVIEW');
  await expect(page.locator('#agent-result')).toContainText('350 MDT');
  await expect(page.locator('#agent-result')).toContainText('daily budget is too small');
  await expect(page.locator('#run-agent')).toBeDisabled(); await page.locator('#confirm-agent').check();
  await page.locator('#run-agent').click();
  await expect(page.locator('#vault-balance')).toHaveText('650');
  await expect(page.locator('#payment-results .pill.confirmed')).toHaveCount(2);
  expect(await chain.token.balanceOf(chain.config.vaultAddress)).toBe(parseUnits('650', 6));
  expect(errors).toEqual([]); await expect(page.locator('#run-agent')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'evidence/step4-agent-desktop.png', fullPage: true });
});
test('read-only and clarification show no run button; a follow-up can produce an explicit plan', async ({ page }) => {
  output = proposal('pay'); await ask(page, 'Which invoices can be paid?');
  await expect(page.locator('#agent-result')).toContainText('Read-only preview'); await expect(page.locator('#run-agent')).toHaveCount(0);
  output = proposal('clarify', { scope: 'selected', question: 'Do you mean Hostline or Artline?' });
  await ask(page, 'Handle that one.'); await expect(page.locator('#agent-result')).toContainText('Do you mean Hostline or Artline?');
  await expect(page.locator('#run-agent')).toHaveCount(0);
  output = proposal('pay', { scope: 'selected', billIds: [store.drafts()[1].id] }); await ask(page, 'The Artline invoice.');
  await expect(page.locator('#agent-result')).toContainText('150 MDT total'); await expect(page.locator('#run-agent')).toBeDisabled();
  expect(service.agent.executor.payments()).toHaveLength(0);
});
test('AI correction requires applying and source review, while the signed amount remains active', async ({ page }) => {
  const row = store.drafts()[0]; output = proposal('correct', { correction: { draftId: row.id, field: 'amount', value: '180' } });
  await ask(page, 'Correct the hosting draft to 180 MDT.'); await expect(page.locator('#apply-agent-proposal')).toBeVisible();
  expect(store.draft(row.id).fields.amount).toBe('200.000000'); await page.locator('#apply-agent-proposal').click();
  await expect(page.locator('#bill-dialog')).toBeVisible(); await expect(page.locator('#bill-form [name="amount"]')).toHaveValue('180');
  await expect(page.locator('#source-checked')).not.toBeChecked();
  await expect(page.locator('#review-issues')).toContainText('does not revoke');
  expect((await chain.vault.getBill((await service.assessAll())[0].key)).amount).toBe(parseUnits('200', 6));
});
test('stale plan after owner stop shows a useful error without sending', async ({ page }) => {
  await page.locator('#manual-preview').click(); await expect(page.locator('#confirm-agent')).toBeVisible();
  await (await chain.vault.revokeAgent()).wait(); await page.locator('#confirm-agent').check(); await page.locator('#run-agent').click();
  await expect(page.locator('#notice')).toContainText('Permissions or UTC budget day changed');
  expect(service.agent.executor.payments()).toHaveLength(0); await expect(page.locator('#vault-balance')).toHaveText('1000');
});
test('mobile agent plan, malicious proposal text and recipient details remain readable and inert', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  output = proposal('clarify', { question: '<img src=x onerror=window.BAD_AGENT=1> Which invoice?' });
  await ask(page, 'Handle that invoice.'); await expect(page.locator('#agent-result')).toContainText('<img src=x');
  await expect(page.locator('#agent-result img')).toHaveCount(0); expect(await page.evaluate(() => window.BAD_AGENT)).toBeUndefined();
  await page.locator('#manual-preview').click(); await expect(page.locator('#confirm-agent')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/step4-agent-mobile.png', fullPage: true });
});
