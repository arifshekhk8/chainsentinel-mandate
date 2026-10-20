import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../app/store.mjs';
import { startServer } from '../app/server.mjs';
import { CloudState, decryptState, durableProvider } from '../scripts/hosting/persistence.mjs';
import { startGateway } from '../scripts/hosting/gateway.mjs';
import { startLocalChain } from '../scripts/local-chain.mjs';
import { OwnerService } from '../app/service.mjs';
import { AgentService } from '../app/agent.mjs';
import { sampleRows } from '../app/samples.mjs';
import { id, parseUnits } from 'ethers';

const SECRET = 'synthetic-hosting-test-secret-only-0123456789';
const WORKSPACE = 'mandate-hosting-tests';
class MemoryRepository {
  record = null; lostAck = false; fail = false;
  async initialize() {}
  async read() { return this.record ? { ...this.record } : null; }
  async revision() { return this.record?.revision ?? 0; }
  async compareAndSet(workspace, expected, payload) {
    if (this.fail) throw new Error('Injected storage outage.');
    if ((this.record?.revision ?? 0) !== expected) return -1;
    this.record = { revision: expected + 1, payload };
    if (this.lostAck) throw new Error('Injected missing commit response.');
    return expected + 1;
  }
}
async function fixture(t, repository = new MemoryRepository()) {
  const directory = await mkdtemp(join(tmpdir(), 'mandate-hosting-test-'));
  const path = join(directory, 'state.sqlite');
  const state = new CloudState({ repository, secret: SECRET, workspace: WORKSPACE, path });
  await state.restore();
  const store = new Store(path);
  t.after(async () => { try { store.close(); } catch {} await rm(directory, { recursive: true, force: true }); });
  return { state, store, repository, path, directory };
}
async function apiFixture(t, { state = { healthy: true, async assertCurrent() {}, async persist() {} }, now } = {}) {
  const service = {
    store: { importDocument() {} },
    async state() { return { status: 'safe-test-state' }; },
  };
  const inner = await startServer(service, { port: 0 });
  const gateway = await startGateway({ upstream: inner.origin, publicOrigin: 'https://owner.example', password: SECRET,
    sessionSecret: SECRET, state, port: 0, host: '127.0.0.1', ...(now ? { now } : {}) });
  const url = `http://127.0.0.1:${gateway.server.address().port}`;
  t.after(async () => { await gateway.close(); await inner.close(); });
  // Node 25 fetch ignores a custom Host header; use HTTP directly to model Render TLS forwarding.
  const request = (path, opts = {}) => new Promise((resolve, reject) => {
    const req = httpRequest(url + path, { method: opts.method ?? 'GET', headers: { host: 'owner.example', ...opts.headers } }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve(new Response(Buffer.concat(chunks), {
        status: res.statusCode, headers: Object.fromEntries(Object.entries(res.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value])),
      })));
    });
    req.on('error', reject); if (opts.body) req.write(String(opts.body)); req.end();
  });
  const signin = async () => {
    const response = await request('/login', { method: 'POST', headers: { origin: 'https://owner.example', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password: SECRET }) });
    assert.equal(response.status, 303); return response.headers.get('set-cookie').split(';')[0];
  };
  return { request, signin, state, service };
}

test('encrypted cloud state restores bills, reviews and original pending hashes after loss of the local file', async (t) => {
  const f = await fixture(t);
  const document = f.store.importDocument({ filename: 'synthetic.csv', hash: id('source'), sourceText: 'Synthetic confidential source.', records: [{ fields: { invoice_number: 'SAMPLE-1', amount: '200' }, extractionWarnings: [] }] });
  const draft = f.store.drafts()[0]; f.store.reviewDraft(draft.id, { version: 1, checked: true });
  f.store.addPayment('test-instance', { draftId: draft.id }, id('original-pending-hash'));
  await f.state.persist();
  assert(!f.repository.record.payload.includes('Synthetic confidential source.'));
  assert.throws(() => decryptState(f.repository.record.payload, SECRET + 'wrong', WORKSPACE));
  assert.throws(() => decryptState(f.repository.record.payload, SECRET, 'different-workspace'));
  const restored = await fixture(t, f.repository);
  assert.equal(restored.store.drafts()[0].document_id, document);
  assert.equal(restored.store.drafts()[0].review.checked, true);
  assert.equal(restored.store.payments('test-instance')[0].hash, id('original-pending-hash'));
  assert.equal(restored.store.payments('test-instance')[0].status, 'submitting');
});
test('cloud compare-and-set rejects an overlapping stale process without replacing newer records', async (t) => {
  const first = await fixture(t); await first.state.persist();
  const second = await fixture(t, first.repository);
  first.store.addPlan('i', { note: 'newest' }); await first.state.persist();
  const saved = first.repository.record.payload;
  second.store.addPlan('i', { note: 'stale' });
  await assert.rejects(second.state.persist(), /Persistent storage/);
  assert.equal(second.state.healthy, false); assert.equal(first.repository.record.payload, saved);
});
test('a stale read-only process fails its revision check before serving the owner', async (t) => {
  const first = await fixture(t); await first.state.persist();
  const second = await fixture(t, first.repository);
  first.store.addPlan('i', {}); await first.state.persist();
  await assert.rejects(second.state.assertCurrent(), /Persistent storage/);
});
test('restart fencing stops the older hosted instance even when the restored database bytes are identical', async (t) => {
  const first = await fixture(t); await first.state.persist();
  const replacement = await fixture(t, first.repository);
  await replacement.state.persist({ force: true });
  await assert.rejects(first.state.assertCurrent());
  let sent = 0;
  const old = durableProvider({ async broadcastTransaction() { sent++; } }, first.state);
  first.store.addPayment('i', {}, id('old-instance-must-not-send'));
  await assert.rejects(old.broadcastTransaction('synthetic')); assert.equal(sent, 0);
});
test('storage failure prevents the first broadcast and leaves the process locked', async (t) => {
  const f = await fixture(t); await f.state.persist();
  f.store.addPayment('i', {}, id('never-broadcast'));
  f.repository.fail = true;
  let broadcasts = 0;
  const provider = durableProvider({ async broadcastTransaction() { broadcasts++; } }, f.state);
  await assert.rejects(provider.broadcastTransaction('synthetic'), /Persistent storage/);
  assert.equal(broadcasts, 0); assert.equal(f.state.healthy, false);
});
test('a lost storage acknowledgment never broadcasts and restart recovers the committed original hash', async (t) => {
  const f = await fixture(t); await f.state.persist();
  f.store.addPayment('i', {}, id('unknown-before-broadcast')); f.repository.lostAck = true;
  let broadcasts = 0;
  const p = durableProvider({ async broadcastTransaction() { broadcasts++; } }, f.state);
  await assert.rejects(p.broadcastTransaction('synthetic'));
  assert.equal(broadcasts, 0); f.repository.lostAck = false;
  const restored = await fixture(t, f.repository);
  assert.equal(restored.store.payments('i')[0].hash, id('unknown-before-broadcast'));
});
test('original owner hashes are durable before receipt RPC, and unchanged reads do not upload again', async (t) => {
  const f = await fixture(t); await f.state.persist();
  const intent = f.store.addIntent({ action: 'synthetic' }); f.store.setIntent(intent.id, 'submitted', id('owner-hash'));
  const p = durableProvider({ async getTransactionReceipt() {
    const restored = await fixture(t, f.repository);
    assert.equal(restored.store.intent(intent.id).hash, id('owner-hash'));
    return null;
  } }, f.state);
  await p.getTransactionReceipt(id('owner-hash'));
  const revision = f.repository.record.revision; await f.state.persist(); assert.equal(f.repository.record.revision, revision);
});
test('cloud restore rejects a wrong encryption key and never overwrites an existing local file', async (t) => {
  const f = await fixture(t); await f.state.persist();
  const bad = new CloudState({ repository: f.repository, secret: SECRET + 'wrong', workspace: WORKSPACE, path: join(f.directory, 'bad.sqlite') });
  await assert.rejects(bad.restore()); assert.equal(bad.healthy, false);
  const existing = new CloudState({ repository: f.repository, secret: SECRET, workspace: WORKSPACE, path: f.path });
  const before = readFileSync(f.path); await assert.rejects(existing.restore()); assert.deepEqual(readFileSync(f.path), before);
});
test('login and all app/API routes are protected; the health check exposes no workspace data', async (t) => {
  const a = await apiFixture(t);
  for (const path of ['/api/state', '/api/sample.csv', '/api/agent/request']) assert.equal((await a.request(path)).status, 401);
  assert.equal((await a.request('/')).status, 303); assert.equal((await a.request('/app.js')).status, 303);
  assert.equal((await a.request('/login')).status, 200);
  const health = await a.request('/healthz'); assert.equal(await health.text(), 'ready');
  assert.equal((await a.request('/api/state', { headers: { host: 'attacker.example' } })).status, 403);
  const cookie = await a.signin();
  const response = await a.request('/api/state', { headers: { cookie } }); assert.equal(response.status, 200);
  const state = await response.json(); assert.equal(state.status, 'safe-test-state'); assert.match(state.csrf, /^[a-f0-9]{64}$/);
});
test('authenticated writes still need both the public origin and the original application CSRF token', async (t) => {
  const a = await apiFixture(t); const cookie = await a.signin();
  for (const origin of [undefined, 'https://attacker.example']) {
    const response = await a.request('/api/prepare', { method: 'POST', headers: { cookie, ...(origin ? { origin } : {}) } });
    assert.equal(response.status, 403);
  }
  const response = await a.request('/api/prepare', { method: 'POST', headers: { cookie, origin: 'https://owner.example' } });
  assert.equal(response.status, 403); assert.match(await response.text(), /Refresh the page/);
});
test('sessions use secure cookies, expire, reject tampering, and sign out invalidates the token', async (t) => {
  let clock = 1760940000000;
  const a = await apiFixture(t, { now: () => clock });
  const login = await a.request('/login', { method: 'POST', headers: { origin: 'https://owner.example', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password: SECRET }) });
  const header = login.headers.get('set-cookie');
  assert.match(header, /HttpOnly/); assert.match(header, /Secure/); assert.match(header, /SameSite=Strict/);
  const cookie = header.split(';')[0];
  assert.equal((await a.request('/api/state', { headers: { cookie: cookie.slice(0, -1) + 'x' } })).status, 401);
  clock += 9 * 3600000;
  assert.equal((await a.request('/api/state', { headers: { cookie } })).status, 401);
  const fresh = await a.signin();
  assert.equal((await a.request('/logout', { method: 'POST', headers: { cookie: fresh, origin: 'https://owner.example' } })).status, 303);
  assert.equal((await a.request('/api/state', { headers: { cookie: fresh } })).status, 401);
});
test('wrong passwords cannot reach the app, and repeated failures receive rate-limit responses', async (t) => {
  const a = await apiFixture(t);
  for (let i = 0; i < 21; i++) {
    const response = await a.request('/login', { method: 'POST', headers: { origin: 'https://owner.example', 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=wrong' });
    assert.equal(response.status, i === 20 ? 429 : 401); assert.equal(response.headers.get('set-cookie'), null);
  }
});
test('a failed durability check blocks the app response and further work', async (t) => {
  const state = { healthy: true, async assertCurrent() {}, async persist() { throw new Error('Injected commit failure.'); } };
  const a = await apiFixture(t, { state }); const cookie = await a.signin();
  assert.equal((await a.request('/api/state', { headers: { cookie } })).status, 503);
  assert.equal(state.healthy, false); assert.equal((await a.request('/healthz')).status, 503);
});
test('the existing local executor pays exact bills through the durable provider and restored receipts prevent replay', { timeout: 60000 }, async (t) => {
  const chain = await startLocalChain(); t.after(() => chain.close());
  const f = await fixture(t);
  const provider = durableProvider(chain.provider, f.state);
  const service = new OwnerService(chain.config, f.store, chain.vaultAbi, chain.tokenAbi, provider);
  // The chain owns this provider's lifecycle; avoid closing it before assertions/cleanup.
  const agent = new AgentService(service, { mode: 'model-unconfigured' }, chain.agent.connect(provider)); service.agent = agent;
  const rows = sampleRows(await service.snapshot());
  f.store.importDocument({ filename: 'hosting.csv', hash: id('hosting-source'), sourceText: 'Synthetic hosting integration.', records: rows.map((fields) => ({ fields, extractionWarnings: [] })) });
  const drafts = await service.assessAll();
  for (const row of drafts) await service.reviewDraft(row.id, { version: row.version, checked: true });
  const approval = await service.prepare('bills', { ids: drafts.map((r) => r.id) });
  await f.state.persist();
  const ownerTx = await chain.owner.sendTransaction({ to: approval.payload.to, data: approval.payload.data });
  assert.equal((await service.submitted(approval.id, ownerTx.hash)).status, 'confirmed');
  await (await chain.vault.setPaused(false)).wait();
  const plan = await agent.preview();
  const result = await agent.execute(plan.id, { confirmed: true }); await f.state.persist();
  assert.equal(result.status, 'completed'); assert.equal(result.payments.length, 2);
  assert.equal(await chain.token.balanceOf(chain.config.vaultAddress), parseUnits('650', 6));
  const restored = await fixture(t, f.repository);
  assert.equal(restored.store.payments(chain.config.instanceId).filter((r) => r.status === 'confirmed').length, 2);
  assert.equal(restored.store.plans(chain.config.instanceId).find((r) => r.id === plan.id).status, 'completed');
  await assert.rejects(agent.execute(plan.id, { confirmed: true }), /used|active|reconciliation/);
  assert.equal(await chain.token.balanceOf(chain.config.vaultAddress), parseUnits('650', 6));
});
