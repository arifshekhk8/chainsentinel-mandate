import { Contract, ContractFactory, ZeroAddress, formatEther, getCreateAddress, id, keccak256, parseUnits } from 'ethers';
import { AppError, check } from './errors.mjs';
import { AGENT_FUNDING, DEMO_BUDGET, SEPOLIA, REQUIRED_CONFIRMATIONS, addBudgetedIntent, feeReview, matchesFeeReview, reservedBudget } from './sepolia-policy.mjs';

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const hex = /^0x[0-9a-f]{64}$/i;
export const SETUP_STEPS = [
  ['token', 'Deploy 1,000 MDT test tokens'], ['vault', 'Deploy the owner-controlled vault'],
  ['deposit', 'Fund the vault with 1,000 MDT'], ['host', 'Set Hostline’s test recipient'],
  ['design', 'Set Artline’s test recipient'], ['agent', 'Grant the separate agent 24-hour access'],
  ['gas', 'Fund the agent with 0.00005 Sepolia ETH'],
];
export class SetupService {
  constructor({ seed, store, provider, artifacts, allowWalletRequests = false,
    expectedChainId = SEPOLIA, confirmations = REQUIRED_CONFIRMATIONS }) {
    check([31337, SEPOLIA].includes(expectedChainId), 'Only local rehearsal or Sepolia setup is supported.');
    check(expectedChainId !== SEPOLIA || confirmations >= REQUIRED_CONFIRMATIONS, 'Sepolia requires two confirmations.');
    Object.assign(this, { seed, store, provider, artifacts, allowWalletRequests, expectedChainId, confirmations });
    this.setupOnly = true; this.busy = false;
  }
  intents() { return this.store.intents().filter((r) => r.payload.instanceId === this.seed.instanceId); }
  confirmed(action) { return this.intents().find((r) => r.payload.setupAction === action && r.status === 'confirmed'); }
  address(action) { return this.confirmed(action)?.receipt?.contractAddress ?? null; }
  async network() {
    check(Number((await this.provider.getNetwork()).chainId) === this.expectedChainId,
      'The RPC is on the wrong network. Wallet requests are disabled.', 503);
    return this.provider.getBlock('latest');
  }
  async state() {
    const block = await this.network();
    const [ownerBalance, agentBalance] = await Promise.all([
      this.provider.getBalance(this.seed.ownerAddress), this.provider.getBalance(this.seed.agentAddress),
    ]);
    return { mode: 'deployment-review', setup: { chainId: this.expectedChainId,
      network: this.expectedChainId === SEPOLIA ? 'Sepolia testnet' : 'Local deployment rehearsal',
      publicTestnetEvidence: this.expectedChainId === SEPOLIA && SETUP_STEPS.every(([action]) => this.confirmed(action)), owner: this.seed.ownerAddress,
      agent: this.seed.agentAddress, vendors: this.seed.vendors, ownerBalanceETH: formatEther(ownerBalance),
      agentBalanceETH: formatEther(agentBalance), allowWalletRequests: this.allowWalletRequests,
      totalBudgetETH: formatEther(DEMO_BUDGET), reservedMaximumETH: formatEther(reservedBudget(this.store, this.seed.ownerAddress, this.expectedChainId)),
      feeCapGwei: '0.05', confirmations: this.confirmations, block: block.number,
      token: this.address('token'), vault: this.address('vault'),
      steps: SETUP_STEPS.map(([action, title]) => ({ action, title, confirmed: Boolean(this.confirmed(action)) })),
      intents: this.intents(), ready: SETUP_STEPS.every(([action]) => this.confirmed(action)) } };
  }
  async prepare(action) {
    check(!this.busy, 'Another setup review is active.', 409); this.busy = true;
    try {
      const index = SETUP_STEPS.findIndex(([key]) => key === action);
      check(index >= 0, 'Unsupported deployment action.');
      check(SETUP_STEPS.slice(0, index).every(([key]) => this.confirmed(key)), 'Confirm the earlier setup steps first.', 409);
      check(!this.confirmed(action), 'This step is already confirmed. Do not send it again.', 409);
      check(!this.intents().some((r) => !['confirmed', 'cancelled', 'reverted'].includes(r.status)),
        'A setup action is already active. Reconcile or cancel that review first.', 409);
      const block = await this.network(), owner = this.seed.ownerAddress;
      const tokenAddress = this.address('token'), vaultAddress = this.address('vault');
      const token = tokenAddress ? new Contract(tokenAddress, this.artifacts.token.abi, this.provider) : null;
      const vault = vaultAddress ? new Contract(vaultAddress, this.artifacts.vault.abi, this.provider) : null;
      let to = null, data, value = '0', args = [], method, expectedEvents = [];
      if (action === 'token') {
        args = [owner, parseUnits('1000', 6).toString()]; method = 'deployToken';
        data = (await new ContractFactory(this.artifacts.token.abi, this.artifacts.token.bytecode.object).getDeployTransaction(...args)).data;
      } else if (action === 'vault') {
        args = [owner, tokenAddress, ...['250', '400', '300'].map((v) => parseUnits(v, 6).toString())]; method = 'deployVault';
        data = (await new ContractFactory(this.artifacts.vault.abi, this.artifacts.vault.bytecode.object).getDeployTransaction(...args)).data;
      } else if (action === 'deposit') {
        method = 'transfer'; to = tokenAddress; args = [vaultAddress, parseUnits('1000', 6).toString()];
        data = token.interface.encodeFunctionData(method, args);
        expectedEvents = [{ emitter: tokenAddress, name: 'Transfer', values: { from: owner, to: vaultAddress, value: args[1] } }];
      } else if (action === 'host' || action === 'design') {
        const reference = action === 'host' ? 'V-HOST' : 'V-DESIGN';
        method = 'setVendor'; to = vaultAddress; args = [id(reference), this.seed.vendors[reference], true];
        data = vault.interface.encodeFunctionData(method, args);
        expectedEvents = [{ emitter: to, name: 'VendorSet', values: { vendorId: args[0], recipient: args[1], enabled: true } }];
      } else if (action === 'agent') {
        method = 'setAgent'; to = vaultAddress; args = [this.seed.agentAddress, String(block.timestamp - 60), String(block.timestamp + 86400)];
        data = vault.interface.encodeFunctionData(method, args);
        expectedEvents = [{ emitter: to, name: 'AgentSet', values: { agent: args[0], notBefore: args[1], expiresAt: args[2] } }];
      } else {
        method = 'fundAgentGas'; to = this.seed.agentAddress; data = '0x'; value = AGENT_FUNDING.toString();
      }
      const request = { from: owner, ...(to ? { to } : {}), data, value: BigInt(value) };
      let fees;
      try { fees = await feeReview(this.provider, request); }
      catch (error) { if (error instanceof AppError) throw error; throw new AppError('The RPC could not simulate or price this setup action. Nothing was sent.', 503); }
      return addBudgetedIntent(this.store, { instanceId: this.seed.instanceId, setupAction: action,
        title: SETUP_STEPS[index][1], method, args, expectedEvents, drafts: [], chainId: this.expectedChainId,
        owner, to, data, dataHash: keccak256(data), value, fees, createdAt: new Date().toISOString() });
    } finally { this.busy = false; }
  }
  intent(id) {
    const row = this.intents().find((r) => r.id === id); check(row, 'Setup review not found.', 404); return row;
  }
  async validateIntent(id) {
    check(this.allowWalletRequests, 'This is review-only mode. Public wallet transactions have not been enabled.', 409);
    const row = this.intent(id), p = row.payload;
    check(row.status === 'prepared' && !row.hash, 'This wallet request was already opened. Inspect its original transaction; do not resend.', 409);
    const block = await this.network();
    check(block.baseFeePerGas === null || block.baseFeePerGas + BigInt(p.fees.maxPriorityFeePerGas) <= BigInt(p.fees.maxFeePerGas),
      'The reviewed fee is now too low. Cancel this unsent review and prepare a fresh one.', 409);
    const estimate = await this.provider.estimateGas({ from: p.owner, ...(p.to ? { to: p.to } : {}), data: p.data, value: BigInt(p.value) });
    check(estimate <= BigInt(p.fees.gasLimit), 'The gas estimate changed. Prepare a fresh review.', 409);
    this.store.db.exec('BEGIN IMMEDIATE');
    try {
      check(this.intent(id).status === 'prepared', 'This wallet review is already active.', 409);
      const result = this.store.setIntent(id, 'wallet_requested', null);
      this.store.db.exec('COMMIT'); return result;
    } catch (error) { this.store.db.exec('ROLLBACK'); throw error; }
  }
  cancelIntent(id, body = {}) {
    const row = this.intent(id);
    check(!row.hash && (row.status === 'prepared' || row.status === 'wallet_requested' && body.walletRejected === true),
      'An opened wallet request needs its original hash unless the wallet explicitly rejected it.', 409);
    return this.store.setIntent(id, 'cancelled', null);
  }
  async submitted(id, hash) {
    const row = this.intent(id); check(hex.test(hash ?? ''), 'Enter the original transaction hash.');
    check(['wallet_requested', 'submitted', 'outcome_unknown', 'confirmed', 'reverted'].includes(row.status), 'Open the reviewed wallet request first.', 409);
    check(!row.hash || same(row.hash, hash), 'A different hash is already recorded. Do not replace it.', 409);
    check(!this.store.intents().some((r) => r.id !== id && same(r.hash, hash)), 'That hash belongs to another review.', 409);
    if (['confirmed', 'reverted'].includes(row.status)) return row;
    this.store.setIntent(id, 'submitted', hash); return this.reconcile(id);
  }
  async reconcile(id) {
    const row = this.intent(id), p = row.payload; check(row.hash, 'Check your wallet history and enter the original hash; do not resend.');
    if (['confirmed', 'reverted', 'invalid'].includes(row.status)) return row;
    try {
      await this.network();
      const [tx, receipt] = await Promise.all([this.provider.getTransaction(row.hash), this.provider.getTransactionReceipt(row.hash)]);
      if (!tx || !receipt) return this.store.setIntent(id, 'submitted', row.hash, null, 'Waiting for the original transaction receipt.');
      check(Number(tx.chainId) === this.expectedChainId && same(tx.from, p.owner) && same(tx.to, p.to)
        && same(tx.data, p.data) && tx.value === BigInt(p.value) && matchesFeeReview(tx, p.fees),
      'This transaction does not match the exact deployment review or fee cap. Stop and inspect it.');
      const count = await receipt.confirmations();
      if (count < this.confirmations) return this.store.setIntent(id, 'submitted', row.hash, null, `Waiting for ${this.confirmations} confirmations; currently ${count}.`);
      const proof = { hash: receipt.hash, chainId: this.expectedChainId, blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash, status: receipt.status, gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice.toString(), confirmations: count, contractAddress: receipt.contractAddress };
      if (receipt.status !== 1) return this.store.setIntent(id, 'reverted', row.hash, proof, 'The transaction reverted. Review before creating a new attempt.');
      if (p.setupAction === 'token' || p.setupAction === 'vault') {
        check(same(receipt.contractAddress, getCreateAddress({ from: p.owner, nonce: tx.nonce })), 'The deployment address does not match the transaction.');
        const code = await this.provider.getCode(receipt.contractAddress); check(code !== '0x', 'No deployed code was found.'); proof.codeHash = keccak256(code);
        const artifact = p.setupAction === 'token' ? this.artifacts.token : this.artifacts.vault;
        const contract = new Contract(receipt.contractAddress, artifact.abi, this.provider);
        if (p.setupAction === 'token') check(await contract.decimals() === 6n && await contract.totalSupply() === parseUnits('1000', 6)
          && await contract.name() === 'Mandate Demo Token' && await contract.symbol() === 'MDT', 'The deployed test token is unexpected.');
        else check(same(await contract.owner(), p.owner) && same(await contract.token(), this.address('token'))
          && Number(await contract.deploymentChainId()) === this.expectedChainId && await contract.paused()
          && await contract.maxPerBill() === parseUnits('250', 6) && await contract.dailyLimit() === parseUnits('400', 6)
          && await contract.minReserve() === parseUnits('300', 6), 'The deployed vault has unexpected settings.');
      }
      for (const event of p.expectedEvents) {
        const iface = same(event.emitter, this.address('token')) ? this.artifacts.token.abi : this.artifacts.vault.abi;
        const contract = new Contract(event.emitter, iface, this.provider);
        const decoded = receipt.logs.filter((l) => same(l.address, event.emitter)).map((l) => contract.interface.parseLog(l));
        check(decoded.some((e) => e?.name === event.name && Object.entries(event.values).every(([k, v]) => same(e.args[k], v))), 'The receipt lacks the exact reviewed setup event.');
      }
      return this.store.setIntent(id, 'confirmed', row.hash, proof);
    } catch (error) {
      return this.store.setIntent(id, error instanceof AppError ? 'invalid' : 'outcome_unknown', row.hash, null,
        error instanceof AppError ? error.message : 'RPC verification failed. Recheck the original hash; do not resend.');
    }
  }
  async configuration(rpcUrl) {
    check(SETUP_STEPS.every(([action]) => this.confirmed(action)), 'Finish and verify all setup steps before launching the payment app.', 409);
    await this.network();
    return { chainId: this.expectedChainId, rpcUrl, instanceId: `public-${this.expectedChainId}-${this.address('vault').toLowerCase()}`,
      ownerAddress: this.seed.ownerAddress, tokenAddress: this.address('token'), vaultAddress: this.address('vault'),
      tokenCodeHash: this.confirmed('token').receipt.codeHash, vaultCodeHash: this.confirmed('vault').receipt.codeHash };
  }
  close() { this.provider.destroy(); }
}
