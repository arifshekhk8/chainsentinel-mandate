# Mandate — FinTechathon 2026 Topic F

Mandate is an AI wallet project for owner-approved business bills. The local contract, owner-review workspace and restricted payment agent are implemented. OpenAI support is prepared; live AI testing is deferred by the user.

**Team:** ChainSentinel. **Project:** Mandate.

**Status: Step 4 local implementation tested; live AI verification pending. No public deployment. We complete one agreed step at a time.** See [contract results](evidence/STEP2_RESULTS.md), [owner-workflow results](evidence/STEP3_RESULTS.md) and [agent results](evidence/STEP4_RESULTS.md).

**18 October:** preparing the private competition source repository. Current implementation/evidence and the remaining live-AI checks are recorded in [PROGRESS.md](PROGRESS.md). No public blockchain deployment has occurred.

**Step 1 baseline:** [business, bills and rules](demo/SCENARIO.md), [40 agent-evaluation cases](demo/cases.json), and [registration/email drafts](competition/REGISTRATION_DRAFT.md). The user started Step 2 with this baseline. The 40 agent cases have not run; contract tests are separate. Nothing has been sent.

## Open the owner-review app

Use Node.js **22.18 or later** with npm (tested with Node 25.2.1/npm 11.6.2). From this folder:

```sh
npm ci
npm run build
npm run dev
```

`npm run build` creates the contract artifacts required by the browser bundle. Installed dependencies are already present in this workspace, so `npm ci` is only needed for fresh setup or reinstall. `npm run dev` rebuilds the UI, starts a fresh local chain at **http://127.0.0.1:8545** (chain **31337**), deploys/funds MDT and a paused vault, then serves **http://127.0.0.1:4173**. Press Ctrl+C to stop both services. No model key or actual wallet is required to upload, review and preview approvals.

1. Click **Try three sample bills**, or upload a supported CSV/text PDF. CSV/PDF examples are downloadable from the app.
2. Open **Review**, compare the source text and fields, make corrections and mark the bill reviewed. Select ready bills and open **Review approval** to see exact recipients, amounts and windows.
3. A real browser signature needs a matching owner account. To use your existing browser wallet locally, stop the app and run `npm run dev -- --owner YOUR_PUBLIC_ADDRESS`, replacing the placeholder with its public address. Add/select a **local** wallet network using RPC `http://127.0.0.1:8545`, chain ID `31337`, symbol `ETH`. Connect only when you choose. Never enter a private key in this app.
4. Check the transaction review, then choose **Send to wallet**. The app claims approval only after a matching successful receipt. Approval sets permission; it does not pay a bill.

The local setup script temporarily impersonates the optional public owner address to seed vendors/access and gives it local test ETH; impersonation is stopped before serving the app. It also creates a separate random agent wallet in memory and gives it local test ETH. Its key is never printed or saved. These are local test conveniences, not real owner signatures or public-chain actions. Browser tests use a separate EIP-1193 test double with Anvil signers; the actual MetaMask extension has **not** been operated/tested by the assistant.

## Review and run the payment agent

1. After signing exact bill approvals, use **Rules & access → Review resume** and sign that owner action. The vault starts paused. The separate agent address/access window are shown there.
2. Return to Bills. Choose **Preview without AI**. This is a clearly labeled scripted manual plan, available without an API key.
3. Read each bill, recipient, amount, blocked reason and next action. Check the confirmation only when you want the eligible batch paid, then click **Run approved batch** once. No further owner signature is needed for these already-approved payments.
4. Check the matching successful payment receipts below the plan. A preview is a snapshot; pending/unknown/reverted outcomes are not paid confirmations. Use **Recheck original payment hash** after uncertainty; never blindly send again.

For the three sample bills, approve all three: the normal plan pays 200 + 150 MDT, leaves 650 MDT and defers 75 MDT because only 50 of the daily budget remains. This assumes the default rules and an active unpaused session.

To enable AI **later**, copy [.env.example](.env.example) to a local `.env` and configure `OPENAI_API_KEY` plus `OPENAI_MODEL` yourself. Never share the key in chat. Choose an API-project model supporting [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). Restart the app; **Ask AI** then sends your short message and bill summaries to OpenAI. Questions and unclear requests cannot execute. A draft correction needs **Apply to draft, then review**, with fresh owner approval if details change. For one synthetic invoice per file, the bill-review screen also offers explicit AI field assistance; manual review remains available.

The [Responses API](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) uses strict JSON proposals, no model tools, a 20-second timeout and `store: false`; this is not a zero-retention guarantee. Use synthetic data only. Keys remain on the backend. Optional `npm run test:live` makes three small billed development calls and no transactions; it has **not** been run. It is separate from the 40-case evaluation.

Drafts and extracted source text are stored in ignored `local-data/mandate.sqlite` with restricted file permissions. Original PDF/CSV bytes are not retained after parsing. Removing a source removes all its drafts; opaque receipt/approval references and on-chain records remain. Restarting `npm run dev` starts a **new local chain session**: drafts persist, but old local approvals and prepared actions are not treated as current. Fresh review/signing is required. The app is for local synthetic test data only.

## Run checks and the contract demonstration

```sh
npm test
npm run test:identity
npm run test:app
npm run test:agent
npm run build:app
npm run test:ui
npm run demo:local
```

Browser tests use installed Google Chrome in a separate headless test profile; no existing browser profile/wallet is accessed. If Chrome is unavailable, install it or explicitly change the Playwright configuration to a separately installed Chromium. The first install/build needs internet access for pinned packages and Solidity. Node currently labels its built-in SQLite API experimental; that warning is expected on the tested version.

The contract demonstration starts a separate ephemeral local node, verifies two payment receipts, saves [local payment evidence](evidence/step2-local-demo.json) and stops it. Agent tests save [separate local payment evidence](evidence/step4-local-agent.json). Browser tests save [local approval evidence](evidence/step3-owner-approval.json) and screenshots. Successful reruns replace their evidence files. These are local hashes with no public explorer links; no suite is the 40-case live-agent evaluation.

Additional commands: `npm run build`, `npm run format:check`, and `npm run test:gas`. Our [Foundry runner](scripts/foundry.mjs) preserves non-zero tool exit codes; the pinned npm tool wrapper otherwise loses them.

## Folder map

| Location | Keep here |
| --- | --- |
| Root Markdown files | The seven working documents, plus this README as the entry point |
| [app/](app/) | Backend, local database handling, AI adapter, payment workflow and browser UI source |
| [contracts/](contracts/) | MDT token and permission-enforcing vault |
| [scripts/](scripts/) | Build, local-chain, demonstration and later live-check commands |
| [test/](test/) | Contract, intake, owner/agent and isolated browser checks |
| [demo/](demo/) | Orbit Studio scenario and the unexecuted 40-case evaluation set |
| [competition/](competition/) | Original poster/rules/form and registration/source notes |
| [evidence/](evidence/) | Step reports, local receipts and verified screenshots; see the [evidence index](TESTING.md#saved-evidence-index) |
| `local-data/` | Private ignored drafts/runtime metadata; retained, not a public submission artifact |
| `node_modules/`, `out/`, `cache/` | Ignored installed tools and generated contract/cache files; retained to make resuming faster |

Disposable `dist/`, `test-results/`, `playwright-report/` and `broadcast/` output can be regenerated. The closing cleanup removed the existing browser build/test output and `.DS_Store`; source and saved evidence stay in their folders. No extra research pack or duplicate handoff file is needed. Credentials belong only in an ignored local `.env`; the safe configuration template is [.env.example](.env.example).

## Implemented files

| File | Purpose |
| --- | --- |
| [MandateDemoToken.sol](contracts/MandateDemoToken.sol) | Fixed-supply, six-decimal MDT test token |
| [MandateVault.sol](contracts/MandateVault.sol) | Owner approvals, agent payments, limits, reserve, expiry, paid markers and stop controls |
| [test/](test/) | C01–C06 contract checks and invoice-identity tests |
| [local-demo.mjs](scripts/local-demo.mjs) | Scripted local execution with verified receipts; no AI |
| [app/](app/) | Local intake, SQLite drafts, exact owner transaction reviews, receipt checks and responsive browser UI |
| [agent.mjs](app/agent.mjs), [model.mjs](app/model.mjs) | Structured AI proposals, clarification and explicit draft corrections; live verification pending |
| [planner.mjs](app/planner.mjs), [executor.mjs](app/executor.mjs) | Integer planning, restricted signing, durable queue and receipt reconciliation |
| [dev.mjs](scripts/dev.mjs) | Local-only setup/preview and optional public owner-address configuration |

## Planning and competition documents

| Read | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Mandatory working instructions and session workflow |
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | Steps, priorities, daily milestones and submission deliverables |
| [REQUIREMENTS.md](REQUIREMENTS.md) | User flows and measurable pass conditions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, signing boundaries, contract and data flow |
| [SECURITY.md](SECURITY.md) | Permissions, secrets, privacy, threats and limits |
| [TESTING.md](TESTING.md) | Tests, evaluation and demonstration plan |
| [PROGRESS.md](PROGRESS.md) | Current step, completed work, blockers and next action |

Event rules and original files stay in [competition/](competition/): [checklist and sources](competition/requirements.md), [rulebook](competition/rules.pdf), [registration form](competition/registration.xlsx), and [poster](competition/poster.jpeg). Application requirements live in the root REQUIREMENTS.md; event requirements live under competition/.

**Registration and submission:** 20 October 2026, **21:59 Bangladesh time** (23:59 Beijing time). Start with PROGRESS.md, then follow the active step in PROJECT_PLAN.md.

## Pinned tools and third-party sources

| Dependency | Version / license | Official source |
| --- | --- | --- |
| Foundry Forge and Anvil | 1.7.1 / MIT or Apache-2.0 | [Foundry installation](https://getfoundry.sh/getting-started/installation), [npm source](https://github.com/foundry-rs/foundry/tree/master/npm) |
| Solidity compiler | 0.8.37 / GPL-3.0 | [Release](https://www.soliditylang.org/blog/2026/09/10/solidity-0.8.37-release-announcement/) |
| OpenZeppelin Contracts | 5.6.1 / MIT | [ERC-20/SafeERC20](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20), [ReentrancyGuard](https://docs.openzeppelin.com/contracts/5.x/api/utils#ReentrancyGuard) |
| ethers | 6.17.0 / MIT | [Contract API](https://docs.ethers.org/v6/api/contract/), [JSON-RPC provider](https://docs.ethers.org/v6/api/providers/jsonrpc/) |
| esbuild | 0.28.2 / MIT | [Build API](https://esbuild.github.io/api/) |
| csv-parse | 7.0.3 / MIT | [Parser options](https://csv.js.org/parse/options/) |
| PDF.js / pdfjs-dist | 6.4.299 / Apache-2.0 | [Text extraction API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) |
| pdf-lib | 1.17.1 / MIT | [PDFDocument API](https://pdf-lib.js.org/docs/api/classes/pdfdocument) — synthetic sample/test invoices |
| Playwright Test | 1.64.1 / Apache-2.0 | [Browser contexts](https://playwright.dev/docs/api/class-browsercontext) |

SQLite uses [Node's built-in API](https://nodejs.org/download/release/v25.1.0/docs/api/sqlite.html); it is not a separate npm dependency. The frontend uses plain ES modules/HTML/CSS to keep this prototype small; no React framework or remote scripts/fonts are required.

AI uses OpenAI's REST API through Node fetch with no additional SDK dependency. API usage has separate provider terms/costs; [data controls](https://developers.openai.com/api/docs/guides/your-data) describe retention boundaries. Transaction preparation/signing follows [ethers Signer](https://docs.ethers.org/v6/api/providers/#Signer) and [Wallet](https://docs.ethers.org/v6/api/wallet/) APIs.

Exact npm versions and integrity hashes are in [package-lock.json](package-lock.json). Foundry's native packages are installed inside node_modules; no shell configuration was changed. Compiler binaries use Foundry's normal user cache. Dependency licenses remain with their installed packages. All invoices and test businesses are synthetic; no external dataset is included.
