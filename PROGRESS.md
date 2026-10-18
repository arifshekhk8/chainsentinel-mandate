# Mandate progress

**Updated:** 18 October 2026, Asia/Dhaka. **Repository handover:** private competition source, automated checks and reviewer guide prepared under the user's explicit request for meaningful commits/multiple pushes and no AI co-author tags. **Repository:** [arifshekhk8/chainsentinel-mandate](https://github.com/arifshekhk8/chainsentinel-mandate), private, branch `main`. **Latest fully verified project step:** Step 4 — AI and executor, for the local prototype. The live Gemini/browser/local-chain workflow passed 10 checks with seven real model calls and two exact local payments; see [workflow results](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md). Fixed evaluation, actual extension testing and public evidence remain pending. The user explicitly authorized Gemini setup/testing on 18 October, superseding the earlier deferral. See [Gemini results](evidence/STEP4_GEMINI_RESULTS.md). Repository work does not authorize actual user-wallet operation, public blockchain deployment, email or registration submission.

## Resume on 18 October 2026

1. Read this file and [live workflow results](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md). Step 4 is complete locally: 10 browser/Gemini/payment checks, seven real model calls and two exact receipts in the passing run. One earlier harness dialog-wait failure is preserved. Existing offline suites remain 46 agent, 35 app, 13 browser, 58 contract and four identity checks; they were not repeated locally for this evidence. None of these is the fixed 40-case evaluation.
2. Help the user review the current local workflow. From this folder run `npm run build`, then `npm run dev`; open http://127.0.0.1:4173. Installed dependencies are retained. See [README](README.md#open-the-owner-review-app) for fresh setup and the owner approval/resume flow. A new launch creates a new local chain and agent key; old local approvals do not survive.
3. Gemini is configured locally with `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.8-flash` and a private key. Replace the key shared in chat in AI Studio and update only local `.env`; never paste its replacement here. Keep the project on Free tier. The smoke command sends no transactions; the separate explicit `npm run test:live-workflow` makes up to seven real model calls and disposable local test transactions. Existing results are saved; no routine rerun is needed.
4. Next is Step 5 when the user asks: freeze the 40-case set and model/prompt settings, run measured evaluation and matched comparisons, then prepare public evidence. Actual wallet use/public deployment still needs explicit authorization. Do not replace a failed target with an invented result.

**Separate priority for the team:** choose the leader, complete the registration form/supporting documents privately and review the existing registration/testnet-question drafts on 18 October. Nothing has been sent. The preserved deadline is 20 October, 21:59 Bangladesh time; the detailed source notes are in [competition requirements](competition/requirements.md).

The user returned on 18 October to prepare the private repository, then explicitly chose Gemini and authorized live testing. Only user-triggered work runs; no reminders, background jobs or automatic continuation are scheduled.

## Completed

- Identified the competition and Topic F requirements; preserved the poster, rulebook and current registration form.
- Organized the workspace and deleted the earlier unapproved prototype, dependencies and redundant research downloads.
- Selected Mandate for planning: approved business bills, independent contract checks, minimum reserve, payment priorities and clear explanations.
- Created the seven connected planning files and replaced the rejected ProofPay plan. See [PROJECT_PLAN.md](PROJECT_PLAN.md).
- Rechecked all seven files against the published judging criteria and current official rule-page content. Added an explicit evidence map, conversation checks, matched comparisons and a stronger no-wrong-payment condition.
- User selected the fictional-agency scenario. Prepared [Orbit Studio's demonstration](demo/SCENARIO.md), exact spending rules, five demo bills and expected outcomes.
- Prepared [40 candidate evaluation cases](demo/cases.json): 20 ordinary and 20 exception cases, including six conversation cases. These are unexecuted data fixtures; freeze the set after review, before evaluation.
- Recorded the user's team details: four full-time Bangladeshi students, two from IUBAT, one from BRAC and one from Jagannath University. The user selected ChainSentinel as the team name; the project remains Mandate.
- Prepared the [registration package draft](competition/REGISTRATION_DRAFT.md): project summary, registration email and separate question about Sepolia evidence. The official workbook remains unfilled; nothing has been sent.
- User started Step 2, accepting the prepared scope as the implementation baseline. Installed pinned local tools and implemented [MDT](contracts/MandateDemoToken.sol), the [vault](contracts/MandateVault.sol), identity hashing, security tests and a scripted local demonstration.
- Passed all 58 C01–C06 contract tests, including two fuzz tests with 512 trials each, plus four identity tests. Verified two actual local payment receipts and one mined local rejection; see [Step 2 results](evidence/STEP2_RESULTS.md) and [receipt evidence](evidence/step2-local-demo.json).
- User started Step 3 with “next step.” Built the responsive owner workspace, bounded CSV/text-PDF intake, local SQLite drafts, source/field review, duplicate warnings, vendor/rule/access controls and exact browser-wallet approval reviews.
- Passed 33 intake/owner/API/storage checks and seven isolated browser checks. Saved [Step 3 results](evidence/STEP3_RESULTS.md), [local approval receipt](evidence/step3-owner-approval.json) and desktop/review/mobile screenshots. Actual user-wallet extensions were not operated.
- User started Step 4 with “next step please,” then chose “Prepare it now; test live AI later.” Added structured OpenAI support, clarification context, explicit draft corrections, exact deterministic plans, confirmed batch execution, durable queue/hash storage and original-receipt recovery. No OpenAI call was made.
- Passed 38 agent/transport/queue development checks, 12 total browser checks, 33 intake/owner regressions, 58 contract regressions and four identity checks. See [Step 4 results](evidence/STEP4_RESULTS.md), [local payment proof](evidence/step4-local-agent.json) and [desktop](evidence/step4-agent-desktop.png)/[mobile](evidence/step4-agent-mobile.png) screenshots. New interaction cases use a scripted development adapter, not live AI or the fixed evaluation set.
- On 18 October, created the requested private GitHub repository and imported the existing prototype as an honest current-date baseline. Separate changes add automated repository/contract/application/browser checks and a competition reviewer guide. Commits use the configured `arif-shekh` identity with plain messages and no AI co-author trailers. The repository URL alone does not grant organizer access or submit the entry.
- Added [SUBMISSION.md](SUBMISSION.md), a reviewer-focused README, private registration-copy instructions, a pull-request template and a Git-index hygiene check. Local credentials/data/dependencies/builds remain excluded. The workflow uses immutable official action hashes, read-only permissions, Node 25.2.1 and isolated Chromium; no API/wallet secrets or live calls are required.

- On 18 October, added the requested Gemini connection, backend-only local configuration, provider labels, safe quota/auth/outage handling and Google key guards. Passed 46 agent checks, 35 app checks, 13 browser checks and the app build. Seven live synthetic development tasks passed across attempts; initial parser rejections and provider HTTP 503/429 are disclosed in [Gemini results](evidence/STEP4_GEMINI_RESULTS.md). No transaction was sent by live calls. The original OpenAI adapter remains an explicitly selected alternative.

- User requested the next step after Gemini setup. Completed live app/local-payment review: actual browser PDF extraction/apply, owner review/approval/Resume, live read-only/clarification/correction, stale-plan protection, injected RPC failure, fresh live plan/one confirmation, exact two-payment receipts, replay/recovery and injected provider failure/manual fallback. The passing run has 10 checks and seven real model calls; [run history and receipts](evidence/step4-live-workflow.json) retain the initial harness failure. No app source, contract, prompt, dependency or evaluation fixture changed.

The local contract, owner workspace and restricted payment workflow exist. Step 4 is complete for this local prototype with live Gemini and disposable local payments. Scripted development tests have executed real local approvals/payments. There is no public deployment or measured 40-case live-agent evaluation result.

## Current work

Step 4 is complete locally. The passing isolated browser/Gemini/local-chain run paid exactly 200 + 150 MDT, left 650 MDT and 50 MDT of the daily budget, and deferred the 75 MDT bill. Draft changes, stale/replayed plans and injected RPC/provider failures caused no extra transfer. The owner-action count stayed three before/after batch execution, so the batch required no extra owner signatures. Source, screenshot, safe run history and receipts are saved. All owned test services were closed; existing user drafts/wallets were not used.

Step 5 has not started. Next: the fixed 40-case evaluation and matched comparisons, on the user's next instruction. Registration, organizer clarification, actual extension testing and public evidence remain pending. No public deployment, registration or organizer message occurred.

## Step tracker

| Step | Status | Evidence / next dependency |
| --- | --- | --- |
| 0 — Planning | Complete | Seven documents and index checked; local links, IDs, steps and source-file checksums verified |
| 1 — Scope and registration | Scope agreed; registration pending | User started Step 2 using the prepared scenario, rules and casebook; private form completion and submission remain |
| 2 — Contract core | Complete, local only | C01–C06: 58 passing tests; four identity tests; verified scripted local receipts and no public actions |
| 3 — Owner workflow | Complete, local only | 33 intake/API/storage tests and seven browser tests; real local approval receipt; actual extension untested |
| 4 — AI and executor | Complete for local prototype with live Gemini | [10 passing workflow checks](evidence/STEP4_LIVE_WORKFLOW_RESULTS.md), seven real model calls and two exact local payment receipts; previous regressions/attempts preserved |
| 5 — Evaluation and Sepolia | Not started; next | Local prerequisite complete; await next user instruction for evaluation. Public actions need explicit authorization |
| 6 — Submission | Not started | Measured results and reviewable evidence package |

Source-repository preparation is complete independently of Step 6's final reports, media and submission. Use [SUBMISSION.md](SUBMISSION.md#remaining-submission-checklist) for that distinction.

## Decisions

- One business, one vault, one fixed demo token; local EVM and Sepolia only.
- Owner approves exact bill details in batches. The model proposes; it never grants authority or handles keys.
- The contract reads payment details from approval and enforces limits, reserve, time, paid markers and revocation independently.
- Stable bill identity uses verified vendor plus invoice number; filename/file hash alone is insufficient.
- Daily caps use UTC chain days. Gas is tracked separately in ETH.
- Begin with CSV/text PDFs and synthetic data. Scanned-document OCR is optional later.
- Use fictional Orbit Studio, with a 1,000 MDT starting balance, 250 per-bill cap, 400 per UTC day, 300 minimum reserve and revocable 24-hour agent permission. MDT has six decimal places. These are accepted demo settings, not competition rules.
- The normal demo batch pays 200 + 150 MDT, leaving 650 MDT and 50 MDT of the daily budget. Reserve and revocation demonstrations use separate fixtures so unrelated failures cannot mask the intended safeguard.
- Bill-key normalization trims outer ASCII whitespace and uppercases ASCII letters, preserving internal spaces and punctuation. Non-ASCII/confusable invoice numbers require review; amount and file hash do not define bill identity.
- Team name is ChainSentinel, selected by the user; product name remains Mandate. Recommend earlier registration because the official notice warns of early closure and allows up to 48 hours for confirmation; the user originally intended 19 October. This recommendation is not permission to submit.
- Pinned Forge/Anvil 1.7.1, Solidity 0.8.37 (Cancun, optimizer 200), OpenZeppelin Contracts 5.6.1 and ethers 6.17.0. No shell configuration changed. npm lockfile records package versions/integrity; Solidity uses Foundry's normal compiler cache.
- Vault owner/token are immutable; it starts paused. Vendor updates invalidate that vendor's older approvals. Cancelled unpaid bills can be explicitly re-approved; paid keys cannot. Owner recovery requires pause and never resets agent spending/paid history.
- Use the native-tool runner to preserve failure exit codes. Local demonstration rebuilds with the normal pinned profile before deploying and never accepts an external RPC URL.
- Step 3 uses plain ES modules/HTML/CSS and a Node HTTP server instead of the tentative TypeScript framework, with built-in SQLite, esbuild 0.28.2, csv-parse 7.0.3, PDF.js 6.4.299, pdf-lib 1.17.1 and Playwright 1.64.1. Exact versions/integrity are pinned.
- Source bytes are discarded after hashing/extraction; extracted text and drafts remain in restricted ignored local storage until removal. Deletion keeps opaque receipt references and does not cancel a chain approval. Draft edits and confirmed cancellations require review again before new approval.
- Test-only browser signing uses an EIP-1193 double backed by local Anvil signers. Optional public-address bootstrap uses local-only impersonation and stops it before user interaction. No private key is imported or read.
- Current AI choice is Gemini Interactions REST v1beta, pinned `gemini-3.8-flash`, low thinking and no thought summaries; opaque thought signatures are ignored. Optional OpenAI Responses remains explicitly selectable. Both use Node fetch, JSON Schema/local validation, `store: false`, a 20-second timeout and no tools, automatic retry or fallback. Gemini development access is verified; evaluation accuracy is not. Check Free tier in AI Studio; the server cannot establish project billing tier. Free-tier data may improve Google products, so only synthetic inputs are allowed.
- Request interpretation sees bill summaries and prior clarification only. Optional field assistance explicitly sends a single synthetic invoice's source. Applying a proposal edits only a draft and clears review. Owner signing remains the only way to change permission.
- Every batch requires one separate confirmation of exact eligible bills. Questions/unclear/unsupported requests cannot execute. AI-off manual preview is labeled scripted. Integer code orders by priority, due date and stable bill key; the model never computes spending authority.
- The local launcher now generates a separate random agent key in memory, funds local gas and never prints/saves it. The executor can sign only the pinned vault's `payBill` call. Hash/nonce persistence precedes broadcast. Recovery never resends or resumes automatically; original unknown/invalid outcomes retain a queue lock. Same-chain backend/store recovery is tested; restarting the launcher intentionally makes a new chain/session/key.
- Source deletion now removes linked AI proposals and invoice labels in payment records, retaining opaque receipt/approval fields. Provider processing and chain permissions cannot be undone by local deletion.
- ProofPay marketplace/escrow and GrantGuard are outside the chosen project.

## Open items and blockers

| Item | Known state | What it blocks |
| --- | --- | --- |
| Team and registration | ChainSentinel; four reported full-time Bangladeshi students; leader/private form details pending; not registered | Valid competition entry; does not prevent authorized local development |
| Sepolia evidence acceptance | Published wording asks for real on-chain hashes but is not explicit about testnets | Claiming the prototype meets final evidence rules; local development can proceed after authorization |
| Model access | Live Gemini/local browser workflow passed; earlier HTTP 503/429 disclosed; shared key needs local replacement | Free quota can interrupt the next measured evaluation |
| Wallet | User reports a funded test wallet; no wallet has been connected or controlled | Authorized public deployment in Step 5 |
| Actual wallet-extension verification | Local EIP-1193 browser tests passed; actual extension interaction was not authorized or performed | Claiming a real MetaMask session was tested; does not block the next local implementation step |
| Step 5 evaluation | Step 4 complete locally; fixed 40 cases unexecuted | Requires the next user instruction; public actions remain separately unauthorized |

Never request private keys in chat. Draft organizer questions and registration material when the relevant step is started; send nothing without an explicit instruction.

## Verification log

- Final planning checks passed after the judging review: local links/anchors and code fences; R01–R15 and F01–F09/C01–C06 references; all three judging categories; matching Steps 0–6; unchanged source-document checksums; no implementation files.
- At the planning-stage judging review, all three main categories were mapped to requirements, tests and submission evidence. Innovation/interaction needed stronger planned checks. Implementation and local results were added in later steps; live judging evidence remains pending.
- Added six interaction cases within the existing 40-case set, a manual-workflow comparison, a matched security comparison, zero-wrong-payment conditions across all evaluation cases, and third-party source/license checks. No business features or dependencies were added.
- Original rulebook and registration checksums match the preserved downloads. Rejected PLAN.md and prototype code/dependencies are absent.
- Step 1 data/document checks passed: 40 unique cases split 20/20, six interaction cases, exact decimal amounts and expected balances, limits/reserve for expected transfers, valid requirement/test references and local links. The project summary is 145 words. These checks validate the planned fixtures, not application behavior.
- Preserved rulebook/form checksums were rechecked after Step 1 preparation. No application source files were added.
- Team-name update checked: ChainSentinel is consistent across the six updated documents; obsolete team-name draft placeholders are removed, local links exist and original rulebook/form checksums remain unchanged. Scope was subsequently accepted when the user started Step 2.
- Step 2 commands passed: `npm run build`, `npm test` (58 tests, zero failures/skips; two fuzz tests at 512 trials each), `npm run test:identity` (four tests), `npm run format:check` and `npm run demo:local`.
- Local demo paid D01/D02 (200/150 MDT), verified chain/vault/token/recipient/amount/events and successful receipts, rejected normalized duplicate D01, and mined a status-0 daily-limit rejection for D03. Ending vault balance is 650 MDT, daily spend 350 MDT and daily allowance left 50 MDT. Evidence is ephemeral local Anvil only.
- Corrected Foundry's removed `testFail` naming pattern; all final tests pass. Fixed the npm tool wrapper's lost child exit status and verified failure propagation with a temporary deliberately failing test. No known contract test failure remains.
- Coverage diagnostic emitted source-anchor mapping warnings; percentages are not relied on or claimed. Intentional timestamp lint warnings and all prototype limitations are recorded in the results/security notes.
- Step 3 commands passed: `npm run build:app`; `npm run test:app` (33 passed, zero failures/skips); `npm run test:ui` (seven passed). Prior Step 2 contract sources/acceptance cases are unchanged; those historical results remain valid separate evidence.
- Step 3 local browser batch approved exact 200/150 MDT bills with matching receipt/events and no token payment: vault remains 1,000 MDT. Tests cover wrong owner/network, rejection, pending/reverted/unknown/mismatched receipts, stale edits, cancellation, duplicates, source removal, unsafe HTML, CSRF/origin and SQLite restart.
- Fixed the browser save/close race found in an initial test; a delayed-save regression passes. Inspected desktop/review/mobile screenshots. Local preview HTTP 200; in-app browser surface unavailable, so QA used isolated headless Chrome. No existing browser profile/wallet was accessed.
- Final Step 3 checks passed: Markdown links/anchors/fences, original rulebook/form checksums, lockfile/installed versions, two-bill approval proof, three screenshot artifacts, unchanged 40-case evaluation count and a basic secret-pattern scan. The preview process exited successfully and its ports 4173/8545 are closed.
- Step 4 commands passed: `npm run test:agent` (38 tests), `npm run test:ui` (12 tests), `npm run test:app` (33 tests), `npm test` (58 tests), `npm run test:identity` (four tests), and `npm run build:app`. No failure/skipped result is being counted as a pass.
- Step 4 local normal batch confirms exact 200/150 MDT payment events and balances, leaves 650 MDT with 50 daily allowance, and defers the 75 MDT bill. Scripted development interactions and mocked API boundaries are labeled separately from live performance. The 40 evaluation cases were neither executed nor supplied as model-development input.
- Recovery checks cover a pending receipt, accepted broadcast with a lost response, a signed hash never broadcast, a mined revert, wrong events/RPC outage, simultaneous executor objects and actual payment verification after backend/store reopen. Confirmed revocation between sends stops the second payment. Original unknown hashes are not retried.
- UI checks cover explicit confirmation, AI-off mode, read-only and clarification requests, corrections with fresh source review, stale owner stop and mobile/hostile text. Fixed the initial fault-injection fixture to target payment simulation rather than all snapshot reads; final tests pass. Inspected Step 4 desktop/mobile images.
- At the 17 October handoff, live-model checks and the 40-case evaluation had not run because the user deferred them. The later 18 October Gemini development checks are recorded separately below; the fixed evaluation remains pending. No API key or owner-wallet secret was requested in chat.
- Historical 17 October Step 4 checks: local launcher returned HTTP 200 with AI unconfigured, payments paused and a separate agent; the state response contained no credentials. Stopped the owned preview and verified ports 4173/8545 closed. Markdown links/fences, original rulebook/form checksums, local receipt amounts and a basic secret-pattern scan passed. The casebook remains `step1-candidate-v1`; full live checks and public actions remain pending.
- Public transactions and deployment: none.
- Closing handoff, 17 October: reviewed all 14 project Markdown files, corrected stale Step 4 references and setup instructions, refreshed the remaining dates/tasks and added the folder/evidence map. Removed only disposable browser build/test output and macOS metadata; preserved source, original competition files, test evidence, case definitions, installed tools and local drafts. Documentation/content checks are separate from the application test results above.
- Closing validation passed: 14 Markdown files, 160 local links/anchors and code fences; all 55 protected non-Markdown files unchanged, including source, original competition documents, dataset, receipts/screenshots and local drafts. R01–R15, the 40-case version and recorded test counts remain consistent. Ports 4173/8545 are closed. No application tests, API calls, wallet operations or external submissions were run during this closing session.
- Repository task, 18 October: GitHub privacy verified before the initial push; `main` tracks `origin/main`. Initial staged-file review excluded private/generated paths and credential patterns and verified original rulebook/form hashes. Contract build, browser bundle, Solidity format and four identity checks passed locally. The repository guard correctly rejected an isolated force-staged `.env` fixture without revealing its value.
- Automated checks are recorded in [GitHub Actions](https://github.com/arifshekhk8/chainsentinel-mandate/actions); use the actual run/commit status. CI regressions do not execute the 40-case evaluation, connect live AI, update saved evidence in the main checkout or deploy publicly.
- The first Linux run passed contract, identity, intake/owner and agent checks but timed out in browser-test shutdown after the correction assertions. Reproduced the unused-TCP-connection hang locally, fixed graceful connection cleanup and added two checks without skipping the browser case or extending its timeout. The app suite now contains 35 checks; older evidence reports correctly retain 33. Contract/payment rules and the 40-case dataset were not changed.
- Live workflow review, 18 October: first harness run stopped at an owner-confirmation dialog wait. Added explicit dialog/signing-completion waits, then a fresh full run passed 10 checks and seven live model calls. Normal batch paid exact 200/150 MDT with matching local events/receipts and balances, leaving 650 MDT/50 daily allowance; 75 deferred. Three owner actions before/after execution, no extra batch owner signature. Stale/replayed plans and injected RPC/provider errors caused no extra transfer. Run history, screenshot and receipts saved; existing app/contracts/prompts/dependencies and the fixed casebook remained unchanged.

## Next step

Step 5: freeze model/prompt/case settings, execute the fixed 40-case evaluation and matched comparisons, and record actual metrics and misses. Begin when the user asks to continue. Prepare public evidence only after separate authorization; registration and organizer acceptance of testnet evidence remain unresolved. Step 6 submission work has not started.
