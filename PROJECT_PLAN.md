# Mandate project plan

**Product:** an AI wallet agent that pays approved business bills within the owner's rules. **Status:** Step 4 local implementation/checks ready; live AI verification deferred by the user. Public evidence remains later work. See [contract results](evidence/STEP2_RESULTS.md), [owner-workflow results](evidence/STEP3_RESULTS.md) and [agent results](evidence/STEP4_RESULTS.md).

The owner approves a group of bills and payment rules once. The agent plans eligible payments, preserves a minimum token balance, explains exceptions and produces receipts. Blockchain code checks permission independently before every payment.

## Goal and competition fit

Deliver a small working Topic F project with evidence of useful payments, safe rejection and owner control. The published scoring is 40% task completion, 30% security/compliance and 30% innovation/interaction; see [competition requirements](competition/requirements.md).

Our contribution is the complete bill workflow and measured protection against changed bills, duplicate payments and unsafe payment plans. We do not claim that wallet spending limits are new or that this project guarantees selection.

## Judging criteria and planned evidence

| Official criterion | What Mandate must show | Requirements and tests | Evidence for judges |
| --- | --- | --- | --- |
| Task completion — 40% | A live agent handles an approved batch and reports exact, confirmed outcomes | R01–R11; F01–F06; C01–C06 | Full task trace, measured completion results, balances and matching public transaction receipts |
| Security/compliance — 30% | Induced transfers, information extraction, privilege changes and invoice instructions cannot expand authority | R03–R09, R12–R14; F06–F08; C01–C06 | Attack cases, direct contract bypass attempts, revocation tests, privacy/key-handling notes and disclosed limits |
| Innovation/interaction — 30% | A useful business workflow; efficient questions; corrections; clear explanations and recovery | R02, R10, R11, R15; F04, F06, F09 | Comparison with manual processing, six interaction cases, one correction/recovery in the demo and a specific statement of what is useful |

Verified against the [official International Track rules](https://fintechathon.g-ican.com/#/en/rule) and [published rulebook](https://www.pol.cmu.ac.th/public/blog/attachment/download/7a51866a-4cee-42b5-9187-fa4e1f4df411) on 17 October 2026. These are evidence goals, not predicted marks. Treat the optional 0–5 challenge/implementation bonus as a possible extra; base the project on all three main criteria.

The user selected a fictional online agency for Step 1. [Orbit Studio's scenario](demo/SCENARIO.md) assumes on-chain supplier payments and explains why delegated permission is useful. The prototype uses test tokens and does not establish real adoption or replace ordinary bank payments.

## Scope

Must have: one business, one vault, one demo token, owner-approved vendors and exact bill details, payment limits, minimum reserve, permission expiry, revocation, bill checks, due-date planning, explanations and verified receipts. Use CSV and text-based PDFs, up to 5 MB per file. Unclear fields require owner review.

Later only if the core passes: scanned-document OCR, recurring bills and additional file types. Marketplace services, escrow/refunds, trading, yield strategies, bridges, mainnet, real funds and multiple businesses are outside this version.

Read [REQUIREMENTS.md](REQUIREMENTS.md) for pass conditions, [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, and [TESTING.md](TESTING.md) for evidence.

## Steps and completion checks

| Step | Meaningful result | Tasks in order | Done when |
| --- | --- | --- | --- |
| 0 — Planning | One connected plan | Create the seven documents; remove the rejected plan; check links and consistency | Documents exist; implementation is clearly marked not started |
| 1 — Agree the demo and prepare registration | Fixed scope and a concrete example | Confirm target business, owner workflow, sample bills/rules and six interaction cases; confirm team eligibility; prepare registration and a question about Sepolia evidence | User accepts the scenario, acceptance/evidence map and baseline comparisons; registration actions and unresolved questions are recorded |
| 2 — Prove the contract rules locally | Payments cannot bypass permissions | Set up the minimal project; implement the demo token and vault; test approval, payment, limits, duplicate protection, expiry, cancellation and revocation | All mandatory contract tests in TESTING.md pass; one permitted local payment has a verified receipt |
| 3 — Build bill review and owner approval | Owner can review and approve a batch | Add upload handling, draft fields, trusted vendor records, duplicate warnings, policy form and browser-wallet approval | Owner sees exact details before signing; approval is confirmed on-chain; unsigned/changed drafts cannot execute |
| 4 — Connect the AI and payment workflow | Agent handles an approved batch | Add live model extraction/planning, clarification/correction, exact rule checks, ordered queue, simulation, execution and receipt-grounded explanations | A normal batch completes without repeated owner signing; ambiguous/read-only requests do not pay; corrections and blocked outcomes have correct next actions |
| 5 — Test and collect Sepolia evidence | Measured behavior and public receipts | Run the fixed evaluation set; fix failures; with user authorization deploy to Sepolia; repeat the key scenarios and verify receipts | Security gate passes; measured report is saved; public receipts identify chain, contract, token, amount and bill reference |
| 6 — Prepare and submit | Reviewable competition package | Freeze features; create report, presentation, video and evidence index; rehearse; check submission checklist | User has reviewed the final package; submission is sent only when explicitly instructed; acknowledgment/status is recorded |

Complete one step before starting the next. Registration acknowledgment and organizer clarification may remain pending while unrelated local work proceeds. Do not present unresolved testnet eligibility as settled.

**Step 4 implementation status:** local agent/executor and test-adapter interaction checks are implemented. The user chose “Prepare it now; test live AI later.” Keep live-model extraction/conversation checks pending; local scripted tests do not satisfy that part of the completion check. See [Step 4 results](evidence/STEP4_RESULTS.md). Step 5 has not started.

**Session handoff, 17 October:** paused for the night at the user's request. Resume on 18 October only when the user returns; start with the [dated checklist](PROGRESS.md#resume-on-18-october-2026). No overnight work is scheduled.

## Step 1 review package

Read [demo/SCENARIO.md](demo/SCENARIO.md) for the business, exact rules, bills, identity rules and expected outcomes. [demo/cases.json](demo/cases.json) contains five demo bills and 40 candidate evaluation cases, including the six interaction cases. The user started Step 2 using this baseline. The 40 agent cases remain unexecuted; freeze the set before agent evaluation. Contract tests and scripted local receipt evidence are separate checks.

The normal batch pays 200 + 150 from 1,000 MDT, leaving 650 MDT and 50 of the 400 daily budget. Keep a 300 reserve and 250 per-bill cap. Use separate fixtures for reserve and revocation failures. These are project settings, not competition rules.

[Registration drafts](competition/REGISTRATION_DRAFT.md) record team ChainSentinel and the four reported full-time Bangladeshi members: two from IUBAT, one from BRAC and one from Jagannath University. The user selected the team name; the leader and individual form details remain pending. The scenario is the baseline for the authorized Step 2 work. Nothing has been submitted.

## Daily milestones

All dates and times below use Bangladesh time (Asia/Dhaka). Updated at the 17 October handoff. Future targets depend on completing the previous step and any required user authorization.

| Date | Target |
| --- | --- |
| 17 October 2026 — completed locally | Planning/scope, contract core, owner workflow and Step 4 local implementation/checks; registration and live AI still pending |
| 18 October — first work after return | Review Step 4, configure/test live AI when ready, record corrections/failures; prepare registration and the organizer question privately. Start Step 5 evaluation only after the live checks and user instruction |
| 19 October — target | Finish evaluation/comparisons; collect explicitly authorized public-testnet evidence; prepare the report, slides and video |
| 20 October — target | Finish/review/rehearse Step 6; aim for a reviewable package by 18:00; submit only on explicit instruction before 21:59 |

The printed deadline is 20 October, 23:59 Beijing = 21:59 Bangladesh. [IEEE](https://www.ieee-cis-singapore.org/2026-fintechathon) also warns registration may close early. Keep the earlier printed time where website wording differs.

## Priorities and submission deliverables

**P0:** registration readiness, owner permissions, live AI planning, required clarification/recovery, exact execution, duplicate/revocation tests, real evidence and truthful reporting. **P1:** smoother invoice review and scheduling controls beyond the required ordering. **P2:** visual polish and optional input support. Cut P2 first; preserve all three judging categories and every P0 safeguard. Reducing an agreed requirement needs the user's approval.

- Working source repository, setup README and pinned dependency versions.
- Technical report: problem, architecture, agent workflow, contract design, deployment and measured results.
- English presentation supporting a talk of no more than 10 minutes.
- English demonstration video of no more than 5 minutes.
- Security assessment, limitations, evaluation report and case definitions.
- Evidence index with public transaction hashes, receipts and exact deployment addresses; label local evidence separately.
- Completed registration and submission records, kept private where they contain identity documents.

Prepare the full set because published sources differ about optional materials; details and template links remain in [competition/requirements.md](competition/requirements.md).
