import assert from 'node:assert/strict';
import { before, beforeEach, afterEach, after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Contract, Interface, JsonRpcProvider, id, parseUnits } from 'ethers';
import { startLocalChain } from '../scripts/local-chain.mjs';
import { initializeSetup, loadSetup, readArtifacts } from '../scripts/sepolia-config.mjs';
import { SetupService, SETUP_STEPS } from '../app/setup.mjs';
import { Store } from '../app/store.mjs';
import { OwnerService } from '../app/service.mjs';
import { AgentService } from '../app/agent.mjs';
import { OpenAIModel } from '../app/model.mjs';
import { Executor } from '../app/executor.mjs';
import { sampleRows } from '../app/samples.mjs';
import { AGENT_FUNDING, DEMO_BUDGET, SEPOLIA, feeReview, reservedBudget } from '../app/sepolia-policy.mjs';

let chain, checkpoint, provider, store, setup, seed;
before(async () => { chain = await startLocalChain(); checkpoint = await chain.provider.send('evm_snapshot', []); });
beforeEach(async () => {
  await chain.provider.send('evm_revert', [checkpoint]); checkpoint = await chain.provider.send('evm_snapshot', []);
  await chain.provider.send('anvil_setNextBlockBaseFeePerGas', ['0x0']); await chain.provider.send('evm_mine', []);
  provider = new JsonRpcProvider(chain.config.rpcUrl, undefined, { cacheTimeout: -1, batchMaxCount: 1 }); provider.pollingInterval = 50;
  // Local rehearsal only: fixed low EIP-1559 quote on the zero-base-fee disposable chain.
  provider.getFeeData = async () => ({ maxFeePerGas: 10000000n, maxPriorityFeePerGas: 1n });
  store = new Store(); seed = { instanceId: 'independent-local-sepolia-preparation', ownerAddress: chain.config.ownerAddress,
    agentAddress: await chain.agent.getAddress(), vendors: { 'V-HOST': await chain.host.getAddress(), 'V-DESIGN': await chain.design.getAddress() } };
  setup = new SetupService({ seed, store, provider, artifacts: readArtifacts(), allowWalletRequests: true, expectedChainId: 31337, confirmations: 1 });
});
afterEach(() => { provider.destroy(); store.close(); });
after(async () => { await chain.close(); });
async function send(action, confirm = true) {
  const row = await setup.prepare(action), p = row.payload;
  await setup.validateIntent(row.id);
  const tx = await chain.owner.sendTransaction({ ...(p.to ? { to: p.to } : {}), data: p.data, value: BigInt(p.value),
    gasLimit: BigInt(p.fees.gasLimit), maxFeePerGas: BigInt(p.fees.maxFeePerGas), maxPriorityFeePerGas: BigInt(p.fees.maxPriorityFeePerGas) });
  await tx.wait(); const result = await setup.submitted(row.id, tx.hash);
  if (confirm) assert.equal(result.status, 'confirmed', result.error);
  return result;
}
test('public setup rejects wrong networks before preparing or enabling wallet actions', async () => {
  const publicSetup = new SetupService({ seed, store, provider, artifacts: readArtifacts() });
  await assert.rejects(publicSetup.prepare('token'), /wrong network/);
  assert.equal(store.intents().length, 0);
  assert.throws(() => new SetupService({ seed, store, provider, artifacts: readArtifacts(), confirmations: 1 }), /two confirmations/);
});
test('review-only mode cannot open the wallet and steps cannot be reordered', async () => {
  setup.allowWalletRequests = false;
  await assert.rejects(setup.prepare('vault'), /earlier setup/);
  await assert.rejects(setup.prepare('withdraw'), /Unsupported/);
  const row = await setup.prepare('token');
  await assert.rejects(setup.validateIntent(row.id), /review-only/);
  assert.equal(setup.intent(row.id).status, 'prepared'); assert.equal(setup.address('token'), null);
  const realNetwork = provider.getNetwork.bind(provider);
  provider.getNetwork = async () => ({ chainId: 11155111n });
  const publicSetup = new SetupService({ seed, store, provider, artifacts: readArtifacts() });
  assert.equal((await publicSetup.state()).setup.publicTestnetEvidence, false);
  provider.getNetwork = realNetwork;
});
test('fee ceiling and total reserved owner outflow stop preparation without sending', async () => {
  provider.getFeeData = async () => ({ maxFeePerGas: 1000000000n, maxPriorityFeePerGas: 1n });
  await assert.rejects(setup.prepare('token'), /fee.*cap/i); assert.equal(store.intents().length, 0);
  provider.getFeeData = async () => ({ maxFeePerGas: 10000000n, maxPriorityFeePerGas: 1n });
  const estimate = provider.estimateGas.bind(provider); provider.estimateGas = async () => 20000000n;
  await assert.rejects(setup.prepare('token'), /gas estimate exceeds/); assert.equal(store.intents().length, 0);
  provider.estimateGas = estimate;
  store.addIntent({ instanceId: 'other-reviewed-action', owner: seed.ownerAddress, chainId: 31337,
    fees: { maximumOutflowWei: DEMO_BUDGET.toString() } });
  await assert.rejects(setup.prepare('token'), /total 0.001/); assert.equal(store.intents().length, 1);
});
test('parallel setup preparation creates only one durable review', async () => {
  const result = await Promise.allSettled([setup.prepare('token'), setup.prepare('token')]);
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1); assert.equal(store.intents().length, 1);
});
test('lost wallet responses remain locked across restart and allow original-hash recovery only', async () => {
  const row = await setup.prepare('token'); await setup.validateIntent(row.id);
  const restarted = new SetupService({ seed, store, provider, artifacts: readArtifacts(), allowWalletRequests: true, expectedChainId: 31337, confirmations: 1 });
  await assert.rejects(restarted.prepare('token'), /already active/);
  await assert.rejects(restarted.validateIntent(row.id), /already opened/);
  assert.throws(() => restarted.cancelIntent(row.id), /original hash/);
  assert.equal(restarted.intent(row.id).status, 'wallet_requested');
  restarted.cancelIntent(row.id, { walletRejected: true }); assert.equal(restarted.intent(row.id).status, 'cancelled');
});
test('an unrelated mined transaction cannot become deployment evidence', async () => {
  const row = await setup.prepare('token'); await setup.validateIntent(row.id);
  const tx = await chain.owner.sendTransaction({ to: seed.ownerAddress, value: 0n }); await tx.wait();
  const result = await setup.submitted(row.id, tx.hash);
  assert.equal(result.status, 'invalid'); assert.equal(setup.address('token'), null);
  await assert.rejects(setup.prepare('token'), /already active/);
});
test('setup waits for the configured confirmations and rechecks the same hash without resending', async () => {
  setup.confirmations = 2; const first = await send('token', false);
  assert.equal(first.status, 'submitted'); assert.equal(setup.address('token'), null);
  await chain.provider.send('evm_mine', []);
  const final = await setup.reconcile(first.id); assert.equal(final.status, 'confirmed'); assert.equal(final.hash, first.hash);
  await assert.rejects(setup.prepare('token'), /already confirmed/);
});
test('a durable public setup uses a separate protected agent key and preserves existing files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mandate-private-test-'));
  try {
    const a = initializeSetup(seed.ownerAddress, directory), b = loadSetup(directory);
    assert.equal(a.agent.address, b.agent.address); assert.notEqual(a.agent.address, seed.ownerAddress);
    for (const file of ['setup.json', 'agent-key.json']) assert.equal(statSync(join(directory, file)).mode & 0o777, 0o600);
    assert(!readFileSync(join(directory, 'setup.json'), 'utf8').includes(a.agent.privateKey));
    assert.throws(() => initializeSetup(seed.vendors['V-HOST'], directory), /different owner/);
    assert.equal(initializeSetup(seed.ownerAddress, directory).agent.address, a.agent.address);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('full local deployment rehearsal funds the paused vault, then explicit approvals permit one exact batch', async () => {
  const receipts = [];
  for (const [action] of SETUP_STEPS) receipts.push(await send(action));
  const state = (await setup.state()).setup; assert.equal(state.ready, true); assert.equal(state.publicTestnetEvidence, false);
  const setupBudget = reservedBudget(store, seed.ownerAddress, 31337); assert(setupBudget <= DEMO_BUDGET);
  assert.equal(receipts.at(-1).payload.value, AGENT_FUNDING.toString());
  const config = await setup.configuration(chain.config.rpcUrl), artifacts = readArtifacts();
  const service = new OwnerService(config, store, artifacts.vault.abi, artifacts.token.abi);
  try {
    const snapshot = await service.snapshot(); assert.equal(snapshot.paused, true); assert.equal(snapshot.balance, parseUnits('1000', 6).toString());
    const fields = sampleRows(snapshot);
    store.importDocument({ filename: 'independent-local-rehearsal.csv', hash: id('synthetic-independent-local-rehearsal'), sourceText: 'Synthetic development only.',
      records: fields.map((fields) => ({ fields, extractionWarnings: [] })) });
    const rows = await service.assessAll(); for (const r of rows) await service.reviewDraft(r.id, { version: r.version, checked: true });
    for (const [action, body] of [['bills', { ids: rows.map((r) => r.id) }], ['pause', { paused: false }]]) {
      const p = await service.prepare(action, body), tx = await chain.owner.sendTransaction({ to: p.payload.to, data: p.payload.data }); await tx.wait();
      assert.equal((await service.submitted(p.id, tx.hash)).status, 'confirmed');
    }
    const agent = service.agent = new AgentService(service, new OpenAIModel({ apiKey: '', model: '' }), chain.agent);
    const plan = await agent.preview(); await assert.rejects(agent.execute(plan.id, { confirmed: false }), /confirm/);
    assert.equal((await agent.execute(plan.id, { confirmed: true })).status, 'completed');
    assert.equal((await service.snapshot()).balance, parseUnits('650', 6).toString());
    assert.equal(agent.executor.payments().filter((p) => p.status === 'confirmed').length, 2);
    await assert.rejects(agent.execute(plan.id, { confirmed: true }), /used|active|reconciliation/);
    const vault = new Contract(config.vaultAddress, artifacts.vault.abi, chain.owner);
    await (await vault.revokeAgent()).wait();
    const next = await agent.preview(); assert(next.payload.plan.entries.every((e) => e.code !== 'ready'));
    writeFileSync('evidence/step5-sepolia-preparation-local.json', JSON.stringify({
      evidenceType: 'local-sepolia-workflow-rehearsal', publicTestnetEvidence: false, chainId: 31337,
      walletType: 'Disposable local RPC signer; no actual wallet extension', liveModelUsed: false,
      recordedAt: new Date().toISOString(), setupSteps: receipts.map((r) => ({ action: r.payload.setupAction, hash: r.hash, receipt: r.receipt })),
      reviewedSetupBudgetMaximumWei: setupBudget.toString(),
      paymentReceipts: agent.executor.payments().map((p) => p.receipt), endingBalance: '650000000',
      replayRejected: true, revokedAgentHasNoEligiblePayments: true,
    }, null, 2) + '\n');
  } finally { service.close(); }
});

test('public owner approval waits for two confirmations and rejects a fee outside the review', async () => {
  const iface = new Interface(readArtifacts().vault.abi), hash = id('independent-public-confirmation-mock');
  let count = 1, excessFee = false;
  const data = iface.encodeFunctionData('setPaused', [true]);
  const event = iface.encodeEventLog(iface.getEvent('PauseSet'), [true]);
  const tx = { chainId: BigInt(SEPOLIA), from: seed.ownerAddress, to: chain.config.vaultAddress,
    data, value: 0n, gasLimit: 50000n, get maxFeePerGas() { return excessFee ? 101n : 100n; }, maxPriorityFeePerGas: 1n };
  const receipt = { hash, blockNumber: 10, blockHash: id('mock-block'), status: 1, gasUsed: 30000n,
    confirmations: async () => count, logs: [{ address: chain.config.vaultAddress, ...event }] };
  const rpc = { pollingInterval: 0, getTransaction: async () => tx, getTransactionReceipt: async () => receipt, destroy() {} };
  const config = { ...chain.config, chainId: SEPOLIA, instanceId: 'independent-public-owner-mock' };
  const service = new OwnerService(config, store, readArtifacts().vault.abi, readArtifacts().token.abi, rpc);
  service.snapshot = async () => ({});
  const fields = { instanceId: config.instanceId, owner: seed.ownerAddress, to: config.vaultAddress, data,
    expectedEvents: [{ name: 'PauseSet', values: { paused: true } }], fees: { gasLimit: '50000', maxFeePerGas: '100', maxPriorityFeePerGas: '1' } };
  const row = store.addIntent(fields);
  assert.equal((await service.submitted(row.id, hash)).status, 'submitted');
  count = 2; assert.equal((await service.reconcile(row.id)).status, 'confirmed');
  const second = store.addIntent(fields); excessFee = true;
  assert.equal((await service.submitted(second.id, id('other-public-mock'))).status, 'invalid');
  service.close();
});

test('public agent reconciliation does not mark a one-confirmation receipt paid', async () => {
  const iface = new Interface(readArtifacts().vault.abi), hash = id('independent-public-agent-mock'), billKey = id('synthetic-approved-bill');
  const recipient = seed.vendors['V-HOST'], amount = '50000000', token = chain.config.tokenAddress;
  const data = iface.encodeFunctionData('payBill', [billKey, '2']); let count = 1;
  const p = { agent: seed.agentAddress, nonce: 0, data, billKey, recipient, token, amount, policyVersion: '2', utcDay: '1' };
  const event = iface.encodeEventLog(iface.getEvent('BillPaid'), [billKey, recipient, token, amount, '2', '1', amount]);
  const service = { store, confirmationsRequired: 2, config: { chainId: SEPOLIA, instanceId: 'independent-public-payment-mock', vaultAddress: chain.config.vaultAddress },
    snapshot: async () => ({}), provider: { getTransaction: async () => ({ chainId: BigInt(SEPOLIA), from: p.agent, to: chain.config.vaultAddress, value: 0n, data, nonce: 0 }),
      getTransactionReceipt: async () => ({ hash, blockNumber: 10, blockHash: id('mock-payment-block'), status: 1, gasUsed: 100000n,
        confirmations: async () => count, logs: [{ address: chain.config.vaultAddress, ...event }] }) },
    vault: { interface: iface, getBill: async () => ({ paid: true, recipient, amount }) } };
  const paymentId = store.addPayment(service.config.instanceId, p, hash), executor = new Executor(service, null);
  assert.equal((await executor.reconcile(paymentId)).status, 'submitted');
  assert.equal(executor.payment(paymentId).receipt, null);
  count = 2; const done = await executor.reconcile(paymentId); assert.equal(done.status, 'confirmed'); assert.equal(done.receipt.payment.amount, amount);
});
