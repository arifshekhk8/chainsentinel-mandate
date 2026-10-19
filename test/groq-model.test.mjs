import test from 'node:test';
import assert from 'node:assert/strict';
import { GroqModel, createModel, rejectSecrets, PROMPT_VERSION } from '../app/model.mjs';
import { FIELD_NAMES } from '../app/intake.mjs';

const proposal = { intent: 'status', scope: 'selected', billIds: [], question: '', correction: null };
const envelope = (value = proposal) => ({ model: 'openai/gpt-oss-120b', choices: [{ finish_reason: 'stop',
  message: { role: 'assistant', content: JSON.stringify(value) } }], usage: { prompt_tokens: 100, completion_tokens: 80,
    completion_tokens_details: { reasoning_tokens: 40 } } });
const response = (body = envelope()) => new Response(JSON.stringify(body));

test('Groq sends pinned strict stateless proposals with a private header and no tools/reasoning output', async () => {
  let calls = 0;
  const model = new GroqModel({ apiKey: 'synthetic-private-token', fetcher: async (url, opts) => {
    calls++; assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(opts.headers.authorization, 'Bearer synthetic-private-token');
    assert.equal(opts.redirect, 'error'); assert(opts.signal instanceof AbortSignal);
    const body = JSON.parse(opts.body);
    assert.equal(body.model, 'openai/gpt-oss-120b'); assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true); assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    assert.equal(body.messages[0].role, 'system'); assert(body.messages[0].content.includes(PROMPT_VERSION));
    assert.equal(body.messages[1].role, 'user'); assert.equal(body.temperature, 0.2);
    assert.equal(body.reasoning_effort, 'low'); assert.equal(body.include_reasoning, false); assert.equal(body.max_completion_tokens, 2000);
    assert.equal(body.tools, undefined); assert.equal(body.store, undefined); assert.equal(body.stream, false);
    assert(!opts.body.includes('synthetic-private-token')); assert(!JSON.stringify(model).includes('synthetic-private-token'));
    return response();
  } });
  assert.deepEqual(await model.propose('interpret', { message: 'Show bills.' }), proposal);
  assert.equal(calls, 1); assert.equal(model.lastCall.provider, 'groq'); assert.equal(model.lastCall.thoughtTokens, 40);
});

test('Groq extraction uses every field and retains exact money strings', async () => {
  const fields = Object.fromEntries(FIELD_NAMES.map((key) => [key, key === 'amount' ? '0.000001' : null]));
  const model = new GroqModel({ apiKey: 'fixture', fetcher: async (_, opts) => {
    assert.deepEqual(JSON.parse(opts.body).response_format.json_schema.schema.required, FIELD_NAMES);
    return response(envelope(fields));
  } });
  assert.deepEqual(await model.propose('extract', { untrustedInvoiceText: 'Amount: 0.000001' }), fields);
});

test('Groq auth/quota/outage errors hide provider content and never retry or fall back', async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    let calls = 0;
    const model = new GroqModel({ apiKey: 'fixture', fetcher: async () => { calls++; return new Response('private-provider-diagnostic', { status }); } });
    await assert.rejects(model.propose('interpret', {}), (e) => e.status === 503 && /Nothing was executed/.test(e.message) && !e.message.includes('private-provider'));
    assert.equal(calls, 1); assert.equal(model.lastCall, null);
  }
});

test('Groq rejects alternate models, truncation, tools, refusals, malformed JSON and invalid fields', async () => {
  const alternatives = [null, { ...envelope(), model: 'alternate' }, { ...envelope(), choices: [] },
    { ...envelope(), choices: [...envelope().choices, ...envelope().choices] },
    ...['length', 'tool_calls', 'content_filter'].map((finish_reason) => ({ ...envelope(), choices: [{ ...envelope().choices[0], finish_reason }] })),
    ...[{ refusal: 'no' }, { tool_calls: [{ function: { name: 'payBill' } }] }, { function_call: {} }, { content: 'not JSON' }, { role: 'user' }]
      .map((overrides) => ({ ...envelope(), choices: [{ finish_reason: 'stop', message: { ...envelope().choices[0].message, ...overrides } }] })),
    envelope({ ...proposal, scope: 'unexpected' })];
  for (const body of alternatives) {
    const model = new GroqModel({ apiKey: 'fixture', fetcher: async () => response(body) });
    await assert.rejects(model.propose('interpret', {})); assert.equal(model.lastCall, null);
  }
  await assert.rejects(new GroqModel({ apiKey: 'fixture', fetcher: async () => new Response('x'.repeat(200001)) }).propose('interpret', {}), /failed/);
});

test('provider JSON validation failures are safe proposal misses without echoing failed generation', async () => {
  const model = new GroqModel({ apiKey: 'fixture', fetcher: async () => new Response(JSON.stringify({ error: {
    code: 'json_validate_failed', message: 'private-provider-content', failed_generation: 'private-untrusted-output' } }), { status: 400 }) });
  await assert.rejects(model.propose('interpret', {}), (e) => e.status === 502 && /invalid structured proposal/.test(e.message) && !e.message.includes('private'));
  assert.equal(model.lastCall, null);
});

test('Groq ignores unrequested reasoning text and records only safe usage metadata', async () => {
  const body = envelope(); body.choices[0].message.reasoning = 'synthetic-private-reasoning';
  const model = new GroqModel({ apiKey: 'fixture', fetcher: async () => response(body) });
  await model.propose('interpret', {});
  assert(!JSON.stringify(model).includes('synthetic-private-reasoning'));
});

test('missing key, unpinned model, secrets and oversized input stop before network', async () => {
  let calls = 0; const fetcher = async () => { calls++; throw new Error('Should not send'); };
  await assert.rejects(new GroqModel({ apiKey: '', fetcher }).propose('interpret', {}), /not configured/);
  await assert.rejects(new GroqModel({ apiKey: 'fixture', model: 'unapproved-model', fetcher }).propose('interpret', {}), /only openai\/gpt-oss-120b/);
  const secret = `gsk_${'X'.repeat(40)}`;
  assert.throws(() => rejectSecrets(secret), /Do not send/);
  const model = new GroqModel({ apiKey: 'fixture', fetcher });
  await assert.rejects(model.propose('extract', { text: secret }), /Do not send/);
  await assert.rejects(model.propose('extract', { text: 'x'.repeat(50001) }), /Too much/);
  await assert.rejects(model.propose('other', {}), /Unsupported/);
  assert.equal(calls, 0);
});

test('Groq timeout aborts one request and leaves manual review available', async () => {
  let calls = 0;
  const model = new GroqModel({ apiKey: 'fixture', timeoutMs: 5, fetcher: async (_, opts) => {
    calls++; return new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(new Error('private network error')), { once: true }));
  } });
  const keeper = setTimeout(() => {}, 50);
  try { await assert.rejects(model.propose('interpret', {}), /timed out/); assert.equal(calls, 1); }
  finally { clearTimeout(keeper); }
});

test('Groq is explicitly selected and never borrows another provider key', () => {
  assert.equal(createModel({ AI_PROVIDER: 'groq', GROQ_API_KEY: '' }).mode, 'model-unconfigured');
  assert.equal(createModel({ AI_PROVIDER: 'groq', GROQ_API_KEY: 'fixture' }).mode, 'live-groq');
  assert.equal(createModel({ AI_PROVIDER: 'groq', GEMINI_API_KEY: 'fixture', OPENAI_API_KEY: 'fixture' }).mode, 'model-unconfigured');
});
