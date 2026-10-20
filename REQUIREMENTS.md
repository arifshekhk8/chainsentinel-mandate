# Mandate requirements

Acceptance criteria R01–R15 for the implemented prototype. See [TESTING.md](TESTING.md) for checks and [the evidence index](evidence/README.md) for measured results.

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

[Revocation and stopped-agent verification](evidence/sepolia/public/step5-sepolia-revocation-verification.json) confirms agent/address window cleared at policy version 7, 650 MDT preserved and an unmined OnlyAgent rejection. [Final export verification](evidence/sepolia/public/step5-sepolia-export-verification.json) rechecks all 13 original hashes (11 owner transactions including one revert, two exact agent payments). Step 5 is complete within its documented prototype scope; known answer-quality and public-simulation limits remain disclosed. The later 20 October recorded payment and revocation are documented separately in [the follow-up](evidence/RECORDED_DEMO_RESULTS.md). [Public execution export](evidence/sepolia/public/step5-sepolia-2026-10-19T15-52-14-777Z.json).
