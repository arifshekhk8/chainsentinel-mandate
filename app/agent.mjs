import { check } from './errors.mjs';
import { validateProposal, rejectSecrets } from './model.mjs';
import { planBills, money } from './planner.mjs';
import { Executor } from './executor.mjs';

export class AgentService {
  constructor(service, model, signer = null) {
    this.service = service; this.store = service.store; this.model = model;
    this.executor = new Executor(service, signer); this.requesting = false;
  }
  plans() { return this.store.plans(this.service.config.instanceId); }
  plan(id) { const p = this.plans().find((p) => p.id === id); check(p, 'Agent review not found for this chain session.', 404); return p; }
  async state() { return { mode: this.model.mode, model: this.model.mode === 'live-openai' ? this.model.model : null,
    executorAddress: await this.executor.address(), plans: this.plans().slice(0, 20), payments: this.executor.payments() }; }
  async request(body) {
    check(!this.requesting, 'Another AI request is active. Please wait.', 409);
    check(typeof body.message === 'string' && body.message.trim().length > 0 && body.message.length <= 2000, 'Write a short request about the approved bills.');
    rejectSecrets(body.message);
    this.requesting = true;
    try {
      const snapshot = await this.service.snapshot(), rows = await this.service.assessAll(snapshot);
      const previous = body.previousPlanId ? this.plan(body.previousPlanId) : null;
      const businessDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(snapshot.now * 1000));
      const proposal = validateProposal('interpret', await this.model.propose('interpret', {
        message: body.message, businessDate, timeZone: 'Asia/Dhaka',
        previous: previous ? { request: previous.payload.request, question: previous.payload.question } : null,
        bills: rows.map((r) => ({ id: r.id, invoice: r.fields.invoice_number, vendor: r.vendor?.label ?? r.fields.vendor_reference,
          vendorReference: r.fields.vendor_reference, amount: r.fields.amount, currency: r.fields.currency,
          dueDate: r.fields.due_date, status: r.status })),
      }));
      check(proposal.billIds.every((id) => rows.some((r) => r.id === id)), 'AI referenced an unknown bill. Please rephrase.', 502);
      let intent = proposal.intent;
      // Questions/previews cannot acquire send authority even if a model misclassifies them.
      if (intent === 'pay' && /\?|\b(?:show|explain|preview|plan|which|why|what|could|would|can)\b/i.test(body.message)) intent = 'plan';
      const selected = proposal.scope === 'all' ? rows : rows.filter((r) => proposal.billIds.includes(r.id));
      if (['plan', 'pay'].includes(intent) && !selected.length) {
        intent = 'clarify'; proposal.question = 'Which invoice or vendor should I plan for?';
      }
      if (intent === 'correct') {
        const row = rows.find((r) => r.id === proposal.correction.draftId);
        check(row, 'AI correction referenced an unknown draft.', 502);
        return this.store.addPlan(this.service.config.instanceId, { kind: 'correction', intent, mode: this.model.mode,
          request: body.message, correction: proposal.correction, version: row.version, modelInfo: this.model.lastCall ?? null,
          message: 'This only proposes a draft change. Apply it, check the source and sign a new approval if needed. Existing on-chain permission stays active until cancelled or replaced.' });
      }
      const plan = planBills(snapshot, selected, this.executor.payments(), await this.executor.address());
      const message = intent === 'clarify' ? proposal.question || 'Which invoice do you mean?'
        : intent === 'unsupported' ? 'I can help with approved MDT bills. Use the owner review screens for approvals, recipients and rule changes. Trading and arbitrary transactions are not supported.'
          : `${intent === 'pay' ? 'Payment request prepared' : 'Read-only preview'}. ${plan.entries.filter((e) => e.code === 'ready').length} eligible; ${money(plan.total)} MDT total. Projected balance ${money(plan.projectedBalance)} MDT. No payment has been sent by this request.`;
      return this.store.addPlan(this.service.config.instanceId, { kind: 'payment', intent, mode: this.model.mode,
        request: body.message, question: intent === 'clarify' ? message : null, message, plan, modelInfo: this.model.lastCall ?? null });
    } finally { this.requesting = false; }
  }
  async preview() {
    const snapshot = await this.service.snapshot(), rows = await this.service.assessAll(snapshot);
    return this.store.addPlan(this.service.config.instanceId, { kind: 'payment', intent: 'pay', mode: 'scripted-manual',
      request: 'Explicit manual payment preview', message: 'Scripted manual preview. AI was not used. Review exact entries before running the agent.',
      plan: planBills(snapshot, rows, this.executor.payments(), await this.executor.address()) });
  }
  async extract(id) {
    check(!this.requesting, 'Another AI request is active. Please wait.', 409);
    const row = this.store.draft(id); check(row, 'Draft not found.', 404);
    check(this.store.drafts().filter((r) => r.document_id === row.document_id).length === 1, 'AI field assistance needs one invoice per file. This CSV already has separate editable records; review them manually.');
    check(row.source.length <= 20000, 'Source is too long for AI assistance. Use manual review or upload a smaller single invoice.');
    this.requesting = true;
    try {
      const fields = validateProposal('extract', await this.model.propose('extract', { untrustedInvoiceText: row.source }));
      return this.store.addPlan(this.service.config.instanceId, { kind: 'extraction', intent: 'correct', mode: this.model.mode,
        draftId: row.id, version: row.version, fields, modelInfo: this.model.lastCall ?? null,
        message: 'AI-proposed fields only. Blank or uncertain values need manual review. Applying clears the review stamp and never changes signed permission.' });
    } finally { this.requesting = false; }
  }
  async apply(id) {
    const p = this.plan(id); check(p.status === 'prepared' && ['correction', 'extraction'].includes(p.payload.kind), 'This proposal is not an active draft correction.', 409);
    const data = p.payload, draftId = data.draftId ?? data.correction.draftId;
    const row = this.store.draft(draftId); check(row && row.version === data.version, 'Draft changed. Ask for a fresh proposal.', 409);
    const fields = { ...row.fields };
    if (data.kind === 'extraction') {
      for (const [key, value] of Object.entries(data.fields)) if (value !== null) fields[key] = value;
    } else fields[data.correction.field] = data.correction.value;
    const updated = await this.service.editDraft(draftId, { version: data.version, fields });
    this.store.finishPlan(id, 'applied'); return updated;
  }
  async execute(id, body) { return this.executor.execute(this.plan(id), body.confirmed); }
}
