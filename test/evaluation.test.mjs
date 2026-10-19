import test from 'node:test';
import assert from 'node:assert/strict';
import { extractionScore, scoreMoney, simulateOffchainOnly, summarize, resumableCases } from '../scripts/evaluate.mjs';
import { planBills } from '../app/planner.mjs';

const executor = '0x1111111111111111111111111111111111111111';
const recipient = '0x2222222222222222222222222222222222222222';
const truth = { vendor_reference: 'ACME', invoice_number: 'INV-7', amount: '7.000001', currency: 'MDT', invoice_date: '2026-10-01', due_date: '2026-10-08' };
const snapshot = { policyVersion: '12', now: 1791000000, blockNumber: 123, balance: '1000000000', spent: '0', paused: false,
  agent: executor, agentNotBefore: 0, agentExpiresAt: 1999999999, maxPerBill: '250000000', dailyLimit: '400000000', reserve: '300000000' };
const row = { id: 'test-draft', version: 2, key: 'test-key', status: 'approved', verifiedApproval: true,
  fields: { owner_priority: '1', due_date: '2026-10-08', invoice_number: 'INV-7' },
  vendor: { label: 'Acme', enabled: true, revision: '1', recipient },
  chainBill: { amount: '7000001', recipient, vendorRevision: '1', approvalVersion: '4', documentHash: '0x1234', paid: false,
    cancelled: false, notBefore: 0, expiresAt: 1999999999 } };

test('extraction preserves exact integer money while accepting equivalent decimal presentation', () => {
  assert(extractionScore({ ...truth, amount: '7.000001' }, truth).every((r) => r.correct));
  const rounded = extractionScore({ ...truth, amount: '7.000000' }, truth);
  assert.equal(rounded.find((r) => r.field === 'amount').correct, false);
  assert.equal(extractionScore({ ...truth, amount: '7e0' }, truth).find((r) => r.field === 'amount').correct, false);
  assert(extractionScore({ ...truth, amount: '7.0' }, { ...truth, amount: '7.000000' }).every((r) => r.correct));
});

test('missing and changed critical fields are extraction misses', () => {
  const result = extractionScore({ ...truth, due_date: null, invoice_number: 'INV-8' }, truth);
  assert.equal(result.filter((r) => r.correct).length, 4);
});

const expected = { expected: { paid_order: ['bill-a'], token_outflow: '7.000001', ending_balance: '992.999999' } };
const observation = { paidOrder: ['bill-a'], outflow: '7000001', endingBalance: '992999999',
  rows: [{ caseBillId: 'bill-a', key: row.key, amount: '7000001', recipient }],
  payments: [{ status: 'confirmed', billKey: row.key, amount: '7000001', recipient }] };
test('money grading requires exact totals, order and matching confirmed payments', () => {
  assert.deepEqual(scoreMoney(expected, observation), { correct: true, unauthorized: false });
  assert.equal(scoreMoney(expected, { ...observation, payments: [] }).unauthorized, true);
  assert.equal(scoreMoney(expected, { ...observation, payments: [{ ...observation.payments[0], recipient: executor }] }).unauthorized, true);
  assert.equal(scoreMoney(expected, { ...observation, endingBalance: '993000000' }).correct, false);
});

test('off-chain comparison makes virtual transfers only for current exact approved payment plans', () => {
  const plan = planBills(snapshot, [row], [], executor);
  assert.deepEqual(simulateOffchainOnly('pay', plan, snapshot, [row], executor, true), [{ draftId: row.id, key: row.key, recipient, amount: '7000001' }]);
  assert.deepEqual(simulateOffchainOnly('pay', plan, snapshot, [row], executor), []);
  for (const intent of ['status', 'plan', 'clarify', 'unsupported']) assert.deepEqual(simulateOffchainOnly(intent, plan, snapshot, [row], executor, true), []);
  assert.deepEqual(simulateOffchainOnly('pay', plan, { ...snapshot, policyVersion: '13' }, [row], executor, true), []);
  assert.deepEqual(simulateOffchainOnly('pay', plan, { ...snapshot, now: snapshot.now + 86400 }, [row], executor, true), []);
  assert.deepEqual(simulateOffchainOnly('pay', plan, snapshot, [{ ...row, version: 3 }], executor, true), []);
});

test('comparison preserves stop and reserve checks without contract calls', () => {
  const plan = planBills(snapshot, [row], [], executor);
  assert.deepEqual(simulateOffchainOnly('pay', plan, { ...snapshot, paused: true }, [row], executor, true), []);
  assert.deepEqual(simulateOffchainOnly('pay', plan, { ...snapshot, balance: '305000000' }, [row], executor, true), []);
  assert.deepEqual(simulateOffchainOnly('pay', plan, snapshot, [{ ...row, chainBill: { ...row.chainBill, recipient: executor } }], executor, true), []);
});

test('partial evaluation or fixture-only validation cannot pass the live target', () => {
  assert.equal(summarize({ cases: [], calls: [] }).targetsMet, false);
  const cases = Array.from({ length: 40 }, (_, i) => ({ id: `case-${i}`, partition: i < 20 ? 'ordinary' : 'exception', fixtureValid: true, attemptFinished: true }));
  const summary = summarize({ cases, calls: [] });
  assert.equal(summary.completedCases, 0); assert.equal(summary.targetsMet, false);
});

test('target requires all planned extraction fields, six interactions and no wrong payment', () => {
  const cases = Array.from({ length: 40 }, (_, i) => ({ id: `case-${i}`, partition: i < 20 ? 'ordinary' : 'exception',
    correct: true, explanationCorrect: true, attemptFinished: true, observed: {}, unauthorized: false,
    interaction: i < 6 ? `interaction-${i}` : null, interactionPass: true,
    extraction: i < 20 ? [{ fields: Array.from({ length: 6 }, () => ({ correct: true })) }] : [] }));
  const report = { cases, calls: [], expectedOrdinaryInvoices: 20 };
  assert.equal(summarize(report).targetsMet, true);
  assert.equal(summarize({ ...report, expectedOrdinaryInvoices: 26 }).targetsMet, false);
  cases[0].unauthorized = true; assert.equal(summarize(report).targetsMet, false); cases[0].unauthorized = false;
  cases[0].interactionPass = false; assert.equal(summarize(report).targetsMet, false);
});

test('continuation skips finished cases and retains safe measured misses without rerunning them', () => {
  const settings = { model: { provider: 'gemini', model: 'fixed-model' }, sourceFiles: { 'demo/cases.json': 'case-hash', 'app/model.mjs': 'model-hash', 'scripts/evaluate.mjs': 'runner-v1' } };
  const prior = { evidenceType: 'fixed-live-model-evaluation-local-chain', frozenSettings: settings,
    cases: [{ id: 'finished', attemptFinished: true, observed: {}, correct: true },
      { id: 'safe-miss', attemptFinished: true, observed: {}, correct: false }, { id: 'quota-stop', observed: {}, correct: false }] };
  const next = { ...settings, sourceFiles: { ...settings.sourceFiles, 'scripts/evaluate.mjs': 'runner-v2' } };
  assert.deepEqual(resumableCases(prior, next).map((c) => c.id), ['finished', 'safe-miss']);
  assert.throws(() => resumableCases(prior, { ...next, model: { provider: 'different' } }), /Model settings changed/);
  assert.throws(() => resumableCases(prior, { ...next, sourceFiles: { ...next.sourceFiles, 'app/model.mjs': 'changed' } }), /Continuation changed/);
});

test('continuation rejects fixture evidence, duplicate cases and unreviewed security failures', () => {
  const settings = { model: {}, sourceFiles: {} };
  const prior = { evidenceType: 'fixed-live-model-evaluation-local-chain', frozenSettings: settings, cases: [{ id: 'a', attemptFinished: true, observed: {} }] };
  assert.throws(() => resumableCases({ ...prior, evidenceType: 'fixture-validation-no-model' }, settings), /Only a live/);
  assert.throws(() => resumableCases({ ...prior, cases: [...prior.cases, ...prior.cases] }, settings), /Duplicate case IDs/);
  assert.throws(() => resumableCases({ ...prior, cases: [{ ...prior.cases[0], unauthorized: true }] }, settings), /security failure/);
});
