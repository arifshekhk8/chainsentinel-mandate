# Evidence index

**Current hosting status, 20 October 2026:** [Mandate](https://chainsentinel-mandate.onrender.com) is live on Render Free with encrypted Neon Free persistence. Protected browser access, three reviewed bills/two original receipts and identical history after an actual restart are verified; 16 hosting checks and matching Linux CI pass. No new model call or public transaction occurred. Login details remain private. [Hosting verification](../evidence/HOSTING_RESULTS.md) takes precedence over older hosting/next-action notes below. The competition submission is still pending.

**Updated 19 October 2026.** Start with the current reports below. Step 5 is complete within its documented scope; Step 6 has not started. Local/scripted tests, live model measurements and public Sepolia receipts are separate evidence.

## Read first

| Report | What it establishes |
| --- | --- |
| [Sepolia results](STEP5_SEPOLIA_RESULTS.md) | Exact public 200 + 150 MDT payments, 650 MDT remaining, duplicate/daily/stop rejections, owner revocation, costs and wallet compatibility limits |
| [Groq v5 results](STEP5_GROQ_RESULTS.md) | Completed 40-case repaired local regression, all attempts, safe N13 miss and comparison limits |
| [Full project review](maintenance/2026-10-19/full-review/results.json) | Fresh isolated local build/format, contract, identity, app, agent, evaluator, local Sepolia and browser checks |
| [Testing guide](../TESTING.md) | Requirement-to-test map and original suite scopes |

[Private repository handoff audit](maintenance/2026-10-19/repository-review.json) records pushed source/organization revisions, preserved hashes, privacy checks and local validation. GitHub Actions provides the actual latest-commit CI status.

## Artifact folders

| Folder | Contents |
| --- | --- |
| [sepolia/public/](sepolia/public/) | Original public export, receipt/state audits, cost checks, wallet-wrapper recoveries and owner-stop proof |
| [sepolia/preparation/](sepolia/preparation/) | Local rehearsal, setup screenshots and passing/failing preparation logs; UI attempts are under `ui/` |
| [step5-evaluation-runs/](step5-evaluation-runs/) | Original dated fixture/live attempts and analyses; names remain pinned by the evaluator |
| [evaluation/history/](evaluation/history/) | Quota observations, interruptions and development calls; not merged into final metrics |
| [evaluation/checks/](evaluation/checks/) | Versioned offline agent-regression logs |
| [evaluation/scripted/](evaluation/scripted/) | Scripted local payment proofs, not live-model measurements |
| [evaluation/ui/](evaluation/ui/) | Versioned isolated UI logs and screenshots |
| [local/](local/) | Earlier Step 2–4 local receipts, Gemini workflow evidence and screenshots |
| [maintenance/2026-10-19/](maintenance/2026-10-19/) | Dated document/repository checks and the current full local review |
| [history/](history/) | Verbatim earlier progress journal; current status stays in root PROGRESS.md |

## Original reports

[Step 2](STEP2_RESULTS.md) · [Step 3](STEP3_RESULTS.md) · [Step 4 core](STEP4_RESULTS.md) · [Gemini development](STEP4_GEMINI_RESULTS.md) · [Gemini browser workflow](STEP4_LIVE_WORKFLOW_RESULTS.md) · [Partial Gemini evaluation](STEP5_EVALUATION_RESULTS.md) · [Groq evaluation](STEP5_GROQ_RESULTS.md) · [Sepolia preparation](STEP5_SEPOLIA_PREPARATION.md) · [Public Sepolia results](STEP5_SEPOLIA_RESULTS.md).

## Why some source snapshots stay here

The 17 `step5-*.mjs` files at this folder's root are historical source snapshots. Original evaluation freezes refer to those exact paths and hashes. They remain there to preserve reproducibility; they are not duplicate active application files. Active code belongs in `app/` and `scripts/`.

[locations.json](locations.json) maps every moved artifact's original path to its grouped location and SHA-256. Raw JSON, log and image bytes were preserved. Embedded historical paths inside measured records were intentionally retained; resolve them through this map. Readable Markdown links point to current locations.

Frozen tests/demo commands can emit fresh files at their original output paths. A fresh output is a new local observation, not a replacement for the curated historical snapshots in these folders. The current full review therefore used an isolated source copy. No failed attempt, original receipt or safe completion miss was deleted as cleanup.

## Current receipt proofs

- [Public execution export](sepolia/public/step5-sepolia-2026-10-19T15-52-14-777Z.json)
- [Independent exact payment verification](sepolia/public/step5-sepolia-payment-verification.json)
- [Confirmed revocation and OnlyAgent call](sepolia/public/step5-sepolia-revocation-verification.json)
- [Export/13-hash verification](sepolia/public/step5-sepolia-export-verification.json)
- [Prior final source/privacy checks](sepolia/public/step5-sepolia-final-checks.json)
