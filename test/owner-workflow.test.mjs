import assert from 'node:assert/strict';
import { before, beforeEach, after, afterEach, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { id, parseUnits } from 'ethers';
import { startLocalChain } from '../scripts/local-chain.mjs';
import { OwnerService } from '../app/service.mjs';
import { Store } from '../app/store.mjs';
import { startServer } from '../app/server.mjs';
import { sampleCsv } from '../app/samples.mjs';

let chain, snapshotId, service, store, app, csrf;
before(async () => { chain = await startLocalChain(); snapshotId = await chain.provider.send('evm_snapshot', []); });
beforeEach(async () => {
  await chain.provider.send('evm_revert', [snapshotId]); snapshotId = await chain.provider.send('evm_snapshot', []);
  store = new Store(); service = new OwnerService(chain.config, store, chain.vaultAbi, chain.tokenAbi);
  app = await startServer(service, { port: 0 }); csrf = (await call('/api/state')).value.csrf;
});
afterEach(async () => { await app.close(); service.close(); store.close(); });
after(async () => { await chain.close(); });
async function call(path, method = 'GET', body = null, headers = {}) {
  const opts = { method, headers: { ...(method === 'GET' ? {} : { origin: app.origin, 'x-mandate-csrf': csrf }), ...headers } };
  if (body instanceof FormData) opts.body = body;
  else if (body !== null) { opts.headers['content-type'] ??= 'application/json'; opts.body = JSON.stringify(body); }
  const response = await fetch(app.origin + path, opts);
  return { status: response.status, value: await response.json() };
}
async function state() { const result = await call('/api/state'); assert.equal(result.status, 200); return result.value; }
async function upload(text = null, filename = 'bills.csv') {
  text ??= sampleCsv(await service.snapshot());
  const form = new FormData(); form.append('file', new File([text], filename, { type: 'text/csv' }));
  const response = await call('/api/upload', 'POST', form); assert.equal(response.status, 201, JSON.stringify(response.value));
  return (await state()).drafts;
}
async function review(row, overrides = {}) {
  const result = await call(`/api/drafts/${row.id}/review`, 'POST', { version: row.version, checked: true, ...overrides });
  assert.equal(result.status, 200, JSON.stringify(result.value));
}
async function prepare(action, body) {
  const result = await call('/api/prepare', 'POST', { action, ...body });
  assert.equal(result.status, 201, JSON.stringify(result.value)); return result.value;
}
async function send(intent, signer = chain.owner) {
  const tx = await signer.sendTransaction({ to: intent.payload.to, data: intent.payload.data, gasLimit: 2000000 });
  return { tx, result: await call(`/api/intents/${intent.id}/submitted`, 'POST', { hash: tx.hash }) };
}

test('intake makes editable drafts, never on-chain approvals or payments', async () => {
  const rows = await upload();
  assert.equal(rows.length, 3); assert(rows.every((row) => row.status === 'draft'));
  assert.equal((await chain.vault.getBill(rows[0].key)).amount, 0n);
  assert.equal(await chain.token.balanceOf(chain.config.vaultAddress), parseUnits('1000', 6));
});
test('unsigned and unreviewed drafts cannot execute or prepare approval', async () => {
  const [row] = await upload();
  assert.equal((await call('/api/prepare', 'POST', { action: 'bills', ids: [row.id] })).status, 409);
  await (await chain.vault.setPaused(false)).wait();
  await assert.rejects(chain.vault.connect(chain.agent).payBill.staticCall(row.key, await chain.vault.policyVersion()), /BillNotApproved/);
});
test('two reviewed bills receive exact receipt-verified owner approvals without paying', async () => {
  const rows = (await upload()).slice(0, 2); for (const row of rows) await review(row);
  const intent = await prepare('bills', { ids: rows.map((row) => row.id) });
  assert.equal((await call(`/api/intents/${intent.id}/validate`, 'POST', {})).status, 200);
  const { result } = await send(intent); assert.equal(result.value.status, 'confirmed');
  const after = await state(); assert.equal(after.drafts.filter((row) => row.status === 'approved').length, 2);
  assert.equal((await chain.vault.getBill(rows[0].key)).amount, parseUnits('200', 6));
  assert.equal((await chain.vault.getBill(rows[0].key)).recipient, await chain.host.getAddress());
  assert.equal(await chain.token.balanceOf(chain.config.vaultAddress), parseUnits('1000', 6));
});
test('editing a reviewed draft invalidates its review and prepared transaction', async () => {
  const [row] = await upload(); await review(row);
  const intent = await prepare('bills', { ids: [row.id] });
  const edit = await call(`/api/drafts/${row.id}`, 'PATCH', { version: row.version, fields: { ...row.fields, amount: '80' } });
  assert.equal(edit.status, 200); assert.equal(edit.value.review, null);
  assert.equal((await call(`/api/intents/${intent.id}/validate`, 'POST', {})).status, 409);
  assert.equal((await chain.vault.getBill(row.key)).amount, 0n);
});
test('editing after confirmation does not relabel new fields as approved or alter old permission', async () => {
  const [row] = await upload(); await review(row);
  const intent = await prepare('bills', { ids: [row.id] }); await send(intent);
  await call(`/api/drafts/${row.id}`, 'PATCH', { version: row.version, fields: { ...row.fields, amount: '80' } });
  const changed = (await state()).drafts[0];
  assert.equal(changed.status, 'draft');
  assert.equal((await chain.vault.getBill(row.key)).amount, parseUnits('200', 6));
});
test('wrong currency, missing amount and invalid dates stop review', async () => {
  const [row] = await upload();
  await call(`/api/drafts/${row.id}`, 'PATCH', { version: row.version, fields: { ...row.fields, amount: '', currency: 'USD', due_date: '2026-02-31' } });
  const changed = (await state()).drafts[0];
  assert.equal(changed.status, 'needs_review');
  assert(changed.errors.some((e) => e.includes('MDT')) && changed.errors.some((e) => e.includes('token amount')));
  assert.equal((await call(`/api/drafts/${row.id}/review`, 'POST', { version: changed.version, checked: true })).status, 409);
});
test('invoice recipient cannot update registry and mismatch requires independent owner acknowledgment', async () => {
  const [row] = await upload();
  const attacker = await chain.stranger.getAddress();
  await call(`/api/drafts/${row.id}`, 'PATCH', { version: row.version, fields: { ...row.fields, recipient: attacker } });
  const changed = (await state()).drafts[0]; assert(changed.recipientMismatch);
  assert.equal((await call(`/api/drafts/${row.id}/review`, 'POST', { version: changed.version, checked: true })).status, 400);
  await review(changed, { recipientChecked: true });
  const intent = await prepare('bills', { ids: [row.id] });
  assert.equal(intent.payload.args[0][0].recipient, await chain.host.getAddress());
  assert.equal((await chain.vault.vendors(id('V-HOST'))).recipient, await chain.host.getAddress());
});
test('normalized duplicate with a renamed file cannot enter a second approval batch', async () => {
  await upload(); const text = sampleCsv(await service.snapshot()).replaceAll('HOST-1001', '  host-1001  ');
  const rows = await upload(text, 'renamed-copy.csv');
  const duplicate = rows[3]; assert.equal(duplicate.key, rows[0].key);
  assert(duplicate.errors.some((e) => e.includes('Duplicate')));
  assert.equal((await call(`/api/drafts/${duplicate.id}/review`, 'POST', { version: duplicate.version, checked: true })).status, 409);
});
test('similar invoice identifiers demand explicit duplicate review', async () => {
  const [row] = await upload();
  const text = sampleCsv(await service.snapshot()).replaceAll('HOST-1001', 'HOST1001');
  await upload(text, 'similar.csv');
  const current = (await state()).drafts.find((draft) => draft.id === row.id); assert(current.similar);
  assert.equal((await call(`/api/drafts/${row.id}/review`, 'POST', { version: row.version, checked: true })).status, 400);
  await review(current, { similarityChecked: true });
});
test('vendor change invalidates review and stale transaction without resetting fields', async () => {
  const [row] = await upload(); await review(row);
  const intent = await prepare('bills', { ids: [row.id] });
  await (await chain.vault.setVendor(id('V-HOST'), await chain.host.getAddress(), true)).wait();
  assert.equal((await call(`/api/intents/${intent.id}/validate`, 'POST', {})).status, 409);
  assert.equal((await state()).drafts[0].reviewValid, false);
});
test('unrelated receipt and a different sender never become an approved bill', async () => {
  const [row] = await upload(); await review(row);
  const intent = await prepare('bills', { ids: [row.id] });
  const tx = await chain.token.transfer(await chain.host.getAddress(), 0);
  await tx.wait();
  const result = await call(`/api/intents/${intent.id}/submitted`, 'POST', { hash: tx.hash });
  assert.equal(result.value.status, 'invalid'); assert.notEqual((await state()).drafts[0].status, 'approved');
  const second = await prepare('bills', { ids: [row.id] });
  const wrong = await send(second, chain.stranger);
  assert.equal(wrong.result.value.status, 'invalid');
  assert.equal((await chain.vault.getBill(row.key)).amount, 0n);
});
test('pending approval stays pending and locks editing until its matching receipt arrives', async () => {
  const [row] = await upload(); await review(row);
  const intent = await prepare('bills', { ids: [row.id] });
  await chain.provider.send('evm_setAutomine', [false]);
  try {
    const { result } = await send(intent); assert.equal(result.value.status, 'submitted');
    assert.equal((await state()).drafts[0].status, 'submitted');
    assert.equal((await call(`/api/drafts/${row.id}`, 'PATCH', { version: row.version, fields: row.fields })).status, 409);
    await chain.provider.send('evm_mine', []);
    assert.equal((await call(`/api/intents/${intent.id}/reconcile`, 'POST', {})).value.status, 'confirmed');
  } finally { await chain.provider.send('evm_setAutomine', [true]); }
});
test('RPC uncertainty preserves the original hash and reconciles without a second send', async () => {
  const [row] = await upload(); await review(row);
  const intent = await prepare('bills', { ids: [row.id] });
  const tx = await chain.owner.sendTransaction({ to: intent.payload.to, data: intent.payload.data }); await tx.wait();
  const original = service.provider.getTransactionReceipt;
  service.provider.getTransactionReceipt = async () => { throw new Error('simulated read timeout'); };
  const pending = await call(`/api/intents/${intent.id}/submitted`, 'POST', { hash: tx.hash });
  assert.equal(pending.value.status, 'outcome_unknown'); assert.equal(pending.value.hash, tx.hash);
  service.provider.getTransactionReceipt = original;
  const confirmed = await call(`/api/intents/${intent.id}/reconcile`, 'POST', {});
  assert.equal(confirmed.value.status, 'confirmed');
  assert.equal(store.intents().length, 1);
});
test('mined reverted owner transaction never becomes an approval', async () => {
  const [row] = await upload(); await review(row);
  const intent = await prepare('bills', { ids: [row.id] });
  await (await chain.vault.setVendor(id('V-HOST'), await chain.host.getAddress(), false)).wait();
  const { result } = await send(intent);
  assert.equal(result.value.status, 'reverted');
  assert.equal((await chain.vault.getBill(row.key)).amount, 0n);
});
test('wallet rejection/cancel leaves permission absent', async () => {
  const [row] = await upload(); await review(row);
  const intent = await prepare('bills', { ids: [row.id] });
  assert.equal((await call(`/api/intents/${intent.id}/cancel`, 'POST', {})).value.status, 'cancelled');
  assert.equal((await call(`/api/intents/${intent.id}/validate`, 'POST', {})).status, 409);
  assert.equal((await chain.vault.getBill(row.key)).amount, 0n);
});
test('vendor/rules/agent/pause/revoke actions have exact receipt evidence', async () => {
  const now = (await service.snapshot()).now;
  const cases = [
    ['limits', { maxPerBill: '240', dailyLimit: '390', reserve: '320' }],
    ['vendor', { reference: 'V-HOST', recipient: await chain.host.getAddress(), enabled: true }],
    ['agent', { agent: await chain.agent.getAddress(), notBefore: new Date(now * 1000).toISOString(), expiresAt: new Date((now + 3600) * 1000).toISOString() }],
    ['pause', { paused: false }], ['revoke', {}],
  ];
  for (const [action, body] of cases) {
    const intent = await prepare(action, body); const { result } = await send(intent);
    assert.equal(result.value.status, 'confirmed', action);
  }
  assert.equal(await chain.vault.maxPerBill(), parseUnits('240', 6));
  assert.equal(await chain.vault.agent(), '0x0000000000000000000000000000000000000000');
});
test('source removal deletes original text and drafts but retains opaque chain evidence', async () => {
  const [row] = await upload(); await review(row); await send(await prepare('bills', { ids: [row.id] }));
  const response = await call(`/api/documents/${row.document_id}`, 'DELETE', {}); assert.equal(response.status, 200);
  const after = await state(); assert.equal(after.drafts.length, 0);
  assert.equal(after.intents.length, 1); assert(!JSON.stringify(after).includes('HOST-1001'));
  assert((await chain.vault.getBill(row.key)).amount > 0n);
});
test('confirmed bill cancellation needs a fresh review before explicit replacement approval', async () => {
  const [row] = await upload(); await review(row); await send(await prepare('bills', { ids: [row.id] }));
  const cancel = await prepare('cancel', { key: row.key });
  const result = await send(cancel); assert.equal(result.result.value.status, 'confirmed');
  const cancelled = (await state()).drafts[0];
  assert.equal(cancelled.chainBill.cancelled, true);
  assert.equal(cancelled.status, 'draft');
  assert.equal((await call('/api/prepare', 'POST', { action: 'bills', ids: [row.id] })).status, 409);
  await review(cancelled); const replacement = await prepare('bills', { ids: [row.id] });
  assert.equal((await send(replacement)).result.value.status, 'confirmed');
  assert.equal((await chain.vault.getBill(row.key)).cancelled, false);
});
test('mainnet configuration and a mismatched RPC network disable the workflow', async () => {
  assert.throws(() => new OwnerService({ ...chain.config, chainId: 1 }, store, chain.vaultAbi, chain.tokenAbi), /Unsupported chain/);
  const wrong = new OwnerService({ ...chain.config, chainId: 11155111 }, store, chain.vaultAbi, chain.tokenAbi);
  try { await assert.rejects(wrong.snapshot(), /RPC chain changed/); }
  finally { wrong.close(); }
});
test('cross-origin and missing-CSRF requests cannot read or mutate app data', async () => {
  assert.equal((await call('/api/state', 'GET', null, { origin: 'https://hostile.example' })).status, 403);
  assert.equal((await call('/api/prepare', 'POST', { action: 'revoke' }, { origin: 'https://hostile.example' })).status, 403);
  assert.equal((await call('/api/prepare', 'POST', { action: 'revoke' }, { 'x-mandate-csrf': 'wrong' })).status, 403);
  assert.equal(store.intents().length, 0);
});
test('SQLite retains drafts over a backend store restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mandate-store-'));
  const path = join(directory, 'drafts.sqlite');
  try {
    const disk = new Store(path);
    disk.importDocument({ filename: 'original.csv', hash: '0xabc', sourceText: 'source text', records: [{ fields: { invoice_number: 'PERSIST-1' }, extractionWarnings: [] }] });
    disk.close();
    const reopened = new Store(path); assert.equal(reopened.drafts()[0].fields.invoice_number, 'PERSIST-1'); reopened.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('local setup supports a public owner address without importing its private key', async () => {
  const custom = await startLocalChain({ ownerAddress: '0x000000000000000000000000000000000000bEEF' });
  try {
    assert.equal((await custom.vault.owner()).toLowerCase(), '0x000000000000000000000000000000000000beef');
    assert.equal((await custom.vault.vendors(id('V-HOST'))).recipient, await custom.host.getAddress());
    // Impersonation was stopped after local setup. The actual owner must sign later actions.
    await assert.rejects(custom.owner.sendTransaction({ to: await custom.host.getAddress(), value: 0 }));
  } finally { await custom.close(); }
});
