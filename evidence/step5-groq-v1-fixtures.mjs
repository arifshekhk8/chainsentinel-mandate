import assert from 'node:assert/strict';
import { id, parseUnits, formatUnits } from 'ethers';
import { startLocalChain } from './local-chain.mjs';
import { Store } from '../app/store.mjs';
import { OwnerService } from '../app/service.mjs';
import { AgentService } from '../app/agent.mjs';
import { parseUpload, FIELD_NAMES, REQUIRED_COLUMNS } from '../app/intake.mjs';
import { invoiceIdHash } from './bill-identity.mjs';

export const units = (v) => parseUnits(String(v), 6);
export const seconds = (v) => Math.floor(Date.parse(v) / 1000);
export const criticalFields = REQUIRED_COLUMNS;
const csv = (fields) => FIELD_NAMES.join(',') + '\n' + FIELD_NAMES.map((k) => '"' + fields[k].replaceAll('"', '""') + '"').join(',') + '\n';

// Only synthetic invoice fields enter the application/model. Fixture labels and
// expected outcomes stay in the evaluator, never the model request.
export function invoiceFields(bill, addresses) {
  return { vendor_reference: bill.vendor_reference, invoice_number: bill.invoice_number,
    amount: bill.amount, currency: bill.currency, invoice_date: bill.invoice_date, due_date: bill.due_date,
    recipient: addresses[bill.recipient_alias], owner_priority: String(bill.owner_priority),
    not_before: bill.not_before, expires_at: bill.expires_at, note: bill.document_note };
}

export async function createEvaluationHarness(book) {
  const chain = await startLocalChain({ timestamp: seconds(book.reference_time_utc) - 172800 });
  await chain.provider.send('anvil_setBlockTimestampInterval', [0]);
  let base = await chain.provider.send('evm_snapshot', []), current = null;
  const addresses = { HOST_APPROVED: await chain.host.getAddress(), DESIGN_APPROVED: await chain.design.getAddress(), ATTACKER: await chain.stranger.getAddress() };
  async function setTime(time) {
    await chain.provider.send('evm_setNextBlockTimestamp', [time]);
    await chain.provider.send('evm_mine', []);
  }
  async function setup(c, model) {
    current?.close();
    assert.equal(await chain.provider.send('evm_revert', [base]), true);
    base = await chain.provider.send('evm_snapshot', []);
    const clock = seconds(c.fixture_state.clock), paidHistory = c.bills.some((b) => b.approval_fixture.startsWith('already_paid'));
    const setupClock = paidHistory ? Math.floor(clock / 86400) * 86400 - 600 : clock - 600;
    await setTime(setupClock);
    const store = new Store(), service = new OwnerService(chain.config, store, chain.vaultAbi, chain.tokenAbi);
    const agent = new AgentService(service, model, chain.agent); service.agent = agent;
    current = { c, chain, store, service, agent, addresses, rows: [], ownerActions: [], setupReceipts: [],
      close() { service.close(); store.close(); current = null; } };
    const f = current;
    const expiry = seconds(c.fixture_state.session_expires_at);
    const previousSigner = c.id === 'N16' ? chain.stranger : chain.agent;
    await (await chain.vault.setAgent(await previousSigner.getAddress(), setupClock - 3600, expiry)).wait();
    await (await chain.vault.setPaused(false)).wait();
    const seed = async (name, amount, vendor = 'V-HOST', invoice = name) => {
      const approval = { vendorId: id(vendor), invoiceIdHash: invoiceIdHash(invoice), recipient: addresses[book.vendors[vendor].recipient_alias],
        amount: units(amount), notBefore: setupClock - 3600, expiresAt: clock + 172800, documentHash: id(name) };
      const receipt = await (await chain.vault.approveBills([approval])).wait();
      const event = receipt.logs.map((l) => { try { return chain.vault.interface.parseLog(l); } catch { return null; } }).find((e) => e?.name === 'BillApproved');
      const paid = await (await chain.vault.connect(previousSigner).payBill(event.args.billKey, await chain.vault.policyVersion())).wait();
      f.setupReceipts.push({ purpose: 'historical fixture payment, excluded from measured outflow', hash: paid.hash, amount: units(amount).toString() });
    };
    const historicSpent = units(c.fixture_state.previous_day_spent ?? c.fixture_state.spent_today);
    let remaining = historicSpent, index = 0;
    while (remaining > 0n) { const amount = remaining > units('250') ? units('250') : remaining; await seed(`HISTORY-${c.id}-${index++}`, formatUnits(amount, 6)); remaining -= amount; }
    for (const bill of c.bills.filter((b) => b.approval_fixture.startsWith('already_paid'))) await seed(`PAID-${c.id}`, bill.amount, bill.vendor_reference, bill.invoice_number.trim().toUpperCase());
    // Replenishment is a real local transfer; paid markers and daily history are
    // never fabricated with storage overrides or reset to make a case pass.
    for (const signer of [chain.host, chain.design]) {
      const held = await chain.token.balanceOf(await signer.getAddress());
      if (held) await (await chain.token.connect(signer).transfer(chain.config.vaultAddress, held)).wait();
    }
    await (await chain.vault.setPaused(true)).wait();
    const opening = units(c.fixture_state.opening_balance), balance = await chain.token.balanceOf(chain.config.vaultAddress);
    if (balance > opening) await (await chain.vault.recoverTokens(await chain.owner.getAddress(), balance - opening)).wait();
    await (await chain.vault.setLimits(units(book.base_policy.per_bill_limit), units(book.base_policy.daily_limit), units(c.fixture_state.reserve_override ?? book.base_policy.minimum_reserve))).wait();
    await (await chain.vault.setAgent(await chain.agent.getAddress(), setupClock - 3600, expiry)).wait();
    for (const bill of c.bills) {
      const fields = invoiceFields(bill, addresses);
      const document = await parseUpload(`${bill.id}.csv`, Buffer.from(csv(fields)));
      store.importDocument(document);
      const draft = store.drafts().at(-1); f.rows.push({ bill, draftId: draft.id, fields, source: document.sourceText });
      if (bill.approval_fixture === 'approved_amount_50_then_document_changed') store.updateDraft(draft.id, draft.version, { ...fields, amount: '50.000000' });
      if (bill.recipient_alias === 'ATTACKER') { const row = store.draft(draft.id); store.updateDraft(row.id, row.version, { ...row.fields, recipient: addresses[book.vendors[bill.vendor_reference].recipient_alias] }); }
      if (bill.approval_fixture === 'unapproved_until_corrected_and_signed') { const row = store.draft(draft.id); store.updateDraft(row.id, row.version, { ...row.fields, amount: c.interaction.initial_extraction_amount }); }
    }
    f.approve = async (ids = f.rows.map((r) => r.draftId)) => {
      for (const draftId of ids) {
        const row = store.draft(draftId); await service.reviewDraft(draftId, { version: row.version, checked: true });
        f.ownerActions.push({ action: 'source review', draftId });
      }
      const intent = await service.prepare('bills', { ids });
      const tx = await chain.owner.sendTransaction({ to: intent.payload.to, data: intent.payload.data });
      assert.equal((await service.submitted(intent.id, tx.hash)).status, 'confirmed');
      f.ownerActions.push({ action: 'batch approval signature', hash: tx.hash });
    };
    const approveIds = f.rows.filter((r) => !r.bill.approval_fixture.startsWith('already_paid') && r.bill.approval_fixture !== 'unapproved_until_corrected_and_signed').map((r) => r.draftId);
    if (approveIds.length) await f.approve(approveIds);
    for (const r of f.rows.filter((r) => r.bill.approval_fixture === 'approved_amount_50_then_document_changed' || r.bill.recipient_alias === 'ATTACKER')) {
      const draft = store.draft(r.draftId); await service.editDraft(draft.id, { version: draft.version, fields: r.fields });
    }
    for (const row of await service.assessAll()) if (c.bills.find((b) => b.invoice_number === row.fields.invoice_number)?.approval_fixture === 'cancelled') await (await chain.vault.cancelBill(row.key)).wait();
    if (c.fixture_state.agent_permission === 'revoked_on_chain') await (await chain.vault.revokeAgent()).wait();
    if (!c.fixture_state.paused) await (await chain.vault.setPaused(false)).wait();
    await setTime(clock);
    const snapshot = await service.snapshot();
    assert.equal(snapshot.now, clock); assert.equal(snapshot.balance, opening.toString());
    assert.equal(snapshot.spent, units(c.fixture_state.spent_today).toString());
    assert.equal(snapshot.paused, c.fixture_state.paused);
    f.start = snapshot; f.beforeBalances = await Promise.all([chain.host, chain.design, chain.stranger].map(async (s) => (await chain.token.balanceOf(await s.getAddress())).toString()));
    f.measure = async () => {
      const final = await service.snapshot(), rows = await service.assessAll(final), payments = agent.executor.payments();
      const verified = payments.filter((p) => p.status === 'confirmed');
      const paidOrder = verified.map((p) => f.rows.find((r) => r.draftId === p.payload.draftId)?.bill.id);
      const afterBalances = await Promise.all([chain.host, chain.design, chain.stranger].map(async (s) => (await chain.token.balanceOf(await s.getAddress())).toString()));
      const outflow = BigInt(f.start.balance) - BigInt(final.balance);
      assert.equal(outflow, afterBalances.reduce((sum, v, i) => sum + BigInt(v) - BigInt(f.beforeBalances[i]), 0n));
      return { endingBalance: final.balance, outflow: outflow.toString(), spent: final.spent, paidOrder,
        recipientDeltas: afterBalances.map((v, i) => (BigInt(v) - BigInt(f.beforeBalances[i])).toString()),
        rows: rows.map((r) => ({ caseBillId: f.rows.find((x) => x.draftId === r.id).bill.id, key: r.key, paid: r.chainBill.paid, amount: r.chainBill.amount, recipient: r.chainBill.recipient })),
        payments: payments.map((p) => ({ status: p.status, hash: p.hash, amount: p.payload.amount, recipient: p.payload.recipient, billKey: p.payload.billKey, receipt: p.receipt, error: p.error })) };
    };
    return f;
  }
  return { chain, setup, setTime, async close() { current?.close(); await chain.close(); } };
}
