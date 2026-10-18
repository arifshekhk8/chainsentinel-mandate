import { ZeroAddress, formatUnits } from 'ethers';

export const REASONS = {
  ready: ['Ready within the current rules.', 'Review this exact plan, then run the agent.'],
  paid: ['The contract already marks this bill paid.', 'Do not pay it again; check its original receipt.'],
  approval: ['No matching owner-approved version is available.', 'Review the source and sign an exact approval.'],
  cancelled: ['The owner cancelled this approval.', 'Review it again only if the owner wants a replacement.'],
  vendor: ['The vendor or recipient approval changed.', 'Verify the vendor, then review and approve this bill again.'],
  paused: ['The vault is paused.', 'The owner can review and sign Resume in Rules & access.'],
  agent: ['Agent permission is missing or revoked.', 'The owner must explicitly grant access to the configured agent.'],
  session_future: ['Agent access has not started.', 'Wait for the approved access start.'],
  session_expired: ['Agent access expired.', 'The owner can review and sign a new access window.'],
  future: ['This bill is outside its approved start time.', 'Wait until its approved payment window opens.'],
  expired: ['This bill approval expired.', 'The owner must review and approve a new window.'],
  cap: ['The amount exceeds the per-bill limit.', 'Ask the owner to review the bill and spending rules.'],
  daily: ['The remaining UTC daily budget is too small.', 'Wait for the next UTC day or ask the owner to review the limit.'],
  balance: ['The vault has too few MDT tokens.', 'The owner can add test tokens after reviewing the balance.'],
  reserve: ['Paying would reduce the balance below the protected reserve.', 'Wait for funding or ask the owner to review the reserve.'],
  pending: ['An original payment outcome needs reconciliation.', 'Check the original hash; do not send another payment.'],
};
export const money = (n) => formatUnits(n, 6).replace(/\.0$/, '');
export function ordered(rows) {
  return [...rows].sort((a, b) => Number(a.fields.owner_priority) - Number(b.fields.owner_priority)
    || a.fields.due_date.localeCompare(b.fields.due_date) || String(a.key).localeCompare(String(b.key)));
}
export function planBills(snapshot, rows, attempts = [], executorAddress = null) {
  let balance = BigInt(snapshot.balance), spent = BigInt(snapshot.spent);
  const unresolved = attempts.some((a) => ['submitting', 'submitted', 'outcome_unknown', 'invalid'].includes(a.status));
  const entries = ordered(rows).map((row) => {
    const b = row.chainBill;
    let code = b?.paid ? 'paid' : b?.cancelled ? 'cancelled'
      : b && BigInt(b.amount) > 0n && (!row.vendor?.enabled || row.vendor.revision !== b.vendorRevision || row.vendor.recipient.toLowerCase() !== b.recipient.toLowerCase()) ? 'vendor'
        : !row.verifiedApproval ? 'approval'
        : unresolved ? 'pending' : snapshot.paused ? 'paused'
          : snapshot.agent === ZeroAddress || !executorAddress || snapshot.agent.toLowerCase() !== executorAddress.toLowerCase() ? 'agent'
            : Number(snapshot.now) < Number(snapshot.agentNotBefore) ? 'session_future'
              : Number(snapshot.now) >= Number(snapshot.agentExpiresAt) ? 'session_expired'
                : Number(snapshot.now) < Number(b.notBefore) ? 'future' : Number(snapshot.now) >= Number(b.expiresAt) ? 'expired'
                  : BigInt(b.amount) > BigInt(snapshot.maxPerBill) ? 'cap'
                    : spent + BigInt(b.amount) > BigInt(snapshot.dailyLimit) ? 'daily'
                      : balance < BigInt(b.amount) ? 'balance'
                        : balance - BigInt(b.amount) < BigInt(snapshot.reserve) ? 'reserve' : 'ready';
    if (code === 'ready') { balance -= BigInt(b.amount); spent += BigInt(b.amount); }
    return { id: row.id, version: row.version, key: row.key, invoice: row.fields.invoice_number,
      vendor: row.vendor?.label ?? row.fields.vendor_reference, recipient: b?.recipient ?? null,
      amount: b?.amount ?? null, documentHash: b?.documentHash ?? null,
      approvalVersion: b?.approvalVersion ?? null, code, reason: REASONS[code][0], nextAction: REASONS[code][1] };
  });
  return { policyVersion: snapshot.policyVersion, utcDay: Math.floor(snapshot.now / 86400), blockNumber: snapshot.blockNumber,
    entries, total: entries.filter((e) => e.code === 'ready').reduce((sum, e) => sum + BigInt(e.amount), 0n).toString(),
    projectedBalance: balance.toString(), projectedDailyLeft: (spent < BigInt(snapshot.dailyLimit) ? BigInt(snapshot.dailyLimit) - spent : 0n).toString() };
}
