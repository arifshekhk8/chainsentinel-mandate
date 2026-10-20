# Mandate

Team ChainSentinel · 2026 Shenzhen International FinTech Competition · International Track · Topic F: Agent Wallet

Mandate helps a small business review synthetic supplier bills and pay exact owner-approved amounts within on-chain limits. AI interprets requests and proposes a plan. The owner approves bill details and confirms execution; a restricted agent submits payments. The vault independently checks authority, amounts, recipients, budgets, reserve, expiry and replay protection.

**Review:** [3:40 demonstration](https://drive.google.com/file/d/1pXyCMtp6S4SXizyRs329teKoPWw_YkYc/view) · [Complete submitted package](https://drive.google.com/drive/folders/19YKvnvqd5wzL9QtmsGvZ18Bhrl1FyG7I?usp=drive_link) · [Hosted workspace](https://chainsentinel-mandate.onrender.com) · [Reviewer guide](SUBMISSION.md)

The hosted password was supplied in the submission email. No wallet connection is needed to inspect saved records. All bills are synthetic; MDT tokens have no cash value. This prototype supports a disposable local chain and Ethereum Sepolia only.

## Submitted materials

| Item | Open |
| --- | --- |
| Technical report | [PDF](submission/Mandate-Technical-Report.pdf) · [Word](submission/Mandate-Technical-Report.docx) |
| Security self-assessment | [PDF](submission/Mandate-Security-Assessment.pdf) · [Word](submission/Mandate-Security-Assessment.docx) |
| Execution evidence | [PDF](submission/Mandate-Execution-Evidence.pdf) · [Word](submission/Mandate-Execution-Evidence.docx) · [Transaction logs](submission/Mandate-Transaction-Logs.zip) |
| Presentation | [PDF](submission/Mandate-Presentation.pdf) · [PowerPoint](submission/Mandate-Presentation.pptx) |
| Demo video | [Captioned MP4](https://drive.google.com/file/d/1pXyCMtp6S4SXizyRs329teKoPWw_YkYc/view) · [English captions](submission/Mandate-Demo.srt) |
| Original source handover | [Submitted ZIP](https://drive.google.com/file/d/1MGNnIN8M11mQLh3WGLOuicsmrFczRZxR/view) · [Checksum](submission/Mandate-Source.zip.sha256) |

The original submission files are preserved byte for byte. The MP4 and original source ZIP are available locally under `submission/` and through Drive; Git tracks the source itself and links to those two large files. [File manifest](submission/manifest.json).

## Reproduce locally

Use Node.js 25.2.1 and npm 11.6.2, the verified versions. The package requires Node 22.18 or later.

```bash
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:4173`. The launcher starts a disposable Anvil chain at `http://127.0.0.1:8545`. Load sample bills, review source fields and exact permissions, then use the labeled **Preview without AI** flow. The automated checks need no API credential or public wallet. Use local test accounts only and stop the launcher before reusing its ports.

Run checks in a disposable copy because several demonstrations write generated evidence:

```bash
npm run format:check
npm test
npm run test:identity
npm run test:app
npm run test:agent
npm run test:evaluation
npm run test:sepolia
npm run build:app
npm run test:ui
```

Local browser tests use installed Chrome. Linux CI installs Chromium and sets `CI=true`. See [TESTING.md](TESTING.md) for hosting checks and the distinction between synthetic regressions, live-model evaluation and public transactions. `npm run check:repo` checks the Git index, so run it in a checkout after staging.

## Inspect the result

The reports record the 19 October run: 200 + 150 MDT paid, 650 remaining and the 75 MDT bill deferred. The 20 October video records renewed exact approval, a further 75 MDT payment, 575 MDT remaining and confirmed revocation. All three bills are now paid; the agent is cleared at policy 10. These are separate dated checkpoints. [Public evidence](evidence/RECORDED_DEMO_RESULTS.md).

The repaired 40-case Groq local evaluation measured 19/20 ordinary tasks, 20/20 exception explanations, 156/156 extracted fields and 6/6 interactions, with zero wrong transfers observed. Repairs used observed failures; these results are not untouched held-out performance. The N13 completion miss and earlier failed attempts remain disclosed in [the evaluation report](evidence/STEP5_GROQ_RESULTS.md). Human time savings, real customer adoption and external security certification are not established.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/`, `contracts/` | Application, model boundary, planner, executor and vault |
| `scripts/`, `test/` | Local reproduction, hosting adapter and checks |
| `submission/` | Original final reports, presentation, logs and local media |
| `demo/` | Synthetic scenario, fixed cases and frozen evaluation provenance |
| `evidence/` | Dated measured results, receipts, failures and historical source snapshots |
| `competition/` | Official references, hosted-review and deployment instructions |

[Architecture](ARCHITECTURE.md) · [Requirements](REQUIREMENTS.md) · [Security](SECURITY.md) · [Judging map](PROJECT_PLAN.md) · [Evidence index](evidence/README.md) · [Dependency notices](THIRD_PARTY_NOTICES.md) · [Submission status](PROGRESS.md)

The repository is public by the team's explicit 20 October decision. Credentials, registration/identity files, raw recordings, internal plans, drafts and document-production tools are excluded. This post-submission organization changes documentation and file presentation; the frozen application/contract source and original submitted artifacts are unchanged. No live deployment is part of this cleanup.
