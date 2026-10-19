# Mandate — reviewer and submission guide

**Document review, 19 October 2026:** current behavior and Step 5 evidence were checked against the source. [Full isolated local review](evidence/maintenance/2026-10-19/full-review/results.json) passed; [the evidence index](evidence/README.md) and [relocation map](evidence/locations.json) describe the organized folders. Raw measured records and all 47 frozen source files remain unchanged. Step 6 is deferred.

**Team:** ChainSentinel. **Event:** 2026 Shenzhen International FinTech Competition, International Track. **Topic:** F — Agent Wallet. **Repository:** [arifshekhk8/chainsentinel-mandate](https://github.com/arifshekhk8/chainsentinel-mandate), private. **Snapshot date:** 19 October 2026, Asia/Dhaka.

This repository contains the local prototype, reproducible tests, synthetic fixtures and existing local receipts. The [live Gemini/browser/local-payment workflow](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md) passes. The [current Groq report](evidence/STEP5_GROQ_RESULTS.md) preserves all measured failures and repairs. The repaired 40-case local regression is complete: 19/20 ordinary tasks, 20/20 exception explanations, 6/6 interactions and zero wrong transfers; [Public Sepolia setup](evidence/STEP5_SEPOLIA_RESULTS.md) is verified; exact public bill approvals and Resume are also verified; exact public payments and read-only replay/daily-limit rejections are verified; owner revocation/stop and the final export are verified; Step 5 is complete within its documented scope. This follows observed repairs, not untouched held-out testing. The original [Gemini partial attempt](evidence/STEP5_EVALUATION_RESULTS.md) remains independent. Earlier [Gemini development checks](evidence/STEP4_GEMINI_RESULTS.md) retain their original limitations. Registration was sent on 19 October; acknowledgment is pending. This snapshot is not a finished competition submission.

## Review route

1. Read [README.md](README.md) for the business problem, current limitations and clean-clone setup. The normal test batch pays 350 MDT and leaves 650; the contract blocks excess daily spending.
2. Inspect [ARCHITECTURE.md](ARCHITECTURE.md) and [MandateVault.sol](contracts/MandateVault.sol): owner signatures grant exact authority, the model only proposes, and the restricted agent calls `payBill(key,version)`.
3. Read [SECURITY.md](SECURITY.md) and the [test/evidence index](TESTING.md#saved-evidence-index). Check local receipts and their matching event fields, then the separate [public Sepolia setup receipts](evidence/STEP5_SEPOLIA_RESULTS.md). Local hashes are not public explorer evidence; setup receipts are not supplier-payment proof.
4. Reproduce the source checks and local tests using [README's commands](README.md#run-checks-and-the-contract-demonstration), or inspect the [automated workflow runs](https://github.com/arifshekhk8/chainsentinel-mandate/actions). CI needs no API key, real wallet or public RPC service.
5. For an interactive review, follow the owner upload/review/approval flow and **Preview without AI**. Explicit owner approval and Resume are needed before the agent can pay. Fresh launches use a new local chain/session.

## Evidence and judging map

| Criterion | Current material | Evidence still needed |
| --- | --- | --- |
| Task completion — 40% | [Owner workflow](evidence/STEP3_RESULTS.md), [live local batch](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md), [40-case regression and receipt checks](evidence/STEP5_GROQ_RESULTS.md) | Organizer-accepted public receipts; final package |
| Security/compliance — 30% | [Contract checks](evidence/STEP2_RESULTS.md), [security boundaries](SECURITY.md), [queue/recovery checks](evidence/STEP4_RESULTS.md), [20 live exception cases and matched simulation](evidence/STEP5_GROQ_RESULTS.md) | Final self-assessment and authorized public stop/replay demonstration |
| Innovation/interaction — 30% | [Orbit Studio scenario](demo/SCENARIO.md), [all six live interaction cases and measured comparisons](evidence/STEP5_GROQ_RESULTS.md) | Final report/presentation/video; no human-productivity benefit is established |

The recorded Step 4 local results are 58 contract, four identity, 33 intake/owner, 38 agent and 12 browser checks. Repository verification added two server-shutdown regressions, making the current `test:app` suite **35 checks**. Earlier step reports overlap these totals; they are not extra independent evaluation cases. Gemini integration subsequently passed 46 agent and 13 browser regressions, plus seven live development tasks across attempts; [provider errors and limits](evidence/STEP4_GEMINI_RESULTS.md) are disclosed. Step 5 rechecked all 58 contract tests and added nine evaluator checks; all 40 fixture setups passed. Groq's repaired v5 run completed all 40 cases with 19/20 ordinary tasks, 20/20 exception explanations, 156/156 fields, 6/6 interactions and zero wrong transfers. All 27 local receipts were checked; earlier failures and the safe N13 miss remain disclosed. The later Sepolia integration passes 11 preparation, 59 agent, 35 app, 19 browser and nine evaluator checks; these overlap earlier totals. Test adapters/mock transport do not establish live-model accuracy. No guaranteed score or finalist-selection claim is made.

[Live read-only observation](evidence/sepolia/public/step5-sepolia-read-only-observation.json): no payment occurred, but the answer showed 350 MDT eligible rather than the requested 425 MDT approved total. This is a disclosed answer-quality miss, not a fully correct response. Source and payment guards are unchanged. [Ambiguous-invoice clarification](evidence/sepolia/public/step5-sepolia-clarification-verification.json) is verified with a focused question, no bill selected and no payment attempted. The [explicit payment plan](evidence/sepolia/public/step5-sepolia-payment-plan-verification.json) is independently verified; the user has since confirmed execution and [Public payment and read-only rejection evidence](evidence/sepolia/public/step5-sepolia-payment-verification.json) verifies the exact 350 MDT batch and unmined duplicate/daily-limit rejections. Owner revocation/stop and the final export are verified; Step 5 is complete within its documented scope.

[Revocation and stopped-agent verification](evidence/sepolia/public/step5-sepolia-revocation-verification.json) confirms agent/address window cleared at policy version 7, 650 MDT preserved and an unmined OnlyAgent rejection. [Final export verification](evidence/sepolia/public/step5-sepolia-export-verification.json) rechecks all 13 original hashes (11 owner transactions including one revert, two exact agent payments). Step 5 is complete within its documented prototype scope; known answer-quality and public-simulation limits remain disclosed. Step 6 awaits the user’s instruction. [Public execution export](evidence/sepolia/public/step5-sepolia-2026-10-19T15-52-14-777Z.json).

## Remaining submission checklist

- [x] Complete/review team registration and verify the seven-file package in Gmail Sent (19 October, 11:55 Bangladesh time); private evidence retained.
- [ ] Retain organizer acknowledgment/acceptance when received.
- [ ] Obtain organizer clarification before claiming that Sepolia alone satisfies Topic F evidence rules.
- [x] Complete live app/payment review: [10 passing workflow checks](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md), seven real model calls, two exact local receipts; failures and safe metadata preserved.
- [ ] Replace any key shared in chat only in local configuration; confirm the API project stays on Free tier.
- [x] Freeze and execute [the 40-case set](demo/cases.json), measure numeric thresholds and both comparisons; [report repairs, misses and limits](evidence/STEP5_GROQ_RESULTS.md). Untouched held-out performance is not established.
- [x] Prepare and locally rehearse [the Sepolia setup, fee budget and recovery workflow](evidence/STEP5_SEPOLIA_PREPARATION.md).
- [x] Under the user's explicit 0.001 ETH cap, verify all seven setup actions and actual owner MetaMask confirmations; retain [public setup receipts, failed-attempt recovery and costs](evidence/STEP5_SEPOLIA_RESULTS.md).
- [x] Load three synthetic sample drafts and verify exact source fields and owner-registry recipients; [intake evidence](evidence/sepolia/public/step5-sepolia-sample-intake-verification.json). Owner review stamps are now verified ([evidence](evidence/sepolia/public/step5-sepolia-owner-review-verification.json)); [Exact signed batch approval](evidence/sepolia/public/step5-sepolia-bill-approval-verification.json) is now verified for all three bills; exact 200 + 150 MDT payment is now verified, leaving 650 MDT and the 75 MDT bill unpaid.
- [x] Finish the already authorized payment workflow with exact chain/vault/token/recipient/amount/bill references, successful receipts and revocation/replay evidence. Setup, exact bill approvals and [Resume](evidence/sepolia/public/step5-sepolia-resume-verification.json) are complete; exact public payments and unmined replay/daily-limit rejections are verified; owner revocation/stop and the final export are verified; Step 5 is complete within its documented scope.
- [ ] Complete the technical report, security self-assessment, English presentation (up to 10 minutes) and English video (up to 5 minutes). Follow the [organizer checklist/templates](competition/requirements.md#submission-checklist).
- [ ] Check third-party code/data credits and required team/model-use declarations against the final organizer requirements. Retain dependency licenses and original source references.
- [ ] Review and freeze the final source commit; verify a clean checkout, passing checks and consistency between the report, video, evaluation and receipts.
- [ ] Arrange the accepted reviewer-access method without making this repository public. Review the final package before sending; record submission acknowledgment after an explicit instruction to submit.

The preserved deadline is **20 October 2026, 21:59 Asia/Dhaka** (23:59 Beijing). The repository is a source component of the eventual entry, not its registration or submission record.

## Private access and source handover

Keep the repository private. A private URL requires access; do not assume an organizer can open it. Once the accepted delivery method is confirmed, the owner can authorize the required reviewer accounts or provide an accepted source archive. No reviewer invitations, emails, registration or project publication were performed as part of repository setup.

For a final source archive after review, run this from the checkout, replacing `HEAD` with the agreed final commit/tag if necessary:

```sh
git rev-parse HEAD
git archive --format=zip --output=../mandate-source.zip HEAD
```

The archive contains committed source only. It excludes `.git`, dependencies, generated builds and ignored `.env`, `local-data/` and `competition/private/` data. Confirm that the recipient accepts this format. A source archive does not replace reports, media or public transaction evidence.

## Team development

Use focused branches and pull requests for later changes. Describe the behavior and relevant checks; keep commit messages plain and meaningful. Preserve the configured human Git identity and omit AI co-author trailers as requested. The initial commits import the existing local prototype on 18 October; they are not a backdated development history.

Keep keys and real invoices out of Git. Complete the registration form in an ignored private copy, not the tracked blank template. Run `npm run check:repo` after staging and inspect the staged diff before each push. Follow [AGENTS.md](AGENTS.md) and [PROGRESS.md](PROGRESS.md) to stay within the currently authorized step.
