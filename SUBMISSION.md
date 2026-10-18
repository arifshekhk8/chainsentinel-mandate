# Mandate — reviewer and submission guide

**Team:** ChainSentinel. **Event:** 2026 Shenzhen International FinTech Competition, International Track. **Topic:** F — Agent Wallet. **Repository:** [arifshekhk8/chainsentinel-mandate](https://github.com/arifshekhk8/chainsentinel-mandate), private. **Snapshot date:** 18 October 2026, Asia/Dhaka.

This repository contains the local prototype, reproducible tests, synthetic fixtures and existing local receipts. The [live Gemini/browser/local-payment workflow](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md) passes; measured agent evaluation and public evidence remain pending. Earlier [Gemini development checks](evidence/STEP4_GEMINI_RESULTS.md) retain their original limitations. Use this guide to inspect the source package; do not describe the current snapshot as a finished competition submission.

## Review route

1. Read [README.md](README.md) for the business problem, current limitations and clean-clone setup. The normal test batch pays 350 MDT and leaves 650; the contract blocks excess daily spending.
2. Inspect [ARCHITECTURE.md](ARCHITECTURE.md) and [MandateVault.sol](contracts/MandateVault.sol): owner signatures grant exact authority, the model only proposes, and the restricted agent calls `payBill(key,version)`.
3. Read [SECURITY.md](SECURITY.md) and the [test/evidence index](TESTING.md#saved-evidence-index). Check local receipts and their matching event fields. Local hashes are not public explorer evidence.
4. Reproduce the source checks and local tests using [README's commands](README.md#run-checks-and-the-contract-demonstration), or inspect the [automated workflow runs](https://github.com/arifshekhk8/chainsentinel-mandate/actions). CI needs no API key, real wallet or public RPC service.
5. For an interactive review, follow the owner upload/review/approval flow and **Preview without AI**. Explicit owner approval and Resume are needed before the agent can pay. Fresh launches use a new local chain/session.

## Evidence and judging map

| Criterion | Current material | Evidence still needed |
| --- | --- | --- |
| Task completion — 40% | [Owner workflow](evidence/STEP3_RESULTS.md), [live browser/local batch](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md), reproducible source/tests | Fixed evaluation and organizer-accepted public receipts |
| Security/compliance — 30% | [Contract checks](evidence/STEP2_RESULTS.md), [security boundaries](SECURITY.md), [queue/recovery checks](evidence/STEP4_RESULTS.md) | Measured live hostile cases, final self-assessment and authorized public stop/replay demonstration |
| Innovation/interaction — 30% | [Orbit Studio scenario](demo/SCENARIO.md), controlled clarification/correction/fallback traces | All six live interaction cases and matched manual/security comparisons |

The recorded Step 4 local results are 58 contract, four identity, 33 intake/owner, 38 agent and 12 browser checks. Repository verification added two server-shutdown regressions, making the current `test:app` suite **35 checks**. Earlier step reports overlap these totals; they are not extra independent evaluation cases. Gemini integration subsequently passed 46 agent and 13 browser regressions, plus seven live development tasks across attempts; [provider errors and limits](evidence/STEP4_GEMINI_RESULTS.md) are disclosed. The 40-case dataset is separate and unexecuted. Test adapters/mock transport do not establish live-model accuracy. No guaranteed score or finalist-selection claim is made.

## Remaining submission checklist

- [ ] Complete team registration privately and retain the organizer acknowledgment; choose/confirm the leader and all required member details.
- [ ] Obtain organizer clarification before claiming that Sepolia alone satisfies Topic F evidence rules.
- [x] Complete live app/payment review: [10 passing workflow checks](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md), seven real model calls, two exact local receipts; failures and safe metadata preserved.
- [ ] Replace any key shared in chat only in local configuration; confirm the API project stays on Free tier.
- [ ] Freeze and execute [the 40-case set](demo/cases.json), measure results against [TESTING.md](TESTING.md#fixed-evaluation-set-and-targets) and complete both matched comparisons. Fix or disclose misses.
- [ ] With explicit authorization, collect public evidence with chain/vault/token/recipient/amount/bill references, successful receipts and revocation/replay demonstrations.
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
