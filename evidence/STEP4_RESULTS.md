# Step 4 — local agent and payment workflow

Recorded 17 October 2026. Team **ChainSentinel**; product **Mandate**. This is local Anvil evidence with synthetic bills and MDT test tokens. No public transaction or actual user-wallet operation occurred.

**Closing handoff:** user paused work on 17 October and plans to return on 18 October. The documentation/folder cleanup preserved these test results and all receipt/screenshot artifacts; it did not run another application test or live API call. The preview and local chain are stopped. Continue from [the resume checklist](../PROGRESS.md#resume-on-18-october-2026).

## What is ready

- Optional OpenAI extraction/request adapter with strict schemas, local validation, focused clarification context and explicit draft corrections. A model never gets signing tools or keys.
- Exact deterministic ordering/budgets, clear blocked reasons/actions and a separate confirmation for an eligible batch. AI-off manual preview is labeled scripted.
- Restricted agent signing of `payBill(key,policyVersion)` only, with refreshed state and simulation before each send.
- SQLite plan claims and pre-broadcast hash/nonce storage; pending/reverted/unknown/invalid/confirmed states remain distinct. Recovery reads the original hash and never sends again.
- Successful receipts must match chain, sender, vault, calldata, bill, recipient, token, amount and policy/day. Confirmed revocation stops later sends, including between bills.

## Verified results

| Check | Result |
| --- | --- |
| Agent/transport/queue development tests | 38 passed; zero failures/skips |
| Browser tests | 12 passed: seven owner workflow, five agent |
| Intake/owner API/storage regression | 33 passed |
| Contract regression | 58 passed; two fuzz tests with 512 trials each |
| Bill identity regression | Four passed |
| App bundle | Built successfully |
| Live-model checks | **Deferred by user; not run** |
| Fixed 40-case evaluation | **Not started** |
| Sepolia deployment/evidence | **Not started** |

Commands: `npm run test:agent`, `npm run test:ui`, `npm run test:app`, `npm test`, `npm run test:identity`, `npm run build:app`. Initial fault-injection testing intercepted snapshot reads as well as payment simulation; the fixture now targets the payment selector. The application also distinguishes an RPC simulation outage from a contract rejection. Final checks pass.

[Receipt evidence](local/step4/step4-local-agent.json) records real local transactions driven by a **scripted development model adapter**. It is not a live AI result. The normal batch pays 200 + 150 from 1,000 MDT, ending at 650 with daily spend 350 and daily allowance 50. The approved 75 MDT bill is deferred. Reserve, stale-policy, expiry and revocation checks use independent fixtures.

Development traces cover ordinary wording, clarification plus answer, read-only requests, corrections preserving existing signed permission, unsupported requests and tool failures. Controlled proposals test the application's handling, not a live model's accuracy. Separate checks cover concurrent executor objects, pending locks, accepted-but-lost broadcast replies, absent hashes, mined reverts, mismatched events, backend/store reopen, between-send revocation, linked-source removal and API timeout without retry. Lowering a daily cap below already-spent tokens shows zero remaining and allows no new payment. No held-out evaluation case was executed or included in prompt input.

Browser evidence: [desktop](local/step4/step4-agent-desktop.png), [mobile](local/step4/step4-agent-mobile.png). QA uses isolated headless Chrome and disposable local accounts; it does not access a user's browser profile or wallet extension.

## What still needs proof

The user chose **“Prepare it now; test live AI later.”** The API adapter is implemented and its transport/error boundaries are tested with fixtures; no OpenAI call was made. `npm run test:live` is prepared for three small synthetic development calls after local API configuration. Live extraction, understanding and conversation results must be checked before claiming Step 4's full live-model completion or starting the measured agent evaluation.

The dev launcher starts a fresh chain/session on every launch and discards its in-memory agent key on exit. Same-chain backend/store reconciliation is separately tested; this is not public-network key storage or a production scheduler. Unknown hashes stay locked for investigation. A crashed queue is interrupted only after its recorded PID is absent; a live/reused PID is not automatically unlocked. No fee replacement, automatic queue resume or public-chain finality handling exists.

Node reports SQLite as experimental on the tested version. No additional npm dependency was needed. The provider/RPC/owner device/backend are trusted prototype boundaries; there is no external audit or guarantee of finalist selection. Registration and organizer confirmation of Sepolia evidence acceptance remain pending. See [progress](../PROGRESS.md) for the next authorized step.
