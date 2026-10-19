# Mandate project plan

**Document review, 19 October 2026:** current behavior and Step 5 evidence were checked against the source. [Full isolated local review](evidence/maintenance/2026-10-19/full-review/results.json) passed; [the evidence index](evidence/README.md) and [relocation map](evidence/locations.json) describe the organized folders. Raw measured records and all 47 frozen source files remain unchanged. Step 6 is deferred.

**Product:** an AI wallet agent that pays approved business bills within the owner's rules. **Status, 19 October:** Step 4 and Step 5 local evaluation are complete; all seven Sepolia setup actions are now verified after manual MetaMask confirmations. The three exact public bill approvals and separate Resume are now verified; the two exact public payments and read-only replay/daily-limit rejections are also verified; owner revocation/stop and final export are now verified. Step 5 is complete within its documented scope. [Public setup status and receipts](evidence/STEP5_SEPOLIA_RESULTS.md). Step 6 has not started. See [live local workflow](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md), [contract results](evidence/STEP2_RESULTS.md), [owner-workflow results](evidence/STEP3_RESULTS.md) and [agent results](evidence/STEP4_RESULTS.md).

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

**Step 4 implementation status:** complete for the local prototype. The [live browser/Gemini/local-chain review](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md) passed 10 checks and seven real model calls, including explicit confirmation, exact 350 MDT payment, correction/stale-plan protection and injected-failure recovery. Earlier [development attempts](evidence/STEP4_GEMINI_RESULTS.md) remain recorded. Step 5 local evaluation was authorized on 19 October. The first Gemini attempt stopped on quota; the user then explicitly authorized Groq Free. [The current report](evidence/STEP5_GROQ_RESULTS.md) records the completed repaired Groq regression: all 40 measured, 19/20 ordinary tasks, 20/20 exception explanations, 6/6 interactions and zero unauthorized transfers, with 27 verified local receipts. Earlier failures and the repaired fixed-case scope are disclosed. The unchanged cases and each source/model version are separately frozen. See [current progress](PROGRESS.md) for completion status. The user subsequently started the remaining Step 5. [Sepolia preparation](evidence/STEP5_SEPOLIA_PREPARATION.md) is locally checked. The user subsequently authorized the setup/payment demo within 0.001 ETH and manually confirmed all seven setup actions; [public receipts and wallet observations](evidence/STEP5_SEPOLIA_RESULTS.md) are verified. The existing owner app has three synthetic drafts with verified owner source reviews. The signed three-bill approval and separate Resume are now verified; the public batch has since paid 200 + 150 MDT, leaving 650 MDT, 50 daily allowance and the 75 MDT bill unpaid. Read-only no-payment safety is verified, with an answer-quality miss: the preview gives 350 MDT eligible rather than the requested 425 MDT approved total. [Public observation](evidence/sepolia/public/step5-sepolia-read-only-observation.json). [Ambiguous clarification](evidence/sepolia/public/step5-sepolia-clarification-verification.json) is verified with no selected bills or payments. The [explicit payment plan](evidence/sepolia/public/step5-sepolia-payment-plan-verification.json) is verified (200 + 150 MDT, 75 deferred, projected balance 650); the user has since confirmed execution and [Public payment and read-only rejection evidence](evidence/sepolia/public/step5-sepolia-payment-verification.json) verifies both payments and duplicate/daily-limit rejection simulations. Owner revocation and the final export are verified; Step 5 is complete within its documented scope.

**Session handoff, 17 October:** paused for the night at the user's request. Resume on 18 October only when the user returns; start with the [dated checklist](PROGRESS.md#resume-on-18-october-2026). No overnight work is scheduled.

**18 October repository task:** the user returned and explicitly requested a private competition repository with meaningful commits/pushes and no AI co-author tags. The source is at [arifshekhk8/chainsentinel-mandate](https://github.com/arifshekhk8/chainsentinel-mandate); [SUBMISSION.md](SUBMISSION.md) gives the reviewer route, access boundary and remaining package checklist. Repository preparation does not mark live AI, evaluation, public evidence, registration or Step 6 submission complete.

[Revocation and stopped-agent verification](evidence/sepolia/public/step5-sepolia-revocation-verification.json) confirms agent/address window cleared at policy version 7, 650 MDT preserved and an unmined OnlyAgent rejection. [Final export verification](evidence/sepolia/public/step5-sepolia-export-verification.json) rechecks all 13 original hashes (11 owner transactions including one revert, two exact agent payments). Step 5 is complete within its documented prototype scope; known answer-quality and public-simulation limits remain disclosed. Step 6 awaits the user’s instruction. [Public execution export](evidence/sepolia/public/step5-sepolia-2026-10-19T15-52-14-777Z.json).

## Step 1 review package

Read [demo/SCENARIO.md](demo/SCENARIO.md) for the business, exact rules, bills, identity rules and expected outcomes. [demo/cases.json](demo/cases.json) contains five demo bills and 40 evaluation cases, including the six interaction cases. The user started Step 2 using this baseline. The cases were frozen unchanged before Step 5's first live evaluation on 19 October. Contract tests and scripted local receipt evidence remain separate checks.

The normal batch pays 200 + 150 from 1,000 MDT, leaving 650 MDT and 50 of the 400 daily budget. Keep a 300 reserve and 250 per-bill cap. Use separate fixtures for reserve and revocation failures. These are project settings, not competition rules.

[Registration record](competition/REGISTRATION_DRAFT.md): ChainSentinel's final three-member package was reviewed and verified in Gmail Sent on 19 October at 11:55 Bangladesh time. The user is leader; two members are from IUBAT and one from Jagannath University. Completed personal details, signature and six supporting images remain private. Organizer acknowledgment is pending; final project submission is separate.

## Daily milestones

All dates and times below use Bangladesh time (Asia/Dhaka). Updated at the 17 October handoff. Future targets depend on completing the previous step and any required user authorization.

| Date | Target |
| --- | --- |
| 17 October 2026 — completed locally | Planning/scope, contract core, owner workflow and Step 4 local implementation/checks; registration and live AI still pending |
| 18 October — completed local Step 4 | Connected Gemini; passed live browser/local payment review and saved failures/receipts. Registration and the organizer question remain pending. Begin Step 5 evaluation after the next user instruction |
| 19 October — target | Finish evaluation/comparisons; collect explicitly authorized public-testnet evidence; prepare the report, slides and video |
| 20 October — target | Finish/review/rehearse Step 6; aim for a reviewable package by 18:00; submit only on explicit instruction before 21:59 |

The printed deadline is 20 October, 23:59 Beijing = 21:59 Bangladesh. [IEEE](https://www.ieee-cis-singapore.org/2026-fintechathon) also warns registration may close early. Keep the earlier printed time where website wording differs.

## Tonight's completion order — 19 October

The user requires a finished project tonight, leaving 20 October for submission and any corrections. **Target: a reviewable complete package by 23:30 tonight.** The original estimates below were made at about 16:25 Asia/Dhaka and have overrun: seven-step setup and public bill execution are now verified; owner revocation/stop and the final export are verified; Step 5 is complete within its documented scope. The public approval/payment/stop evidence and export are complete within their recorded scope; begin Step 6 when instructed. The original slot times are historical estimates, not current completion claims or a guarantee. Freeze optional feature work and preserve the measured N13 limitation.

| Bangladesh time | Remaining work | Reviewable result |
| --- | --- | --- |
| 16:30–19:00 | Finish Step 5 public-testnet workflow, actual browser-wallet verification and permitted/rejected payment scenarios | Deployment addresses, exact public receipts/explorer links, balances, replay/stop evidence and reproducible launch instructions |
| 19:00–20:15 | Step 6 technical report, security self-assessment and execution-evidence document | English files using official templates, measured results/limits, architecture, provider/dependency credits and real evidence |
| 20:15–21:15 | Presentation and demonstration rehearsal | English slide deck supporting a talk of at most 10 minutes; fixed demo sequence |
| 21:15–22:30 | Record and check the English demo video | Video of at most 5 minutes showing the working flow, useful conversation, payment receipt and owner control |
| 22:30–23:30 | Freeze the package and verify delivery | Reviewed source/README, appropriate release checks, private source-access method/archive, working links, no credentials/identity leakage, ready-to-submit file set |

Check organizer acknowledgment, acceptance of Sepolia evidence and the final submission channel during this work. The published on-chain evidence wording does not settle testnet acceptance. Do not assume that the registration email is also the final project-submission route. Do not claim a remote CI pass until a requested push has run successfully.

Scheduling Step 6 does not start it early. Finish the active step and follow the user's instruction to continue. Public deployment, transaction-sending wallet setup, repository push/reviewer invitations, publication and final submission retain their existing authorization boundaries. Prepare a concrete local deployment review before requesting approval for public transactions; never request an owner private key or seed phrase. If testnet setup overruns, disclose the delay and reassess this schedule rather than inventing evidence or weakening safeguards.

The verified printed deadline remains **20 October 2026, 21:59 Bangladesh** (23:59 Beijing). Aim to submit the reviewed package earlier on 20 October, retaining acknowledgment. Tonight's target avoids relying on the final hours.

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
