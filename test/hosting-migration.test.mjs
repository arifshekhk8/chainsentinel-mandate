import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../app/store.mjs';
import { migrateInitialWorkspace } from '../scripts/hosting/migration.mjs';
import { decryptState } from '../scripts/hosting/persistence.mjs';

test('initial cloud migration preserves a live SQLite source, reviews and pending hashes and refuses an overwrite', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'mandate-migration-test-'));
  const source = join(directory, 'source.sqlite');
  const destination = join(directory, 'snapshot.sqlite');
  const store = new Store(source);
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });
  store.importDocument({ filename: 'synthetic.csv', hash: 'synthetic-hash', sourceText: 'Private synthetic source.',
    records: [{ fields: { invoice_number: 'MIGRATION-1', amount: '200' }, extractionWarnings: [] }] });
  const draft = store.drafts()[0]; store.reviewDraft(draft.id, { version: 1, checked: true });
  store.addPayment('synthetic-instance', { draftId: draft.id }, 'original-pending-hash');
  const before = readFileSync(source);
  let record = null;
  const repository = { async initialize() {}, async read() { return record; },
    async compareAndSet(workspace, expected, payload) { assert.equal(expected, 0); record = { revision: 1, payload }; return 1; } };
  const secret = 'synthetic-migration-test-secret-0123456789';
  const workspace = 'mandate-migration-test';
  const result = await migrateInitialWorkspace({ source, destination, repository, secret, workspace });
  assert(readFileSync(source).equals(before));
  assert.equal(result.counts.drafts, 1); assert.equal(result.counts.payments, 1);
  assert(!record.payload.includes('Private synthetic source.'));
  assert(decryptState(record.payload, secret, workspace).equals(readFileSync(destination)));
  const restored = new Store(destination);
  try { assert.equal(restored.drafts()[0].review.checked, true); assert.equal(restored.payments('synthetic-instance')[0].hash, 'original-pending-hash'); }
  finally { restored.close(); }
  await assert.rejects(migrateInitialWorkspace({ source, destination: join(directory, 'never-written.sqlite'), repository, secret, workspace }), /already exists/);
});
