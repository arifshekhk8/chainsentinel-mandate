# Mandate security plan

Security checks enforce [REQUIREMENTS.md](REQUIREMENTS.md). Steps 2–4 implement local contract, owner-review and restricted-executor safeguards. The user authorized Gemini connection and live synthetic development checks on 18 October; see [actual results and limits](evidence/STEP4_GEMINI_RESULTS.md). No external audit or public deployment has occurred. Development checks do not establish general live-model accuracy or complete security.

**17 October closing state:** local services are stopped; no live API call, actual wallet operation or public transaction was performed during this documentation/cleanup session. Local drafts, private configuration and saved evidence are preserved. Resume only when the user returns; use the [handoff](PROGRESS.md#resume-on-18-october-2026).

## Authority and key handling

- The owner alone approves bill details, recipients, limits, session expiry and changes. Show exact token/amount/address before each owner signature.
- The agent key can pay approved bills through the vault only. It cannot approve bills, alter rules or access the owner's account.
- Keep the owner key in the browser wallet. The current disposable local agent key stays only in memory. Any later persistent testnet-key setup needs authorization and private restricted storage outside tracked files. Never paste keys into chat or send them to the model.
- Keep API keys on the backend. Mask secrets in errors and logs. Do not place secrets in URLs, screenshots or submission artifacts.
- A compromised agent key can still spend every permission that remains valid. Limit its authority, expiry and gas funding; the owner must be able to revoke it.
- Step 2 uses only disposable local-chain accounts through local RPC signers; no owner/agent private key or model key is read, generated into a file or printed. The vault starts paused and has immutable owner/token addresses. There is no owner-key recovery or ownership rotation in this version; losing owner access requires a replacement deployment and may strand funds.
- The owner-review service remains read-only toward the chain: it prepares/simulates known owner methods and verifies receipts. A separate Step 4 executor holds an in-memory, test-only agent signer; its fixed payment route cannot sign owner actions or arbitrary RPC calls. The browser checks the expected owner/network, decodes exact owner calldata and prompts only after explicit transaction review. Automated browser tests use disposable Anvil accounts behind an EIP-1193 test double; they are not actual MetaMask-extension tests.
- Step 4 generates a separate local agent key in memory, funds it with local test ETH and never prints/saves it. Signing is limited to the pinned vault's `payBill` call. The signed hash/nonce is persisted before broadcast; raw signed transactions are not retained or retried automatically. Pending/unknown/invalid outcomes lock new sends. Public-testnet agent key storage is future work requiring authorization.
- Model output has strict schemas plus local validation, references known draft IDs and has no tools. No signer, calldata, API key or invoice note is included in request-interpretation input. AI field proposals require explicit apply and source review. Read-only/unclear requests cannot execute; even a payment proposal requires a separate user confirmation. Model errors/refusals use fixed safe messages and manual-review fallback.
- The optional public-address dev setup uses Anvil-only impersonation to seed the local scenario, then stops impersonation. It cannot prove real owner authentication on a public chain. Actual user-wallet operation or public deployment needs separate authorization.

## Threats and required safeguards

| Threat | Safeguard | Proof needed |
| --- | --- | --- |
| Invoice says “ignore rules” or changes a payment address | Treat document text as data; compare against owner-controlled vendor and bill approvals | Hostile invoice tests and direct contract calls fail to redirect funds |
| A question or unclear instruction is mistaken for permission to pay | Separate read-only requests from an explicit instruction to process an approved batch; clarify uncertainty | Read-only and ambiguous interaction cases produce no transfer |
| Model suggests excessive/unauthorized spending | Exact stored approvals plus on-chain caps/reserve; no arbitrary call tool | Bypass the planner in tests; contract still rejects the payment |
| Duplicate upload, concurrent send or retry | Stable bill identity, persistent queue and permanent on-chain paid marker | At most one successful transfer per approved bill key |
| Permission revoked/changed after planning | Policy-version check and current chain checks at execution | Stale plan fails after the owner's change is mined |
| Old session or premature payment | Contract checks block time, bill window and session expiry | Before-start and at-expiry boundaries fail |
| Token callback or failed transfer | Reentrancy protection and atomic state/transfer handling | Failed transfers leave no paid marker or spending increment |
| Malicious upload or browser content | Allow supported files only, 5 MB limit, validate contents, render text safely, restrict browser scripts | Invalid files rejected; invoice HTML cannot execute |
| Local API abuse | Bind local prototype to localhost; validate origin and state-changing requests; do not expose signing endpoints publicly | Cross-origin unauthorized actions rejected |
| RPC failure or misleading receipt | Check chain ID, vault, token and event fields; reconcile unknown outcomes | Wrong-chain/mismatched/failed receipts never mark a bill paid |

## Privacy

Use synthetic invoices by default. Keep uploads and draft fields in ignored local storage, separate from registration identity documents. Send only the minimum text needed for extraction to the configured model provider; this is external processing, not local-only processing. Obtain user authorization before using real invoices with an external provider.

Step 4's optional AI request sends the owner message and minimal bill summaries; explicit source assistance sends one synthetic invoice's text to the displayed provider. Gemini is the user's current choice; OpenAI remains an explicit alternative. Credentials load from ignored local `.env`/backend configuration and are never sent to the browser or included in prompts. The configured key file has owner-only permissions. Google standard/auth key patterns are rejected in model input and checked in the Git index. A key shared in chat should be replaced in AI Studio, then changed only locally; no key value is retained in tracked evidence.

Both adapters request `store: false`, disabling API response-record storage, not all provider processing. Gemini free-tier content may be used to improve Google's products: use synthetic data only. See [Gemini retention](https://ai.google.dev/gemini-api/docs/interactions-overview#data-storage-and-retention), [free-tier data use](https://ai.google.dev/gemini-api/docs/pricing) and [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data). No invoice uploads or wallet secrets were used in live development calls. API-project billing/free quota is controlled in AI Studio, not verifiable from a successful response; this implementation never enables billing, changes provider/model on error or retries automatically.

Extracted text/drafts, local messages and proposals remain in the restricted local database; raw upload bytes are discarded after parsing. SQL uses bound parameters; secure_delete is enabled. Removing a source deletes its text/drafts and linked AI proposals and removes invoice labels from retained payment records. Opaque hashes, approval fields and receipts remain for reconciliation. Deletion cannot undo prior provider processing, chain approvals, backups or already-copied records; storage is not encrypted by this prototype.

The local API checks exact Host and Origin, requires a per-process CSRF token for writes and emits a restrictive CSP. UI interpolation is escaped and source text uses textContent; uploaded HTML is never rendered as a document. PDF parsing is text-only, isolated and time/memory/page bounded; scanned/oversized/ambiguous inputs fail safely or require review. These measures do not replace an external audit or protect a compromised local host.

Do not put raw documents, passport details, bank information or full prompts into public evidence. Provide a local way to remove source documents; explain that deletion cannot remove past on-chain records or data already processed by a provider. Keep a minimal local record of approved bill references, receipts and outcomes for reconciliation.

For submission, record third-party code/data sources, their licenses and relevant API/model usage terms. Use only materials we are allowed to include and credit them in the report/repository. Test-token demonstrations must not be presented as a licensed payment service or real business adoption.

## Private repository boundary

The source repository is private. Git excludes `.env`, local drafts/databases, keystores, generated output, installed dependencies and `competition/private/`. Complete registration/identity documents only in that ignored folder; the tracked workbook must retain the original blank-template hash. `npm run check:repo` scans the Git index and checks these boundaries before a push. It is a pattern/path guard, not proof that arbitrary secrets cannot be hidden in a file or image; inspect staged content.

The GitHub Actions workflow pins official actions by full commit hash, requests read-only contents access, disables persisted checkout credentials and uses no model/wallet secrets. It runs synthetic local-chain tests only. Reviewer access or source-archive delivery needs the accepted competition process; repository creation does not grant organizer access or submit the project. See [SUBMISSION.md](SUBMISSION.md#private-access-and-source-handover).

## Limits to state honestly

- Test tokens have no promised cash value. This prototype is not approved for mainnet or real funds.
- Only the known fixed MDT deployment is supported. The six-decimal constructor check alone does not establish token authenticity. Fee/rebasing or malicious tokens are unsupported; exact balance checks reject the tested inexact transfers, not every possible dishonest token implementation.
- The contract proves authorization and execution conditions, not that a bill is genuine or goods arrived. A wrong owner approval can authorize a wrong payment.
- Editing/deleting a local draft does not cancel its existing chain approval. The owner must sign cancellation or replacement to change that permission. Confirmation needs one matching mined receipt in this local version; it is not a finality guarantee against public-chain reorganizations.
- Duplicate protection is exact for the stable approved bill key. A fraudster changing invoice/vendor identifiers may require human review; global duplicate detection across separate vaults is out of scope.
- Revocation stops later executions after it is confirmed; an earlier mined payment remains final. Pending transaction ordering can matter.
- Expiry and UTC limits use block timestamps. They are not a precise wall-clock scheduler or a rolling-day cap; near-boundary transaction inclusion can change eligibility. Use generous windows in public demos. Forge flags these comparisons as timestamp warnings; the use is intentional and boundary behavior is tested.
- The prototype trusts the owner device, backend host, model provider for submitted data, and RPC service. Database/audit hashes do not make a compromised host trustworthy.
- The localhost app is single-user development software, not a remotely authenticated service. Its local Anvil RPC uses disposable test accounts. Do not expose either port to a network. A compromised host/agent can spend all still-valid approvals; contract limits and confirmed revocation remain the boundary.
- Queue recovery has no automatic retry, fee bump or transaction replacement. A signed hash not visible at the RPC remains unknown and blocks new sends; investigate the original hash/nonce and revoke access if needed. A reused/live process PID is deliberately not unlocked automatically. Local receipts use one mined confirmation, with no public-chain finality guarantee.
- No claim of complete security, an external audit or guaranteed prevention of financial loss is permitted.

Run the security gate in [TESTING.md](TESTING.md) before public demonstrations. Disclose remaining limitations with the results.
