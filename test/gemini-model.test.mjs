import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiModel, createModel, rejectSecrets, PROMPT_VERSION } from '../app/model.mjs';
import { FIELD_NAMES } from '../app/intake.mjs';

const proposal = { intent: 'status', scope: 'selected', billIds: [], question: '', correction: null };
const envelope = (value = proposal) => ({ status: 'completed', model: 'gemini-3.8-flash',
  steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(value) }] }],
  usage: { total_input_tokens: 100, total_output_tokens: 30, total_thought_tokens: 10 } });
const response = (body = envelope()) => new Response(JSON.stringify(body));

test('Gemini sends bounded structured data, private header, store false, low thinking and no tools', async () => {
  let calls = 0;
  const model = new GeminiModel({ apiKey: 'synthetic-gemini-token', fetcher: async (url, opts) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(opts.headers['x-goog-api-key'], 'synthetic-gemini-token');
    assert.equal(opts.redirect, 'error'); assert(opts.signal instanceof AbortSignal);
    const body = JSON.parse(opts.body);
    assert.equal(body.model, 'gemini-3.8-flash'); assert.equal(body.store, false);
    assert.equal(body.tools, undefined); assert.equal(body.previous_interaction_id, undefined);
    assert.equal(body.generation_config.thinking_level, 'low'); assert.equal(body.generation_config.thinking_summaries, 'none');
    assert.equal(body.response_format.mime_type, 'application/json');
    assert.equal(body.response_format.schema.additionalProperties, false);
    assert(body.system_instruction.includes(PROMPT_VERSION));
    assert(!opts.body.includes('synthetic-gemini-token')); assert(!JSON.stringify(model).includes('synthetic-gemini-token'));
    return response();
  } });
  assert.deepEqual(await model.propose('interpret', { message: 'Show bills.' }), proposal);
  assert.equal(calls, 1); assert.equal(model.lastCall.provider, 'gemini'); assert.equal(model.lastCall.inputTokens, 100);
});

test('Gemini extraction uses all invoice fields and preserves exact decimal strings', async () => {
  const fields = Object.fromEntries(FIELD_NAMES.map((key) => [key, key === 'amount' ? '12.345678' : null]));
  const model = new GeminiModel({ apiKey: 'fixture', fetcher: async (_, opts) => {
    assert.deepEqual(JSON.parse(opts.body).response_format.schema.required, FIELD_NAMES);
    return response(envelope(fields));
  } });
  assert.deepEqual(await model.propose('extract', { untrustedInvoiceText: 'Amount: 12.345678' }), fields);
});

test('Gemini thought signatures are ignored while the single final output is validated', async () => {
  const body = envelope(); body.steps.unshift({ type: 'thought', signature: 'synthetic-hidden-signature' });
  const model = new GeminiModel({ apiKey: 'fixture', fetcher: async () => response(body) });
  assert.deepEqual(await model.propose('interpret', {}), proposal);
  assert(!JSON.stringify(model).includes('synthetic-hidden-signature'));
});

test('Gemini auth, quota and provider failures disclose no raw provider message and do not retry', async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    let calls = 0;
    const model = new GeminiModel({ apiKey: 'fixture', fetcher: async () => {
      calls++; return new Response('secret-provider-body', { status });
    } });
    await assert.rejects(model.propose('interpret', {}), (error) => !error.message.includes('secret-provider-body') && /Nothing was executed/.test(error.message));
    assert.equal(calls, 1); assert.equal(model.lastCall, null);
  }
});

test('Gemini rejects blocked, incomplete, tool-call, mixed, invalid-schema and oversized responses', async () => {
  const mixed = envelope(); mixed.steps[0].content.push({ type: 'text', text: '{}' });
  for (const body of [null, { status: 'failed' }, { ...envelope(), status: 'incomplete' }, { ...envelope(), steps: [] },
    { ...envelope(), steps: [{ type: 'function_call', name: 'payBill' }] }, mixed, envelope({ ...proposal, scope: 'unknown' }),
    { ...envelope(), steps: [{ type: 'model_output', content: [{ type: 'text', text: 'not JSON' }] }] }]) {
    const model = new GeminiModel({ apiKey: 'fixture', fetcher: async () => response(body) });
    await assert.rejects(model.propose('interpret', {})); assert.equal(model.lastCall, null);
  }
  const model = new GeminiModel({ apiKey: 'fixture', fetcher: async () => new Response('x'.repeat(200001)) });
  await assert.rejects(model.propose('interpret', {}), /failed/);
});

test('Gemini rejects missing key, unsupported paid model, oversized and secret-shaped inputs before fetch', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; throw new Error('Should not send'); };
  await assert.rejects(new GeminiModel({ apiKey: '', fetcher }).propose('interpret', {}), /not configured/);
  await assert.rejects(new GeminiModel({ apiKey: 'fixture', model: 'gemini-4-argon', fetcher }).propose('interpret', {}), /only gemini-3.8-flash/);
  const model = new GeminiModel({ apiKey: 'fixture', fetcher });
  await assert.rejects(model.propose('unknown', {}), /Unsupported/);
  await assert.rejects(model.propose('extract', { text: 'x'.repeat(50001) }), /Too much/);
  for (const key of [`AIza${'X'.repeat(35)}`, `AQ.${'x'.repeat(45)}`]) {
    assert.throws(() => rejectSecrets(key), /Do not send/);
    await assert.rejects(model.propose('interpret', { message: key }), /Do not send/);
  }
  assert.equal(calls, 0);
});

test('Gemini timeout aborts once without retries', async () => {
  let calls = 0;
  const model = new GeminiModel({ apiKey: 'fixture', timeoutMs: 5, fetcher: async (_, opts) => {
    calls++; return new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(new Error('private transport error')), { once: true }));
  } });
  const keeper = setTimeout(() => {}, 50);
  try { await assert.rejects(model.propose('interpret', {}), /timed out/); assert.equal(calls, 1); }
  finally { clearTimeout(keeper); }
});

test('provider selection is explicit, Gemini stays unconfigured without key and no fallback occurs', () => {
  assert.equal(createModel({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: '' }).mode, 'model-unconfigured');
  assert.equal(createModel({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'fixture' }).mode, 'live-gemini');
  assert.equal(createModel({ AI_PROVIDER: 'openai', OPENAI_API_KEY: '', OPENAI_MODEL: '' }).mode, 'model-unconfigured');
  assert.throws(() => createModel({ AI_PROVIDER: 'unknown' }), /Unknown AI_PROVIDER/);
});
