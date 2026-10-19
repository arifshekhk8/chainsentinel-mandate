# Mandate requirements

**Document review, 19 October 2026:** current behavior and Step 5 evidence were checked against the source. [Full isolated local review](evidence/maintenance/2026-10-19/full-review/results.json) passed; [the evidence index](evidence/README.md) and [relocation map](evidence/locations.json) describe the organized folders. Raw measured records and all 47 frozen source files remain unchanged. Step 6 is deferred.

This file defines required application behavior. [competition/requirements.md](competition/requirements.md) contains event rules. Local contract, owner-workflow and agent/executor checks are recorded in [PROGRESS.md](PROGRESS.md). The [Gemini browser/local-payment workflow](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md) passes. On 19 October the user additionally authorized Groq Free; the fixed evaluation has versioned attempts and a regression after diagnosis/repair. Check current progress for completion status. Public setup evidence is verified; exact public payments and unmined replay/daily-limit rejections are verified; revocation/stop and the final export are verified. Step 5 is complete within its documented scope. Acceptance targets are unchanged.

**Current verification, 19 October:** all seven Sepolia setup actions are verified with the user's actual MetaMask confirmations. The vault is funded and active after verified Resume; the separate agent is funded. [Public setup report](evidence/STEP5_SEPOLIA_RESULTS.md). The three sample drafts match their parsed synthetic source and trusted recipients; owner review stamps and all three on-chain approvals are verified. Their exact signed public batch approval is now verified ([receipt and state](evidence/sepolia/public/step5-sepolia-bill-approval-verification.json)); the separate [Resume receipt/state](evidence/sepolia/public/step5-sepolia-resume-verification.json) is also verified. The user-confirmed batch has since paid exact 200 + 150 MDT; [Public payment and read-only rejection evidence](evidence/sepolia/public/step5-sepolia-payment-verification.json) verifies the matching receipts/transfers, 650 MDT balance, 50 daily allowance and read-only duplicate/daily-limit rejections. Revocation is now confirmed with the agent/window cleared at policy version 7 and OnlyAgent decoded in an unmined call; the public call also overlaps the remaining daily limit. Clean eligible revocation is separate local evidence. Unmined simulations are not mined failed transactions. Acceptance targets remain unchanged.

**Historical handoff, 17 October:** work was paused until the user's return. Documentation cleanup did not count as a new test pass.

## User flows

1. **Set rules:** owner connects a test wallet, selects the fixed demo token, approves vendor recipients, sets spending limits/reserve, and grants an agent permission until a chosen time.
2. **Review bills:** owner uploads CSV or a text-based PDF. The agent proposes fields. The owner checks the vendor, invoice number, recipient, amount and payment window against the original before approving a batch on-chain.
3. **Plan and pay:** owner asks to process approved bills. The agent considers due dates and available budget, simulates eligible payments and executes through the restricted agent key. It waits or asks when a bill cannot be paid. Read-only questions do not initiate payments; unclear payment requests require clarification.
4. **Check outcomes:** owner sees confirmed payments, remaining budget and a clear reason/action for every unpaid bill.
5. **Stop access:** owner cancels an unpaid bill or revokes/pauses the agent. The dashboard waits for chain confirmation before reporting that the change is active.

## Measurable acceptance criteria

| ID | Required behavior and pass condition | Test group |
| --- | --- | --- |
| R01 | Accept valid CSV/text PDFs up to 5 MB; reject unsupported, oversized or malformed files with a clear message. No required field is silently guessed. | F01 |
| R02 | Present original source text beside critical draft fields. Missing/ambiguous fields stop approval; currency must map explicitly to the supported demo token. | F01, F02 |
| R03 | Vendor recipients come from owner-controlled records. An address in an invoice cannot update that record or permission. Mismatches require fresh owner review. | F02, C02 |
| R04 | Owner reviews and signs exact bill approvals. Chain state stores a stable bill key, recipient, amount and payment window. UI reports approval only after a successful receipt. | F03, C01 |
| R05 | Only the configured agent may execute; the contract reads recipient/amount from the approved bill. Every tested attempt to change these or use an unapproved bill fails. | C01, C02 |
| R06 | Successful spending stays within the per-bill limit, daily limit and minimum reserve. Use integer token units; test below, equal to and above every boundary. | C03 |
| R07 | A paid bill key cannot be paid again, including retries and a renamed/reformatted copy with the same verified vendor and invoice number. Possible semantic duplicates with changed identifiers are flagged for review, not guaranteed detectable. | F02, F06, C04 |
| R08 | Before the allowed start time, at/after expiry, after confirmed cancellation, or after confirmed revocation/pause, execution fails without a token transfer. | C05 |
| R09 | Changed owner permissions invalidate pending plans. Re-read chain state and re-simulate before sending; the contract rejects a stale policy version. | F06, C06 |
| R10 | Process eligible bills in the defined order: owner priority, due date, then stable bill key. Explain each defer/block with a checked reason and next action. Do not change owner rules to make a plan fit. | F04 |
| R11 | Mark paid only after a successful receipt and matching payment event. Pending, reverted and unknown-outcome transactions remain distinct; a timeout never triggers a blind second payment. | F05, F06 |
| R12 | No approval or rule change can be created by model output or hidden invoice instructions. Adversarial cases cause zero unauthorized token transfers in the defined test set. | F07, C02–C06 |
| R13 | Owner key stays in the browser wallet. Agent/API secrets and original invoices never appear in public evidence or model tool responses containing secrets. Only synthetic data is used in the prototype evaluation. | F08 |
| R14 | Application/deployment checks reject mainnet and unexpected chain/token settings. Model-off mode is labeled scripted; local and Sepolia receipts are labeled separately. | F08 |
| R15 | Pass all six defined interaction cases: understand ordinary wording; clarify missing/ambiguous details in one focused question; apply a correction without changing signed approval; give a useful response to unsupported requests; and explain recoverable tool failures. Read-only/unclear requests cause zero transfers. | F09 |

## Definition of a completed payment

The receipt must succeed on the expected chain and vault, and its event must match the approved bill key, recipient, token and exact amount. Record the transaction hash and block. Gas is a separate ETH expense, not part of the demo-token reserve or daily bill budget.

Use the evaluation targets in [TESTING.md](TESTING.md). A feature is done only when its acceptance checks pass and the result is recorded in [PROGRESS.md](PROGRESS.md).

[Revocation and stopped-agent verification](evidence/sepolia/public/step5-sepolia-revocation-verification.json) confirms agent/address window cleared at policy version 7, 650 MDT preserved and an unmined OnlyAgent rejection. [Final export verification](evidence/sepolia/public/step5-sepolia-export-verification.json) rechecks all 13 original hashes (11 owner transactions including one revert, two exact agent payments). Step 5 is complete within its documented prototype scope; known answer-quality and public-simulation limits remain disclosed. Step 6 awaits the user’s instruction. [Public execution export](evidence/sepolia/public/step5-sepolia-2026-10-19T15-52-14-777Z.json).

## Current verification boundaries

| Requirements | Existing local evidence | Still pending |
| --- | --- | --- |
| R01–R04 | Intake, live PDF field assistance/apply/review, trusted vendors and exact browser/local approvals; Groq v5 fixed regression has 156/156 exact critical fields across 26 synthetic CSV invoices; actual MetaMask setup/vendor actions verified | Public bill source reviews and exact owner-wallet approval are now verified; exact 350 MDT public execution is verified. General OCR and untouched held-out accuracy are not established |
| R05–R09 | Contract permissions/limits/replay/stop tests and local executor state checks | Exact public payments/limits and duplicate rejection simulation verified; confirmed revocation/OnlyAgent simulation and final export are verified; the public stopped bill also exceeds its remaining daily budget, so clean eligible isolation remains local evidence |
| R10–R12 | Live browser plan, exact local batch/receipts, deferred reasons, stale/replayed plans and injected-failure recovery; [Groq v5 measurement](evidence/STEP5_GROQ_RESULTS.md) has 19/20 ordinary completions, 20/20 exception explanations, zero unauthorized transfers and 27 verified local receipts | Matched comparisons are reported with limitations; exact public receipts/balances/deferral are verified; revocation/final export are verified within the separately recorded public scope |
| R13–R14 | Live provider/backend-key checks; separate private Sepolia agent storage, chain/code pins, fee/outflow caps and local recovery tests; actual owner-confirmed deployment/funding on Sepolia verified | Public payment, confirmed revocation/OnlyAgent simulation and final export are verified; setup extension observations are not a universal compatibility test |
| R15 | Live browser clarification/follow-up/correction and injected tool/provider failures; Groq v5 live regression passes all six interactions; context/reference/ordinary-wording regressions also pass offline. [Public read-only observation](evidence/sepolia/public/step5-sepolia-read-only-observation.json) causes no payment | Public answer-quality miss: eligible 350 MDT shown instead of requested approved total 425 MDT. [Public ambiguous clarification](evidence/sepolia/public/step5-sepolia-clarification-verification.json) is verified with no selection/payment; the [explicit 350 MDT payment plan](evidence/sepolia/public/step5-sepolia-payment-plan-verification.json) is independently verified; exact public execution/receipts are verified; confirmed revocation/OnlyAgent simulation and final export verified with scope limits disclosed; repaired fixed-case scope does not establish untouched held-out performance |

Start the next session with [PROGRESS.md's resume checklist](PROGRESS.md#resume-on-18-october-2026). Do not treat controlled test-adapter output as proof of live-model performance.

The remaining Step 5 integration now has [local preparation evidence](evidence/STEP5_SEPOLIA_PREPARATION.md) for R04–R14: exact setup reviews, durable wallet-request locking, conservative ETH budget, two-confirmation boundaries, replay/revocation and pinned testnet configuration. Seven public setup actions and actual owner MetaMask confirmations are now verified in the [public report](evidence/STEP5_SEPOLIA_RESULTS.md); exact public bill approval and Resume are verified, exact payments and read-only replay/daily-limit rejections are verified; revocation/stop and the final export are verified. Step 5 is complete within its documented scope. R15 and the 40-case metrics remain the historical v5 measurement; the integration did not rerun a live-model evaluation.
