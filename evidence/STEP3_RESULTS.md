# Step 3 — Owner-review workflow

**Team:** ChainSentinel. **Project:** Mandate. **Date:** 17 October 2026, Asia/Dhaka.

**Historical Step 3 record.** Keep its seven browser checks distinct from Step 4's total of 12, which includes those seven. This closing documentation session preserved the receipts/screenshots. See [Step 4 results](STEP4_RESULTS.md) and the [18 October handoff](../PROGRESS.md#resume-on-18-october-2026) for the current state.

At Step 3 completion, the local owner workspace imported bills, showed source text beside editable fields, checked owner-controlled vendors, required review, previewed exact owner actions and verified approval receipts. AI extraction/planning and agent payments were not connected at that step; the later local implementation is recorded separately in Step 4.

## Implemented and checked

| Area | Result |
| --- | --- |
| CSV/text-PDF intake | Supported inputs become drafts; unknown/ambiguous fields stay incomplete; malformed/unsupported/oversized files are rejected |
| Owner review | Source and fields displayed together; edits clear review; wrong currency/dates/amounts stop readiness |
| Recipient protection | Invoice address cannot change registry; mismatch requires explicit independent owner acknowledgment |
| Duplicate checks | Same normalized vendor/invoice key blocks the later copy; similar identifiers require review |
| Rules and access | Exact previews for vendor changes, per-bill/daily/reserve rules, agent window, pause/resume, revocation and cancellation |
| Signing | Browser wallet account/network checks; owner action shown before sending; backend has no signer or arbitrary RPC endpoint |
| Receipts | Exact chain/sender/to/value/calldata and expected events checked; rejected, pending, reverted, invalid and unknown states never become confirmed approval |
| Changed/cancelled drafts | New fields do not inherit old approval; editing does not revoke existing on-chain permission; cancellation requires fresh review before replacement |
| Storage/privacy | Restricted local SQLite, prepared SQL, persisted hashes, source removal and per-chain-session approval separation |
| Browser safety | Escaped content/plain source text, CSP, Host/Origin/CSRF checks and bounded PDF workers |

Limits: 5 MiB/file, 50 CSV bill rows, 200,000 source-text characters, 20 PDF pages, 10-second worker timeout and 128 MiB worker memory cap. PDFs use conservative labeled extraction in this step; other readable layouts need manual field entry. No scanned-document OCR or broad AI extraction accuracy is claimed.

## Validation

- `npm install --no-fund`: pinned additions installed; npm reported zero known vulnerabilities at install time.
- `npm run build:app`: passed; local browser bundle uses no external scripts/fonts.
- `npm run test:app`: **33 passed**, zero failures/skips — 11 intake/amount tests and 22 owner/API/storage checks.
- `npm run test:ui`: **7 passed** in isolated headless Chrome with an EIP-1193 test wallet and real local-chain transactions. The actual MetaMask extension was not used.
- Local preview returned HTTP 200. The in-app browser surface was unavailable; browser behavior and visuals were instead checked in the isolated local Chrome test profile. No existing browser profile/wallet was accessed.
- Visually inspected [desktop](local/step3/step3-desktop.png), [bill review](local/step3/step3-review.png) and [mobile](local/step3/step3-mobile.png) screenshots.

An initial browser test found a save/close race: a completed save reopened a bill panel after the owner had closed it. The save now respects the current panel/review generation. A deliberately delayed-save regression checks that the panel remains closed. All final required Step 3 checks passed before Step 4 began.

Contract source and its Step 2 acceptance set were not changed. The earlier 58 contract checks/four identity checks remain recorded in [Step 2 results](STEP2_RESULTS.md); their separate payment demo is not owner-approval evidence.

## Approval evidence

[step3-owner-approval.json](local/step3/step3-owner-approval.json) records the actual local two-bill `approveBills` transaction, matching successful receipt/logs and exact approved fields. The amounts are **200 and 150 MDT**. The vault retains **1,000 MDT** and this workflow pays **zero tokens**. Screenshots show this approval state; they do not depict AI operation or a payment outcome.

The browser provider is a **test double** backed by disposable Anvil RPC signers. Hashes are from ephemeral local chain 31337, not Sepolia, and cannot be checked on a public explorer. Re-running browser tests replaces these local artifacts. No actual user wallet, private/API key, real invoice or real funds were used. The optional public-address setup was independently tested to seed a disposable local vault and stop impersonation afterward.

## Run and review

Use `npm run build` before the first browser build, then `npm run dev` and open http://127.0.0.1:4173. Click **Try three sample bills**, review each source, mark reviewed, select ready bills and inspect **Review approval**. No wallet is needed until signing. See [README.md](../README.md#open-the-owner-review-app) for fresh setup and optional manual browser-wallet setup using a public address only.

SQLite currently emits Node's experimental-API warning. It stores unencrypted synthetic data locally; deletion is not a guarantee against storage/backup recovery. Same-chain executor recovery was later checked in Step 4; public-chain finality/reorganizations remain unverified. The prototype still trusts the local host/RPC and cannot prove invoice truth or prevent a mistaken owner approval. [SECURITY.md](../SECURITY.md) records these limits.

Step 4's local implementation and controlled development checks are now ready; live AI verification is deferred by the user. The separate 40-case agent evaluation, public deployment and competition submission remain unperformed. Registration has not been submitted. Resume only when the user returns, following [PROGRESS.md](../PROGRESS.md).
