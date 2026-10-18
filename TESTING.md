# Mandate testing and demonstration

These checks cover [REQUIREMENTS.md](REQUIREMENTS.md). Steps 2–4 have local contract, intake, review, restricted-agent and browser checks. The user authorized Gemini live development checks on 18 October; [actual results](evidence/STEP4_GEMINI_RESULTS.md) are separate from the still-unexecuted 40-case agent evaluation. Commands, limitations and current status are recorded in [PROGRESS.md](PROGRESS.md).

**17 October handoff:** test results below are the recorded implementation results. This closing session checks documents, protected-file hashes and shutdown only; it does not rerun application tests or replace their evidence. On return, follow the [resume checklist](PROGRESS.md#resume-on-18-october-2026). Run new checks when changes/failures or the pending live integration require them.

## Repository checks and CI

The private source repository was prepared on 18 October. Run `npm run check:repo` after staging: it inspects tracked/indexed paths for local/private data and common credential patterns, verifies local Markdown file links and code fences, and checks that the blank organizer templates are unchanged. An isolated staged `.env` fixture was correctly rejected without printing its value. This is a guard plus human review, not a complete secret-detection guarantee.

[GitHub Actions](.github/workflows/checks.yml) runs the repository check, contract build/format/tests, identity, intake/owner, agent/recovery, browser bundle and 13 browser checks using Node 25.2.1/Ubuntu 24.04. It installs isolated Chromium with `CI=true`; local tests default to installed Chrome. Actions are pinned to immutable commits with read-only permissions and no persisted checkout credentials. No live API/wallet secret, model call or public-chain transaction is part of CI. Actual run status belongs to the [workflow record](https://github.com/arifshekhk8/chainsentinel-mandate/actions), not an assumed pass.

CI reruns overwrite only that temporary checkout's local test artifacts; the original committed evidence is not changed by a workflow run. These regressions are separate from the unexecuted 40-case live-agent evaluation. The reviewer path and remaining delivery items are in [SUBMISSION.md](SUBMISSION.md).

The first Linux browser run exposed a shutdown hang after a successful correction assertion: an unused speculative TCP connection was not covered by Node's HTTP idle-connection cleanup. The server now stops accepting connections, closes sockets that have never carried an HTTP request and lets active requests finish. Two new regression checks reproduce the unused connection and preserve active-response/idempotent-close behavior. `npm run test:app` now has **35 checks** (the earlier 33 plus these two); historical Step 3/4 reports keep their original counts. No test timeout was raised and no failing case was skipped.

## Saved evidence index

| Stage | Report and artifacts | Meaning |
| --- | --- | --- |
| Step 2 | [Contract results](evidence/STEP2_RESULTS.md), [payment receipts](evidence/step2-local-demo.json) | 58 contract checks, four identity checks and a separate scripted local payment demo |
| Step 3 | [Owner results](evidence/STEP3_RESULTS.md), [approval receipt](evidence/step3-owner-approval.json), [desktop](evidence/step3-desktop.png), [review](evidence/step3-review.png), [mobile](evidence/step3-mobile.png) | 33 intake/owner checks and seven browser checks; approval itself pays no tokens |
| Step 4 | [Agent results](evidence/STEP4_RESULTS.md), [payment receipts](evidence/step4-local-agent.json), [desktop](evidence/step4-agent-desktop.png), [mobile](evidence/step4-agent-mobile.png) | 38 agent checks and 12 total browser checks; the 12 include the seven owner checks. No live model used |
| Step 4 Gemini | [Integration results](evidence/STEP4_GEMINI_RESULTS.md), [safe live metadata](evidence/step4-gemini-live-check.json) | Seven live development tasks passed across attempts; 46 agent and 13 browser regressions. Provider failures disclosed; not fixed evaluation |
| Later | No fixed live-evaluation or Sepolia artifact yet | Keep pending; do not create empty reports or claim results |

All saved chain receipts are ephemeral local-chain evidence. Reports are historical by step; [PROGRESS.md](PROGRESS.md) gives the current status. Do not sum repeated regressions or fuzz trials as independent evaluation cases.

## Step 3 verification

Run `npm run test:app` for intake/API/storage/receipt checks and `npm run build:app` followed by `npm run test:ui` for browser checks. Tests start separate local chains; they do not connect the user's actual extension or a model.

- F01/F02: supported CSV/text PDFs; malformed, binary, oversized, ambiguous/repeated fields, missing values and unsupported currency/date; exact amounts; normalized duplicates and similar-ID review; changed recipients cannot update the registry.
- F03: source/field review, edits clearing review, exact batch preview, owner/network mismatch, signature rejection, pending and reverted transactions, stale versions and matching receipt events. A cancelled bill needs a fresh review before explicit re-approval. Existing permission is not silently revoked by editing a draft.
- F06/F08 subsets at Step 3: persist/reconcile original hashes after uncertainty, lock pending drafts, source removal, SQLite restart persistence, same-origin/CSRF and mainnet/RPC mismatch rejection, safe HTML rendering and deployment-code pinning. Step 4 adds payment-queue restart/concurrency and model/key handling below.
- Browser checks: two-bill batch approval; wrong wallet/network and rejection; pending mining; PDF correction and hostile HTML; exact rule changes; close-during-save regression; narrow-screen review. The test wallet implements EIP-1193 using local unlocked signers and must never be presented as an actual MetaMask session.

See [Step 3 results](evidence/STEP3_RESULTS.md), [approval receipt](evidence/step3-owner-approval.json) and the saved desktop/review/mobile screenshots. The Step 3 batch approves 200 + 150 MDT while leaving all 1,000 MDT in the vault; Steps 2 and 4 have separate local payment checks. None of these checks counts as the 40-case live-agent evaluation.

## Step 4 verification

Run `npm run test:agent` for 46 agent/transport/queue checks (the original 38 plus eight Gemini checks) and `npm run build:app` then `npm run test:ui` for 13 browser checks (seven owner-flow plus six agent checks). The new development examples are separate from the fixed 40 cases; expected evaluation labels are never sent to the model. Test adapters and mocked API transport are explicitly model-free.

- F04/F05: exact integer projections and fixed ordering; 200 + 150 MDT batch with verified receipts, 650 balance and 50 daily budget left; daily/reserve/per-bill, vendor, pause, cancellation and expiry reasons/actions.
- F06: simultaneous requests and executor objects, used-plan replay, stale drafts/policies, revocation between sends, pending locks, hash persistence before broadcast, accepted-but-unacknowledged sends, no-broadcast uncertainty, mined revert, wrong events/RPC outage and actual same-chain payment reconciliation after backend/store reopen. Recovery never sends again.
- F07/F08: model proposals cannot create permissions, change calldata or reference unknown bills; credentials are private backend fields; missing configuration, strict schema, refusal, incomplete/malformed output, timeout, safe errors, CSRF and linked-source removal. Contract tests independently cover direct bypass and token attacks.
- F09 development traces: ordinary wording, one focused clarification plus answer/context, read-only request even with a misclassified model output, explicit draft correction preserving signed permission, unsupported action and recoverable tool failure. These validate application handling of controlled proposals, **not** a live model's understanding.
- Browser traces: AI-off label/manual preview and exact batch, read-only/clarification, correction/review, stale owner stop, mobile layout and inert hostile text. Actual user extensions remain untested.

`npm run test:live` explicitly makes up to seven synthetic development calls: extraction, read-only, clarification, clarification answer, draft correction, unsupported authority and hostile-source extraction. Gemini requests are paced 12 seconds apart to reduce quota bursts; a failure stops without retry/fallback. Safe model/timing/token metadata goes to stdout; no transactions are sent. On 18 October all seven tasks passed across bounded attempts, with an intervening HTTP 503 and HTTP 429 disclosed in [Gemini results](evidence/STEP4_GEMINI_RESULTS.md). This is not one uninterrupted successful run, the 40-case evaluation or proof of full live-app/payment behavior. Free-tier availability depends on project settings/quota; the optional OpenAI provider is billed separately. The original [Step 4 results](evidence/STEP4_RESULTS.md) remain historical local evidence.

## Functional checks

| Group | Scenarios | Requirements |
| --- | --- | --- |
| F01 — Intake | Valid CSV/text PDF; malformed/oversized/unsupported file; unreadable field; wrong currency | R01, R02 |
| F02 — Review | Missing amount; ambiguous number; changed vendor address; duplicate with a new filename/layout; changed invoice ID requiring review | R02, R03, R07 |
| F03 — Owner approval | Review exact batch; reject signature; wrong wallet; failed/pending approval; edit approved draft | R04 |
| F04 — Planning | Priorities and due-date order; equal limits; insufficient daily budget; protected reserve; no eligible bills; correct explanation and next action | R06, R10 |
| F05 — Execution | One valid payment and batch processing; match token/amount/recipient/event; show real receipt and updated balances | R05, R11 |
| F06 — Recovery | Repeated click; simultaneous requests; restart after broadcast; timeout; revert; permissions changed between plan and send | R07, R09, R11 |
| F07 — Hostile content | Hidden instructions to raise limits, replace recipient, approve new bills, expose keys or report an unpaid bill as paid | R12 |
| F08 — Configuration/privacy | Unexpected chain/token; missing model key; scripted-mode label; secret/log scan; invalid origin; safe removal of source files; third-party license/source inventory | R13, R14 |
| F09 — Interaction | Six cases within the fixed evaluation set: ordinary wording; two ambiguous requests; corrected bill details; an unsupported request; a recoverable RPC/tool failure. Include a read-only question and check that it does not pay. Clarify once, then safely continue after the answer. | R02, R10, R11, R15 |

## Contract security checks

| Group | Required tests |
| --- | --- |
| C01 — Roles and approvals | Owner-only administration; agent-only execution; unapproved/cancelled bill rejection; exact stored amount/destination |
| C02 — Permission bypass | Direct calls bypassing the app; unauthorized recipient; changed bill fields; zero amount/address; disallowed call paths |
| C03 — Money boundaries | One unit below/at/above per-bill and daily caps; reserve equality/violation; insufficient balance; exact decimals; cumulative spending across sessions and UTC day rollover |
| C04 — Replay | Repeated bill payment; same transaction retried; concurrent attempts; re-approval cannot clear a paid key |
| C05 — Stop/time | Before allowed start; exact bill/session expiry; pause; cancellation; agent revocation/rotation; owner recovery only when paused |
| C06 — State integrity | Old policy version; policy change does not reset spending; token transfer failure/reentrancy attempt; no partial state changes; events match actual transfers |

Test each reason independently so an earlier check does not hide the condition under test. Assert expected error/state and token balances, not merely “the transaction failed.”

## Fixed evaluation set and targets

Create and version **40 synthetic cases: 20 ordinary and 20 hostile/exception cases**, with expected fields, approval status, payment outcome and explanation category. Critical extraction fields are vendor reference, invoice number, exact amount, currency, invoice date and due date; recipient permission comes from the owner-controlled registry. Separate prompt-development examples from these cases and freeze the set before reporting results. Record model, prompt version and reruns. Repeated runs are not new cases.

Step 1 prepared [candidate fixtures](demo/cases.json) and their [explanation](demo/SCENARIO.md); they are the accepted Step 2 baseline. Each agent case resets its starting state; none of the 40 agent cases has been executed. Freeze the candidate before agent evaluation. Step 2 reuses the ordinary demo bill records in a separate scripted contract demonstration; this is not live-model evaluation. Generate supported upload files during the intake-workflow step. Keep clock-boundary fixtures local and label public-network evidence separately.

| Metric | Planned acceptance target |
| --- | --- |
| Critical-field extraction | At least 95% exact field accuracy on the ordinary held-out cases; also report whole-bill accuracy and corrections |
| Ordinary task completion | At least 18/20 ordinary cases completed correctly with their expected receipt/state |
| Unauthorized or mismatched payments | Zero across all 40 evaluation cases and mandatory contract tests. Completion misses may be safe blocks/timeouts, never wrong payments; this is not a universal safety claim. |
| Replay and confirmed revocation | Every mandatory test passes; no duplicate transfer or post-revocation execution |
| Explanation correctness | At least 18/20 exception explanations name the checked cause and a valid next action |
| Receipt evidence | Every claimed payment links to a matching successful receipt; no unknown outcome reported as paid |
| Useful interaction | All six F09 cases reach their expected safe outcome; count clarification turns and human actions. Read-only/unclear requests cause no transfer. |

The six F09 cases are tags on the existing 40 cases, not extra cases. Report approval corrections, human interventions, latency, API errors and gas separately. Model-free tests do not count as live-model evaluation.

Use two small comparisons: (1) manual per-bill processing of the same ordinary bills, counting owner actions and completion time; (2) the same AI with off-chain checks but contract protection disabled in an isolated simulation, using the same hostile cases. Keep inputs/model/settings matched and unsafe comparisons away from funds. Report each sample size and observed results; this is a controlled workflow comparison, not proof of adoption or market-wide superiority.

Count invoice review, corrections and approval actions in both workflows, and report one-time setup separately. Bulk approval and AI help different parts of the workflow; do not attribute every saved action to AI. If the comparison shows no improvement, report that result rather than changing cases to force a positive outcome.

## Five-minute demonstration

1. **0:00–0:35:** explain the business problem; show owner rules and approved bills.
2. **0:35–1:10:** give an unclear request; show one useful question, the answer and a valid plan.
3. **1:10–2:10:** pay the two ordinary bills; show actual receipt links and remaining budget.
4. **2:10–3:35:** show a duplicate, changed recipient and reserve/limit failure. Demonstrate contract rejection or lack of authority and a clear next action.
5. **3:35–4:15:** owner revokes permission; a later execution is rejected. Show safe recovery from a recorded failed/unknown transaction outcome where practical.
6. **4:15–5:00:** show measured results, manual-processing comparison, evidence links and limitations. The separate six-case trace covers corrections and other interaction behavior.

Use short independent fixtures for limit/reserve tests. Clearly label recorded footage, synthetic documents, demo assets and the network. Do not fabricate a blockchain response to fit the video.

## Release gate

All mandatory contract tests pass; no unresolved unauthorized-transfer, duplicate-payment or secret-exposure issue remains; evaluation targets/results are reported honestly; the public demo is replayed successfully; setup works from documented instructions. A target miss is recorded and fixed or disclosed, never silently removed. Obtain organizer clarification before claiming Sepolia alone satisfies Topic F evidence requirements.
