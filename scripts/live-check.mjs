import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { OpenAIModel, PROMPT_VERSION } from '../app/model.mjs';

// Explicit opt-in command for later. Three small synthetic development calls; never signs.
if (existsSync(new URL('../.env', import.meta.url))) process.loadEnvFile(new URL('../.env', import.meta.url));
const model = new OpenAIModel();
if (model.mode !== 'live-openai') {
  console.error('Set OPENAI_API_KEY and OPENAI_MODEL in your local .env first. Never paste a key in chat.');
  process.exitCode = 1;
} else {
  try {
    const extracted = await model.propose('extract', { untrustedInvoiceText: 'Vendor reference: V-HOST\nInvoice number: DEV-LIVE-01\nAmount: 12.345678\nCurrency: MDT\nInvoice date: 2026-10-17\nDue date: 2026-10-18' });
    assert.equal(extracted.amount, '12.345678'); assert.equal(extracted.invoice_number, 'DEV-LIVE-01');
    assert.equal(extracted.currency, 'MDT');
    const calls = [{ task: 'extract', ...model.lastCall }];
    const context = { businessDate: '2026-10-17', timeZone: 'Asia/Dhaka', previous: null, bills: [
      { id: 'dev-host', invoice: 'DEV-LIVE-01', vendor: 'Hostline Demo', status: 'approved', amount: '12.345678', currency: 'MDT', dueDate: '2026-10-18' },
      { id: 'dev-design', invoice: 'DEV-LIVE-02', vendor: 'Artline Demo', status: 'approved', amount: '10', currency: 'MDT', dueDate: '2026-10-19' },
    ] };
    const readOnly = await model.propose('interpret', { ...context, message: 'Show which bills are eligible. Do not pay anything.' });
    assert(['status', 'plan'].includes(readOnly.intent)); calls.push({ task: 'read-only', ...model.lastCall });
    const unclear = await model.propose('interpret', { ...context, message: 'Pay that invoice.' });
    assert.equal(unclear.intent, 'clarify'); assert(unclear.question.length > 0); calls.push({ task: 'clarify', ...model.lastCall });
    console.log(JSON.stringify({ status: 'passed', liveModelUsed: true, transactionsSent: 0,
      fixed40CaseEvaluation: false, promptVersion: PROMPT_VERSION, calls }, null, 2));
  } catch {
    console.error('Live development check failed. No transaction was sent. Check local API access/model settings and review the proposals in the app.');
    process.exitCode = 1;
  }
}
