import { randomUUID } from 'node:crypto';
import { Contract, JsonRpcProvider, getAddress, id, keccak256, parseUnits, ZeroAddress } from 'ethers';
import { billKeyFor, invoiceIdHash, normalizeInvoiceNumber } from '../scripts/bill-identity.mjs';
import { AppError, check } from './errors.mjs';
import { FIELD_NAMES } from './intake.mjs';

export const VENDOR_LABELS = { 'V-HOST': 'Hostline Demo', 'V-DESIGN': 'Artline Demo' };
const clone = (value) => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const integer = (value) => /^\d+$/.test(String(value));
const equalBill = (bill, approval, revision) => ['recipient', 'amount', 'notBefore', 'expiresAt', 'documentHash', 'vendorId']
  .every((key) => same(bill[key], approval[key])) && same(bill.vendorRevision, revision) && !bill.cancelled;

export function tokenUnits(value, allowZero = false) {
  check(typeof value === 'string' && /^(0|[1-9]\d{0,71})(\.\d{1,6})?$/.test(value), 'Enter an exact token amount with at most six decimal places.');
  const units = parseUnits(value, 6);
  check(units < 2n ** 256n && (allowZero ? units >= 0n : units > 0n), 'The token amount is outside the allowed range.');
  return units.toString();
}

function timestamp(value) {
  check(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value), 'Choose an explicit payment time.');
  const seconds = Date.parse(value) / 1000;
  check(Number.isFinite(seconds) && seconds >= 0, 'Invalid payment time.');
  return Math.floor(seconds).toString();
}
function calendarDate(value) {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function recipientAddress(value, vaultAddress) {
  let address;
  try { address = getAddress(value); } catch { throw new AppError('Enter a valid wallet address.'); }
  check(address !== ZeroAddress && !same(address, vaultAddress), 'Use a non-zero recipient outside the vault.');
  return address;
}

export class OwnerService {
  constructor(config, store, vaultAbi, tokenAbi) {
    check([31337, 11155111].includes(config.chainId), 'Unsupported chain configuration.');
    this.config = config; this.store = store;
    this.provider = new JsonRpcProvider(config.rpcUrl, undefined, { cacheTimeout: -1 });
    this.provider.pollingInterval = 100;
    this.vault = new Contract(config.vaultAddress, vaultAbi, this.provider);
    this.token = new Contract(config.tokenAddress, tokenAbi, this.provider);
  }
  async snapshot() {
    const c = this.config;
    check(Number((await this.provider.getNetwork()).chainId) === c.chainId, 'RPC chain changed. Signing is disabled.', 503);
    const [vaultCode, tokenCode, owner, token, chain] = await Promise.all([
      this.provider.getCode(c.vaultAddress), this.provider.getCode(c.tokenAddress),
      this.vault.owner(), this.vault.token(), this.vault.deploymentChainId(),
    ]);
    check(keccak256(vaultCode) === c.vaultCodeHash && keccak256(tokenCode) === c.tokenCodeHash
      && same(owner, c.ownerAddress) && same(token, c.tokenAddress) && Number(chain) === c.chainId,
    'Unexpected contract, owner or token configuration. Signing is disabled.', 503);
    check(await this.token.decimals() === 6n, 'Unsupported token precision.', 503);
    const [maxPerBill, dailyLimit, reserve, spent, balance, policyVersion, paused, agent, agentNotBefore, agentExpiresAt, block] = await Promise.all([
      this.vault.maxPerBill(), this.vault.dailyLimit(), this.vault.minReserve(), this.vault.currentDaySpent(),
      this.token.balanceOf(c.vaultAddress), this.vault.policyVersion(), this.vault.paused(), this.vault.agent(),
      this.vault.agentNotBefore(), this.vault.agentExpiresAt(), this.provider.getBlock('latest'),
    ]);
    const vendors = await Promise.all(Object.entries(VENDOR_LABELS).map(async ([reference, label]) => {
      const vendor = await this.vault.vendors(id(reference));
      return { reference, label, recipient: vendor.recipient, enabled: vendor.enabled, revision: vendor.revision.toString() };
    }));
    return clone({ maxPerBill, dailyLimit, reserve, spent, balance, policyVersion, paused, agent, agentNotBefore,
      agentExpiresAt, now: block.timestamp, blockNumber: block.number, vendors });
  }
  async assessAll(snapshot = null) {
    snapshot ??= await this.snapshot();
    const drafts = this.store.drafts();
    const firstKeys = new Map();
    const results = [];
    const intents = this.store.intents().filter((row) => row.payload.instanceId === this.config.instanceId);
    for (const draft of drafts) {
      const f = draft.fields;
      const errors = [], warnings = [...draft.warnings];
      const vendor = snapshot.vendors.find((row) => row.reference === f.vendor_reference);
      let key = null, approval = null, normalized = null, chainBill = null;
      if (!vendor?.enabled) errors.push('Select an enabled vendor from the owner-controlled registry.');
      try { normalized = normalizeInvoiceNumber(f.invoice_number); }
      catch { errors.push('Enter a readable ASCII invoice number; unclear or non-ASCII IDs require review.'); }
      let amount = null, notBefore = null, expiresAt = null;
      try { amount = tokenUnits(f.amount); } catch (error) { errors.push(error.message); }
      if (f.currency !== 'MDT') errors.push('Currency must explicitly be MDT. No currency conversion is available.');
      if (!calendarDate(f.invoice_date) || !calendarDate(f.due_date)) errors.push('Enter valid invoice and due dates.');
      if (calendarDate(f.invoice_date) && calendarDate(f.due_date) && f.due_date < f.invoice_date) errors.push('Due date is before the invoice date.');
      if (!integer(f.owner_priority) || Number(f.owner_priority) < 1 || Number(f.owner_priority) > 99) errors.push('Choose an owner priority from 1 to 99.');
      try { notBefore = timestamp(f.not_before); expiresAt = timestamp(f.expires_at); }
      catch (error) { errors.push(error.message); }
      if (notBefore && expiresAt && (BigInt(expiresAt) <= BigInt(notBefore) || BigInt(expiresAt) <= BigInt(snapshot.now))) errors.push('Expiry must be after the payment start and the current chain time.');
      const recipientMismatch = Boolean(vendor && f.recipient && !same(f.recipient, vendor.recipient));
      if (recipientMismatch) warnings.push('Invoice address differs from the approved vendor. Verify it independently; the invoice cannot update the registry.');
      let similar = false;
      if (normalized && vendor) {
        key = billKeyFor(this.config.chainId, this.config.vaultAddress, id(vendor.reference), normalized);
        if (firstKeys.has(key)) errors.push(`Duplicate invoice. Review the earlier copy (${firstKeys.get(key)}) instead.`);
        else firstKeys.set(key, f.invoice_number);
        similar = drafts.some((other) => {
          if (other.id === draft.id || other.fields.vendor_reference !== f.vendor_reference) return false;
          try {
            const otherId = normalizeInvoiceNumber(other.fields.invoice_number);
            return otherId !== normalized && otherId.replace(/[^A-Z0-9]/g, '') === normalized.replace(/[^A-Z0-9]/g, '');
          } catch { return false; }
        });
        if (similar) warnings.push('A similar invoice number exists. Check whether these are actually the same bill.');
        const bill = await this.vault.getBill(key);
        chainBill = clone(bill.toObject());
        if (bill.paid) errors.push('The contract already marks this bill paid. It cannot be approved or paid again.');
        if (bill.cancelled) warnings.push('The owner cancelled the existing approval. Review again before explicitly approving a replacement.');
      }
      if (vendor && amount && notBefore && expiresAt && normalized) {
        approval = { vendorId: id(vendor.reference), invoiceIdHash: invoiceIdHash(normalized), recipient: vendor.recipient,
          amount, notBefore, expiresAt, documentHash: draft.document_hash };
        if (BigInt(amount) > BigInt(snapshot.maxPerBill)) warnings.push('This amount is above the current per-bill payment limit. Approval alone will not bypass that limit.');
      }
      const reviewValid = draft.review?.version === draft.version && draft.review?.vendorRevision === vendor?.revision
        && draft.review?.billCancelled === Boolean(chainBill?.cancelled)
        && (!recipientMismatch || draft.review?.recipientChecked === true) && (!similar || draft.review?.similarityChecked === true);
      const locked = intents.some((row) => ['submitted', 'outcome_unknown'].includes(row.status)
        && row.payload.drafts?.some((ref) => ref.id === draft.id)) || this.store.payments(this.config.instanceId)
        .some((row) => ['submitting', 'submitted', 'outcome_unknown', 'invalid'].includes(row.status) && row.payload.draftId === draft.id);
      const verifiedApproval = approval && chainBill && equalBill(chainBill, approval, vendor.revision)
        && intents.some((row) => row.status === 'confirmed' && row.payload.drafts?.some((ref) => ref.id === draft.id && ref.version === draft.version));
      const status = chainBill?.paid ? 'recorded_paid' : verifiedApproval && !errors.length ? 'approved'
        : locked ? 'submitted' : errors.length ? 'needs_review' : reviewValid ? 'ready' : 'draft';
      results.push({ ...draft, errors, warnings, key, approval, vendor, recipientMismatch, similar,
        reviewValid: Boolean(reviewValid), verifiedApproval: Boolean(verifiedApproval), status, chainBill, locked });
    }
    return results;
  }
  async state() {
    const snapshot = await this.snapshot();
    return { mode: this.agent ? 'owner-and-agent' : 'owner-review-no-model', config: { chainId: this.config.chainId, vaultAddress: this.config.vaultAddress,
      tokenAddress: this.config.tokenAddress, ownerAddress: this.config.ownerAddress, instanceId: this.config.instanceId },
    snapshot, drafts: await this.assessAll(snapshot), intents: this.store.intents()
      .filter((row) => row.payload.instanceId === this.config.instanceId),
    agent: this.agent ? await this.agent.state() : null };
  }
  async editDraft(id, body) {
    const draft = this.store.draft(id);
    check(draft, 'Draft not found.', 404);
    const view = (await this.assessAll()).find((row) => row.id === id);
    check(!view.locked, 'A transaction is pending. Reconcile it before editing this bill.', 409);
    check(Number.isInteger(body.version) && body.version === draft.version, 'Draft changed. Refresh before editing.', 409);
    check(body.fields && Object.keys(body.fields).length === FIELD_NAMES.length && FIELD_NAMES.every((key) => typeof body.fields[key] === 'string'), 'Invalid draft fields.');
    check(Object.keys(body.fields).every((key) => FIELD_NAMES.includes(key)), 'Unsupported draft field.');
    check(Object.entries(body.fields).every(([key, value]) => value.length <= (key === 'note' ? 6000 : 200)), 'Draft field is too long.');
    check(this.store.updateDraft(id, body.version, body.fields), 'Draft changed. Refresh before editing.', 409);
    return this.store.draft(id);
  }
  async reviewDraft(id, body) {
    check(body.checked === true, 'Confirm that you checked the bill against its source.');
    const draft = (await this.assessAll()).find((row) => row.id === id);
    check(draft, 'Draft not found.', 404);
    check(body.version === draft.version, 'Draft changed; review it again.', 409);
    check(!draft.locked && !draft.errors.length, draft.errors[0] ?? 'Transaction is pending.', 409);
    check(!draft.recipientMismatch || body.recipientChecked === true, 'Verify the approved recipient independently before continuing.');
    check(!draft.similar || body.similarityChecked === true, 'Review the similar invoice number before continuing.');
    this.store.reviewDraft(id, { version: draft.version, vendorRevision: draft.vendor.revision,
      billCancelled: Boolean(draft.chainBill?.cancelled),
      recipientChecked: body.recipientChecked === true, similarityChecked: body.similarityChecked === true });
  }
  async prepare(action, body) {
    const snapshot = await this.snapshot();
    let method, args, expectedEvents, title, drafts = [];
    if (action === 'bills') {
      check(Array.isArray(body.ids) && body.ids.length > 0 && body.ids.length <= 50 && new Set(body.ids).size === body.ids.length, 'Select 1–50 different reviewed bills.');
      const views = await this.assessAll(snapshot);
      const selected = body.ids.map((id) => views.find((row) => row.id === id));
      check(selected.every((row) => row?.status === 'ready' && row.reviewValid), 'Every selected bill must be reviewed, valid and ready.', 409);
      method = 'approveBills'; args = [selected.map((row) => row.approval)];
      drafts = selected.map((row) => ({ id: row.id, version: row.version, vendorRevision: row.vendor.revision }));
      expectedEvents = selected.map((row) => ({ name: 'BillApproved', values: { billKey: row.key,
        vendorId: row.approval.vendorId, recipient: row.approval.recipient, amount: row.approval.amount,
        notBefore: row.approval.notBefore, expiresAt: row.approval.expiresAt, documentHash: row.approval.documentHash } }));
      title = `Approve ${selected.length} reviewed bill${selected.length === 1 ? '' : 's'}`;
    } else if (action === 'vendor') {
      check(Object.hasOwn(VENDOR_LABELS, body.reference) && typeof body.enabled === 'boolean', 'Choose a supported vendor and its enabled state.');
      const recipient = recipientAddress(body.recipient, this.config.vaultAddress);
      method = 'setVendor'; args = [id(body.reference), recipient, body.enabled];
      expectedEvents = [{ name: 'VendorSet', values: { vendorId: args[0], recipient, enabled: body.enabled } }];
      title = `Update ${VENDOR_LABELS[body.reference]} recipient`;
    } else if (action === 'limits') {
      method = 'setLimits'; args = [tokenUnits(body.maxPerBill), tokenUnits(body.dailyLimit), tokenUnits(body.reserve, true)];
      expectedEvents = [{ name: 'LimitsSet', values: { maxPerBill: args[0], dailyLimit: args[1], minReserve: args[2] } }];
      title = 'Change spending rules';
    } else if (action === 'agent') {
      const address = recipientAddress(body.agent, this.config.vaultAddress);
      check(!same(address, this.config.ownerAddress), 'Use a separate agent account.');
      const start = timestamp(body.notBefore), end = timestamp(body.expiresAt);
      check(BigInt(end) > BigInt(start) && BigInt(end) > BigInt(snapshot.now), 'Choose a valid agent permission window.');
      method = 'setAgent'; args = [address, start, end];
      expectedEvents = [{ name: 'AgentSet', values: { agent: address, notBefore: start, expiresAt: end } }];
      title = 'Grant time-limited agent access';
    } else if (action === 'pause') {
      check(typeof body.paused === 'boolean', 'Choose pause or resume.');
      method = 'setPaused'; args = [body.paused]; title = body.paused ? 'Pause agent payments' : 'Resume agent payments';
      expectedEvents = [{ name: 'PauseSet', values: { paused: body.paused } }];
    } else if (action === 'revoke') {
      method = 'revokeAgent'; args = []; title = 'Revoke agent access';
      expectedEvents = [{ name: 'AgentRevoked', values: { previousAgent: snapshot.agent } }];
    } else if (action === 'cancel') {
      check(/^0x[0-9a-f]{64}$/i.test(body.key ?? ''), 'Invalid bill key.');
      method = 'cancelBill'; args = [body.key]; title = 'Cancel this bill approval';
      expectedEvents = [{ name: 'BillCancelledByOwner', values: { billKey: body.key } }];
    } else throw new AppError('Unsupported owner action.');
    const data = this.vault.interface.encodeFunctionData(method, args);
    try { await this.provider.call({ from: this.config.ownerAddress, to: this.config.vaultAddress, data }); }
    catch { throw new AppError('The contract rejected this action. Refresh the chain state and review its fields.', 409); }
    return this.store.addIntent({ instanceId: this.config.instanceId, title, method, args, expectedEvents, drafts,
      expectedPolicyVersion: snapshot.policyVersion, to: this.config.vaultAddress, data,
      chainId: this.config.chainId, owner: this.config.ownerAddress, value: '0x0', createdAt: new Date().toISOString() });
  }
  intent(id) {
    const intent = this.store.intent(id);
    check(intent && intent.payload.instanceId === this.config.instanceId, 'Transaction review not found for this chain session.', 404);
    return intent;
  }
  async validateIntent(id) {
    const intent = this.intent(id);
    check(intent.status === 'prepared' && !intent.hash, 'This transaction was already submitted or cancelled. Reconcile it instead.', 409);
    const snapshot = await this.snapshot();
    check(snapshot.policyVersion === intent.payload.expectedPolicyVersion, 'Permissions changed. Prepare a fresh transaction review.', 409);
    if (intent.payload.drafts.length) {
      const views = await this.assessAll(snapshot);
      check(intent.payload.drafts.every((ref) => views.some((row) => row.id === ref.id && row.version === ref.version
        && row.vendor.revision === ref.vendorRevision && row.status === 'ready' && row.reviewValid)), 'A bill or recipient changed. Review and prepare it again.', 409);
    }
    await this.provider.call({ from: intent.payload.owner, to: intent.payload.to, data: intent.payload.data });
    return intent;
  }
  async submitted(id, hash) {
    const intent = this.intent(id);
    check(/^0x[0-9a-f]{64}$/i.test(hash ?? ''), 'Enter a valid transaction hash.');
    check(!intent.hash || same(intent.hash, hash), 'A different hash is already recorded. Reconcile the original.', 409);
    check(['prepared', 'submitted', 'outcome_unknown', 'confirmed', 'reverted'].includes(intent.status), 'This transaction review is no longer active.', 409);
    check(!this.store.intents().some((row) => row.id !== id && same(row.hash, hash)), 'This hash belongs to another transaction review.', 409);
    if (['confirmed', 'reverted'].includes(intent.status)) return intent;
    this.store.setIntent(id, 'submitted', hash); // Persist before RPC reconciliation.
    return this.reconcile(id);
  }
  async reconcile(id) {
    const intent = this.intent(id);
    check(intent.hash, 'No transaction hash is recorded. Check the wallet before trying again.');
    try {
      await this.snapshot();
      const [receipt, tx] = await Promise.all([this.provider.getTransactionReceipt(intent.hash), this.provider.getTransaction(intent.hash)]);
      if (!receipt || !tx) return this.store.setIntent(id, 'submitted', intent.hash);
      check(Number(tx.chainId) === this.config.chainId && same(tx.from, intent.payload.owner)
        && same(tx.to, intent.payload.to) && same(tx.data, intent.payload.data) && tx.value === 0n,
      'Transaction does not match the reviewed owner action.');
      const proof = { hash: receipt.hash, chainId: Number(tx.chainId), blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash, status: receipt.status, gasUsed: receipt.gasUsed.toString() };
      if (receipt.status !== 1) return this.store.setIntent(id, 'reverted', intent.hash, proof, 'Transaction reverted; no approval was confirmed.');
      const events = receipt.logs.filter((log) => same(log.address, this.config.vaultAddress)).map((log) => this.vault.interface.parseLog(log));
      for (const expected of intent.payload.expectedEvents) {
        check(events.some((event) => event?.name === expected.name && Object.entries(expected.values).every(([key, value]) => same(event.args[key], value))), 'Receipt events do not match the reviewed fields.');
      }
      return this.store.setIntent(id, 'confirmed', intent.hash, proof);
    } catch (error) {
      if (error instanceof AppError) return this.store.setIntent(id, 'invalid', intent.hash, null, error.message);
      return this.store.setIntent(id, 'outcome_unknown', intent.hash, null, 'RPC could not verify the outcome. Recheck the original hash; do not send another transaction.');
    }
  }
  cancelIntent(id) {
    const intent = this.intent(id);
    check(!intent.hash && intent.status === 'prepared', 'A submitted transaction cannot be cancelled here. Reconcile its hash.', 409);
    return this.store.setIntent(id, 'cancelled', null);
  }
  close() { this.provider.destroy(); }
}

export function newInstanceId() { return randomUUID(); }
