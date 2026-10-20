# Reproduction and verification

Use the Node version and installation steps in [README.md](README.md). Run demonstrations and tests in a disposable source copy: some commands write generated evidence at original paths. The committed historical evidence must not be overwritten by a new regression.

| Check | Command | Scope |
| --- | --- | --- |
| Repository | `npm run check:repo` | Staged Git files, links, credential patterns and unchanged official blank templates |
| Contracts | `npm run build`, `npm run format:check`, `npm test` | Build, formatting, roles, exact payments, limits, reserve, replay, timing and token integrity |
| Bill identity | `npm run test:identity` | Exact integer amounts and bill identity |
| Owner workflow | `npm run test:app` | Intake, source review, permissions, persistence and shutdown |
| Agent | `npm run test:agent` | Structured-model boundary, planning, confirmation, recovery and queue checks |
| Evaluation | `npm run test:evaluation` | Grading, exact decimals and comparison/provenance boundaries |
| Sepolia rehearsal | `npm run test:sepolia` | Disposable local setup and public-only response simulations |
| Browser | `npm run build:app`, `npm run test:ui` | Local owner/agent/setup UI; isolated signing test double |

Local browser tests use installed Chrome. For Linux use `npx playwright install --with-deps chromium` and `CI=true`. The GitHub workflows pin Node 25.2.1 and actions to exact commits.

For the hosting adapter:

```bash
npm --prefix scripts/hosting ci
node --test test/hosting.test.mjs test/hosting-migration.test.mjs test/hosting-browser.test.mjs
```

These synthetic suites require no live model, cloud account or public wallet. `test:live`, `test:live-workflow` and `evaluate:live` are separate opt-in operations that use the configured model. They are not run by CI or as routine cleanup.

## Evidence and limits

The repaired 40-case Groq local run records 19/20 ordinary tasks, 20/20 exception explanations, 156/156 fields and 6/6 interactions, with no wrong transfer observed and 27 local receipts verified. Repairs followed observed failures; this is not untouched held-out accuracy. N13 and earlier attempts remain disclosed in [the full method/results](evidence/STEP5_GROQ_RESULTS.md).

The 19 October [public run](evidence/STEP5_SEPOLIA_RESULTS.md) and 20 October [recorded follow-up](evidence/RECORDED_DEMO_RESULTS.md) are separately dated. An unmined `eth_call` rejection is not a mined failed transaction. The public stopped-agent check overlaps the daily limit; otherwise-eligible revocation isolation is established by local tests.

[Requirements](REQUIREMENTS.md) map R01–R15 to F01–F09 and C01–C06. [Recorded regression outputs](evidence/maintenance/2026-10-19/full-review/) preserve the earlier checks. [Current review checks](evidence/REVIEW_CHECKS.json) describe this repository organization check; they do not add model-evaluation cases or public payments. Actual human talk duration and full final-video playback are not established by automated checks.
