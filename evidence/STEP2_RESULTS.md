# Step 2 — Local contract results

**Completed:** 17 October 2026, Asia/Dhaka. **Team:** ChainSentinel. **Project:** Mandate.

**Historical Step 2 record.** Results below describe that step; they were preserved during the 17 October closing cleanup. Later owner/agent work is recorded in [Step 3](STEP3_RESULTS.md) and [Step 4](STEP4_RESULTS.md). For tomorrow's work, use the [current handoff](../PROGRESS.md#resume-on-18-october-2026).

The local contract core passes its required checks. This is not the complete application, a live-agent evaluation, an external audit or public-testnet evidence.

## What is implemented

- Fixed-supply MDT with six decimals, restricted to the supported test networks.
- A paused-by-default vault with one immutable owner/token and a separate expiring agent permission.
- Owner-managed vendors and atomic batches of exact bill approvals, including payment windows and document fingerprints.
- Agent payments taking only bill key/version; exact stored recipients/amounts, daily/per-bill caps, reserve and confirmed stop controls.
- Permanent paid keys, stale-plan rejection, vendor revisions, guarded transfers and owner recovery only while paused.
- Shared invoice normalization/hashing and a scripted local receipt demonstration.

## Commands and observed results

Run from the project root using the [README instructions](../README.md#run-checks-and-the-contract-demonstration).

| Command | Observed result |
| --- | --- |
| `npm install --no-fund` | Pinned dependencies installed; npm reported zero known vulnerabilities at install time |
| `npm run build` | Solidity 0.8.37 compilation passed; timestamp lint warnings are discussed below |
| `npm test` | 58 contract tests passed, zero failed/skipped; two fuzz tests each ran 512 trials |
| `npm run test:identity` | Four JavaScript identity tests passed |
| `npm run format:check` | Passed |
| `npm run demo:local` | Two verified payments and a mined rejected payment; evidence saved and local node stopped |

The 1,024 fuzz trials belong to two of the 58 contract tests; they are not 1,024 new evaluation cases. Repeated suite runs are not additional independent cases. Foundry uses the seed configured in foundry.toml and may reuse its local fuzz corpus.

| Test source | Tests | Required checks covered |
| --- | --- | --- |
| [RolesAndApprovals.t.sol](../test/RolesAndApprovals.t.sol) | 14 | C01/C02: owner/agent boundaries, exact fields, unapproved bills, wrong recipients, batch atomicity, disallowed calls, token/network configuration |
| [MoneyBoundaries.t.sol](../test/MoneyBoundaries.t.sol) | 17 | C03: one-unit below/equal/above caps and reserve, balance, decimals, UTC reset, cumulative usage across session/policy changes |
| [StopAndReplay.t.sol](../test/StopAndReplay.t.sol) | 19 | C04/C05/C06: replay, paid-key permanence, start/expiry, pause, cancellation, revoke/rotate, recovery, stale versions and vendor changes |
| [TransferIntegrity.t.sol](../test/TransferIntegrity.t.sol) | 8 | C06: false/reverting/inexact token transfers, rollback, reentrancy into another eligible bill, transfer/event matching |
| [bill-identity.test.mjs](../test/bill-identity.test.mjs) | 4 | Same normalized invoice stays one key; non-ASCII/control input needs review; distinct vendors/vaults/chains stay separate |

Direct contract calls bypass the planner entirely. Rejections assert specific errors and unchanged payment state/balances. The repeated-attempt fuzz test models paid keys and spending independently across 32 attempts per trial. This models EVM serialization of competing plans; application queue/restart/concurrency checks were later added in [Step 4](STEP4_RESULTS.md), separately from these contract results.

## Local demonstration evidence

See [step2-local-demo.json](local/step2/step2-local-demo.json) for actual local transaction hashes, block references, receipt statuses, raw event logs, gas usage and verified outcomes. Amounts there use six-decimal integer base units.

| Action | Outcome |
| --- | --- |
| Start with 1,000 MDT | Vault funded with test tokens |
| D01 — 200 MDT hosting | Successful local receipt; token transfer and BillPaid event match |
| D02 — 150 MDT design | Successful local receipt; token transfer and BillPaid event match |
| Normalized copy of D01 | `eth_call` rejects with BillAlreadyPaid; no new transaction submitted |
| D03 — 75 MDT extra hosting | `eth_call` identifies DailyLimitExceeded; deliberately mined local transaction has status 0, no logs, and no token/accounting change |
| Final state | Paid 350 MDT; vault 650 MDT; daily allowance remaining 50 MDT |

This uses Anvil chain 31337, not Sepolia. The script starts a fresh node, uses local RPC signers and stops it afterward. The saved hashes are a record of ephemeral local execution and cannot be looked up on a public explorer. Re-running the script reproduces the checks and replaces the evidence file. All actions are scripted; no LLM, API key, browser wallet, real invoice or real funds are involved.

## Environment, findings and limitations

Node 25.2.1; npm 11.6.2; Forge/Anvil 1.7.1; Solidity 0.8.37 targeting Cancun with optimizer enabled, 200 runs; OpenZeppelin Contracts 5.6.1; ethers 6.17.0. Versions, integrity hashes and official source/license links are in [README.md](../README.md#pinned-tools-and-third-party-sources) and package-lock.json.

- Fixed a test-harness naming failure: Foundry no longer accepts the `testFail` prefix. The renamed test explicitly expects the recovery revert and now passes.
- Foundry's pinned npm wrapper lost child failure exit codes. [Our runner](../scripts/foundry.mjs) executes its pinned native binary and preserves failure status. A deliberately failing contract test in a temporary directory verified a non-zero exit; the temporary fixture was removed.
- A coverage diagnostic ran, but Foundry emitted source-anchor mapping warnings with this compiler. Its percentages are not treated as reliable evidence or used to claim complete coverage. The mandatory scenario/error/state checks are the completion gate.
- Compilation flags intentional block-timestamp comparisons. Limits use UTC chain days; expiry is exclusive. Public demonstrations need generous windows rather than second-accurate timing promises.
- Owner/token addresses are immutable. Token-decimal validation is not authenticity verification. Supported execution assumes the known MDT contract; arbitrary, rebasing or malicious tokens remain unsupported.
- See [SECURITY.md](../SECURITY.md) for owner-key loss, mistaken owner approvals, duplicate-identity limits, pending transaction ordering and trusted-host assumptions.

## Still pending

At Step 2 completion, the owner UI and agent workflow were still pending. They were subsequently implemented/tested locally in Steps 3–4. Current pending work is live AI verification, the separate 40-case evaluation, explicitly authorized public evidence and registration. The organizer has not confirmed testnet evidence acceptance. Those outcomes are not established by this contract report; follow [PROGRESS.md](../PROGRESS.md).
