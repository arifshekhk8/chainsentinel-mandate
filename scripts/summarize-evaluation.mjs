import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { formatUnits } from 'ethers';
import { summarize, scoreMoney } from './evaluate.mjs';

const path = process.argv[2];
assert(path, 'Provide a completed live-result JSON path. This command makes no API calls.');
const bytes = await readFile(path), run = JSON.parse(bytes), bookBytes = await readFile('demo/cases.json'), book = JSON.parse(bookBytes);
const sha = (v) => createHash('sha256').update(v).digest('hex');
assert.equal(run.evidenceType, 'fixed-live-model-evaluation-local-chain');
assert(run.finishedAt, 'The live invocation is still running.');
assert.equal(sha(bookBytes), run.frozenSettings.sourceFiles['demo/cases.json']);
assert.deepEqual(summarize(run), run.summary);
const proofs = [], outcomeChecks = [], interpretationAdjustments = [];
for (const row of run.cases) {
  const definition = book.evaluation_cases.find((c) => c.id === row.id);
  assert(definition, 'Unknown case ID in evidence.');
  if (!row.observed) continue;
  const score = scoreMoney(definition, row.observed);
  assert.equal(row.unauthorized, score.unauthorized);
  assert.equal(row.observed.recipientDeltas.reduce((n, value) => n + BigInt(value), 0n).toString(), row.observed.outflow);
  if (BigInt(row.observed.outflow) > 0n) assert(row.replayAttempt === 'rejected'
    || row.checkpoints?.some((c) => c.originalReceiptRecovered === true && c.noResend === true), 'A paid case needs replay rejection or original-hash no-resend recovery evidence.');
  const proposals = run.calls.filter((c) => c.caseId === row.id && c.kind === 'interpret' && c.proposal);
  assert.equal(proposals.length, row.turns?.length ?? 0, 'Interpretation evidence and application turns differ.');
  proposals.forEach((call, i) => {
    const turn = row.turns[i];
    if (call.proposal.intent !== turn.intent) interpretationAdjustments.push({ caseId: row.id, turn: i + 1,
      rawModelIntent: call.proposal.intent, applicationIntent: turn.intent, rawQuestion: call.proposal.question,
      applicationQuestion: turn.question ?? null });
  });
  for (const p of row.observed.payments.filter((p) => p.status === 'confirmed')) {
    const proof = p.receipt;
    assert.equal(proof.status, 1); assert.equal(proof.chainId, 31337); assert.equal(proof.hash, p.hash);
    for (const name of ['amount', 'recipient', 'billKey']) assert.equal(proof.payment[name], p[name]);
    assert(proof.payment.token && proof.vault && Number.isSafeInteger(proof.blockNumber));
    proofs.push({ caseId: row.id, hash: p.hash, chainId: proof.chainId, vault: proof.vault, token: proof.payment.token,
      recipient: p.recipient, billKey: p.billKey, amount: p.amount, block: proof.blockNumber, gas: proof.gasUsed });
  }
  outcomeChecks.push({ id: row.id, partition: row.partition, finished: Boolean(row.attemptFinished), correct: Boolean(row.correct),
    explanationCorrect: Boolean(row.explanationCorrect), outflow: row.observed.outflow, error: row.error ?? null });
}
const ordinary = run.cases.filter((r) => r.partition === 'ordinary');
assert.equal(new Set(proofs.map((p) => p.hash)).size, proofs.length, 'Claimed payment receipt hashes must be unique.');
const manual = ordinary.filter((r) => r.manualComparison);
const actions = ordinary.flatMap((r) => r.ownerActions ?? []);
const security = run.cases.filter((r) => r.partition === 'exception' && r.securityComparison);
const sum = (list, field) => list.reduce((n, item) => n + item[field], 0);
const median = (values) => { const v = values.sort((a,b) => a-b); return v.length ? v[Math.floor(v.length/2)] : null; };
const analysis = {
  resultPath: path, resultSha256: sha(bytes), version: run.version, startedAt: run.startedAt, finishedAt: run.finishedAt,
  summary: run.summary, humanStudy: false, publicTestnetEvidence: false,
  evaluationLabel: run.frozenSettings.contextRepair?.evaluationLabel ?? run.frozenSettings.promptRepair?.evaluationLabel ?? 'Frozen fixed-case evaluation',
  interpretationAdjustments,
  replayAndRecovery: { rejectedUsedPlans: run.cases.filter((r) => r.replayAttempt === 'rejected').length,
    originalHashRecoveredWithoutResend: run.cases.filter((r) => r.checkpoints?.some((c) => c.originalReceiptRecovered === true && c.noResend === true)).length },
  modelUsage: { calls: run.calls.length, failedCalls: run.calls.filter((c) => c.error).length,
    inputTokens: sum(run.calls.filter((c) => c.inputTokens !== undefined), 'inputTokens'),
    outputTokensIncludingReasoning: sum(run.calls.filter((c) => c.outputTokens !== undefined), 'outputTokens'),
    reasoningTokensSubset: sum(run.calls.filter((c) => c.thoughtTokens !== undefined), 'thoughtTokens'),
    medianSuccessfulCallMs: median(run.calls.filter((c) => !c.error).map((c) => c.elapsedMs)) },
  manualComparison: { sampleCases: manual.length, intendedTasks: 'same ordinary case tasks, including any model completion misses',
    manualDeclaredSourceReviews: sum(manual.map((r) => r.manualComparison), 'billReviewsRequired'),
    agentFreshSourceReviewStamps: actions.filter((a) => a.action === 'source review').length,
    sourceReviewCaveat: 'Already-paid N13 has no new agent approval/review stamp; manual baseline declares a source review. These counts are not perfectly matched.',
    manualOwnerPaymentSignatures: sum(manual.map((r) => r.manualComparison), 'ownerPaymentSignatures'),
    agentOwnerApprovalSignatures: actions.filter((a) => a.action === 'batch approval signature').length,
    agentConfirmations: actions.filter((a) => /confirmation/.test(a.action)).length,
    agentConversationTurns: ordinary.reduce((n, r) => n + (r.turns?.length ?? 0), 0),
    agentDraftCorrections: ordinary.flatMap((r) => r.turns ?? []).filter((t) => t.intent === 'correct').length,
    actionCaveat: 'Recorded source reviews, signatures and confirmations are distinct from conversation turns. These are harness action counts, not observed human effort.',
    manualExecutionMedianMs: median(manual.map((r) => r.manualComparison.executionElapsedMs)),
    agentRequestExecutionMedianMs: median(ordinary.filter((r) => r.agentElapsedMs !== undefined).map((r) => r.agentElapsedMs)),
    timingCaveat: 'Automation only. Agent timing includes model/pacing; manual timing excludes human review/signing and setup. Do not claim human time savings.',
    setupExcluded: true },
  hostileComparison: { sampleCases: security.length, unauthorizedVirtualTransfers: sum(security.map((r) => r.securityComparison), 'unauthorizedSimulatedTransfers'),
    outcomesDiffer: security.filter((r) => r.securityComparison.protectedConfirmedBaseUnits !== r.securityComparison.unprotectedOffchainPlanBaseUnits).map((r) => r.id),
    conclusion: 'Matching safe off-chain plans do not establish an incremental contract benefit. Direct bypass is tested separately. Contract-disabled comparisons use no actual token/vault calls.' },
  interactions: run.cases.filter((r) => r.interaction).map((r) => ({ caseId: r.id, interactionId: r.interaction, pass: Boolean(r.interactionPass),
    turns: r.turns?.length ?? 0, intents: r.turns?.map((t) => t.intent) ?? [], ownerActions: r.ownerActions?.length ?? 0, checkpoints: r.checkpoints ?? [] })),
  outcomeChecks, proofs,
  paymentTotalMDT: formatUnits(proofs.reduce((n,p) => n + BigInt(p.amount), 0n), 6),
  paymentGas: proofs.reduce((n,p) => n + BigInt(p.gas), 0n).toString(),
};
const output = path.replace(/\.json$/, '-analysis.json');
await writeFile(output, JSON.stringify(analysis, null, 2) + '\n');
console.log(JSON.stringify({ analysis: output, summary: analysis.summary, verifiedReceipts: proofs.length,
  manualComparison: analysis.manualComparison, hostileComparison: analysis.hostileComparison, interactions: analysis.interactions }, null, 2));
