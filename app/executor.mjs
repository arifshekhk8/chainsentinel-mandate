import { keccak256 } from 'ethers';
import { check, AppError } from './errors.mjs';
import { planBills } from './planner.mjs';
import { SEPOLIA, feeReview } from './sepolia-policy.mjs';

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const unresolved = new Set(['submitting', 'submitted', 'outcome_unknown', 'invalid']);
export class Executor {
  #signer;
  constructor(service, signer) { this.service = service; this.store = service.store; this.#signer = signer; this.busy = false; }
  async address() { return this.#signer ? this.#signer.getAddress() : null; }
  payments() { return this.store.payments(this.service.config.instanceId); }
  payment(id) {
    const payment = this.payments().find((p) => p.id === id);
    check(payment, 'Payment not found for this chain session.', 404); return payment;
  }
  async reconcile(id) {
    const payment = this.payment(id), p = payment.payload, s = this.service;
    if (['confirmed', 'reverted', 'invalid'].includes(payment.status)) return payment;
    try {
      await s.snapshot();
      const [tx, receipt] = await Promise.all([s.provider.getTransaction(payment.hash), s.provider.getTransactionReceipt(payment.hash)]);
      if (!tx) {
        this.store.setPayment(id, 'outcome_unknown', null, 'The original signed hash is not visible. Do not resend; inspect this hash and agent nonce.');
      } else {
        check(Number(tx.chainId) === s.config.chainId && same(tx.from, p.agent) && same(tx.to, s.config.vaultAddress)
          && tx.value === 0n && same(tx.data, p.data) && tx.nonce === p.nonce, 'Transaction does not match this restricted payment.');
        if (!receipt || s.confirmationsRequired > 1 && await receipt.confirmations() < s.confirmationsRequired)
          this.store.setPayment(id, 'submitted', null, 'Awaiting the required confirmations for the original hash. Do not resend.');
        else {
          const proof = { hash: payment.hash, chainId: s.config.chainId, vault: s.config.vaultAddress,
            blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, status: receipt.status, gasUsed: receipt.gasUsed.toString() };
          if (receipt.status !== 1) this.store.setPayment(id, 'reverted', proof, 'The transaction reverted. No payment from this transaction was confirmed. Ask for a fresh plan.');
          else {
            const events = receipt.logs.filter((l) => same(l.address, s.config.vaultAddress)).map((l) => s.vault.interface.parseLog(l));
            const paid = events.filter((e) => e?.name === 'BillPaid');
            check(paid.length === 1 && ['billKey', 'recipient', 'token', 'amount', 'policyVersion', 'utcDay'].every((key) => same(paid[0].args[key], p[key])), 'Successful receipt lacks the exact approved payment event.');
            const bill = await s.vault.getBill(p.billKey);
            check(bill.paid && same(bill.recipient, p.recipient) && same(bill.amount, p.amount), 'The paid marker does not match the receipt.');
            proof.payment = Object.fromEntries(['billKey', 'recipient', 'token', 'amount', 'policyVersion', 'utcDay', 'dailySpent'].map((k) => [k, paid[0].args[k].toString()]));
            this.store.setPayment(id, 'confirmed', proof);
          }
        }
      }
    } catch (error) {
      this.store.setPayment(id, error instanceof AppError ? 'invalid' : 'outcome_unknown', null,
        error instanceof AppError ? error.message : 'RPC could not verify this original hash. Recheck it; do not resend.');
    }
    return this.payment(id);
  }
  async recover() {
    // Recovery never signs or broadcasts, and never relabels a paid marker as our verified receipt.
    for (const p of this.payments().filter((p) => unresolved.has(p.status) && p.status !== 'invalid')) await this.reconcile(p.id);
    this.store.recoverAbandonedPlans(this.service.config.instanceId);
    return this.payments();
  }
  async execute(plan, confirmed) {
    const s = this.service, instance = s.config.instanceId;
    check(confirmed === true, 'Review the exact plan and explicitly confirm execution.');
    check(this.#signer && plan.payload.kind === 'payment' && plan.payload.intent === 'pay', 'This request is read-only or needs clarification; it cannot execute.', 409);
    check(!this.busy && this.store.claimPlan(plan.id, instance), 'This plan was used, another batch is active, or an original outcome needs reconciliation.', 409);
    this.busy = true;
    let outcome = 'completed';
    try {
      const expected = plan.payload.plan.entries.filter((e) => e.code === 'ready');
      check(expected.length, 'There are no eligible payments in this plan.', 409);
      for (const entry of expected) {
        const snapshot = await s.snapshot();
        check(snapshot.policyVersion === plan.payload.plan.policyVersion && Math.floor(snapshot.now / 86400) === plan.payload.plan.utcDay,
          'Permissions or UTC budget day changed. Ask for a fresh plan.', 409);
        const rows = await s.assessAll(snapshot);
        const row = rows.find((r) => r.id === entry.id);
        check(row && row.version === entry.version && row.key === entry.key && row.status === 'approved'
          && row.chainBill.approvalVersion === entry.approvalVersion && same(row.chainBill.documentHash, entry.documentHash)
          && same(row.chainBill.amount, entry.amount) && same(row.chainBill.recipient, entry.recipient),
        'This bill or approval changed. Review it and ask for a fresh plan.', 409);
        const agent = await this.address();
        const fresh = planBills(snapshot, [row], this.payments(), agent).entries[0];
        check(fresh.code === 'ready', `${fresh.reason} ${fresh.nextAction}`, 409);
        const data = s.vault.interface.encodeFunctionData('payBill', [entry.key, snapshot.policyVersion]);
        const call = { from: agent, to: s.config.vaultAddress, data, value: 0n };
        try { await s.provider.call(call); }
        catch (error) { throw new AppError(error.code === 'CALL_EXCEPTION'
          ? 'Contract simulation rejected this bill. Refresh the plan; no new payment was sent.'
          : 'Simulation could not be verified because the RPC failed. Refresh the plan; no new payment was sent.', 409); }
        // Populate/sign only this fixed call. Persist its hash BEFORE any network broadcast.
        const publicFees = s.config.chainId === SEPOLIA ? await feeReview(s.provider, call) : null;
        const tx = await this.#signer.populateTransaction({ to: s.config.vaultAddress, data, value: 0n,
          ...(publicFees ? { gasLimit: BigInt(publicFees.gasLimit), maxFeePerGas: BigInt(publicFees.maxFeePerGas),
            maxPriorityFeePerGas: BigInt(publicFees.maxPriorityFeePerGas) } : {}) });
        check(Number(tx.chainId) === s.config.chainId && same(tx.to, s.config.vaultAddress)
          && same(tx.data, data) && BigInt(tx.value ?? 0) === 0n, 'Signing boundary rejected an unexpected transaction.');
        const raw = await this.#signer.signTransaction(tx);
        const hash = keccak256(raw);
        const id = this.store.addPayment(instance, { planId: plan.id, draftId: row.id, billKey: entry.key,
          invoice: entry.invoice, agent, nonce: Number(tx.nonce), data, recipient: entry.recipient, amount: entry.amount,
          token: s.config.tokenAddress, policyVersion: snapshot.policyVersion,
          utcDay: String(Math.floor(snapshot.now / 86400)), createdAt: new Date().toISOString() }, hash);
        try {
          const sent = await s.provider.broadcastTransaction(raw);
          check(same(sent.hash, hash), 'RPC returned an unexpected transaction hash.');
          this.store.setPayment(id, 'submitted');
        } catch {
          this.store.setPayment(id, 'outcome_unknown', null, 'Broadcast outcome is unknown. Recheck the original hash; never resend blindly.');
          outcome = 'interrupted'; break;
        }
        if (s.config.chainId === SEPOLIA) {
          try { await s.provider.waitForTransaction(hash, s.confirmationsRequired, 90000); }
          catch { /* Reconcile the original hash; never rebroadcast on timeout. */ }
        }
        const result = await this.reconcile(id);
        if (result.status !== 'confirmed') { outcome = 'interrupted'; break; }
      }
    } catch (error) {
      outcome = 'interrupted';
      if (error instanceof AppError) throw error;
      throw new AppError('The payment workflow stopped. Recheck original hashes and ask for a fresh plan after resolving them.', 503);
    } finally { this.store.finishPlan(plan.id, outcome); this.busy = false; }
    return { status: outcome, payments: this.payments().filter((p) => p.payload.planId === plan.id),
      message: outcome === 'completed' ? 'Batch checked. Only payments with matching successful receipts are confirmed.' : 'Batch stopped. Recheck the original hash before continuing.' };
  }
}
