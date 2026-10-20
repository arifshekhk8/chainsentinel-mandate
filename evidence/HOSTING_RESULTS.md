# Hosted workspace checks — 20 October 2026

**Current result:** The protected owner workspace is live on Render Free with encrypted Neon Free storage. Live sign-in/sign-out, anonymous API rejection, three reviewed bills, both original confirmed receipts and identical history after a real restart are verified. The vault still holds 650 MDT and its agent remains revoked at policy 7. All 16 local hosting checks and the matching Linux CI pass; no new model call, owner signature or public transaction occurred. [Open Mandate](https://chainsentinel-mandate.onrender.com). [Live restart record](hosting/2026-10-20/live/restart-verification.json). Earlier preparation and failure notes below are retained as history.

## Connector and project verification — 20 October 2026

The user explicitly replied “no project yet, create new one.” The Neon connector created project `mandate`, ID `sweet-frost-42050575`, at `2026-10-20T07:41:39Z` (13:41 Bangladesh), in `aws-ap-southeast-1` (Singapore), with PostgreSQL 18 and a requested 0.25 CU minimum/maximum. The requested default branch/database/role names were `main`, `mandate` and `mandate_owner`; their detailed records have not yet been read independently. `describe_project` with that exact project ID succeeded and returned `subscription_type: free_v3` and `effective_project_permission: ADMIN`. No credentials or connection strings were requested or printed.

The first create request received HTTP 412, “modifying the suspend interval is not permitted on this account.” The corrected request omitted the interval setting and succeeded. No billing upgrade or further suspend-setting change was made. The account-managed project default returned zero for that field; this project read does not independently establish the initial endpoint's idle behavior.

Plugin discovery confirms both integrations are installed. The current tool inventory exposes Neon project creation/description, but no Render workspace/service tools, so Render authentication and workspace access cannot yet be tested. [Access next steps and API fallback](../competition/HOSTING_ACCESS.md). No workspace data has been migrated and no app service has been deployed. The original local data, public evidence and revoked agent authority remain unchanged.

**Earlier access-file preparation, 20 October:** the blank `local-data/hosting/cloud-access.env` file exists with `0600` permissions inside a `0700` directory and is excluded by `git check-ignore`. Existing local secrets/data were preserved. Official Render and Neon API-key instructions were checked. No API credential was printed, validated or sent to a cloud service in this preparation action.

## Local checks

`node --test test/hosting.test.mjs`: **14 passed, zero failed**, 20 October 2026. These are local hosting checks, separate from the fixed 40-case model evaluation and historical Sepolia evidence. The last run took about 2.36 seconds. Test storage uses an in-memory cloud repository; transaction checks use a disposable local chain, with no live model or public transaction.

- Encrypted restoration preserves bills, reviews and original pending hashes after the local file is lost.
- Compare-and-set updates and startup fencing reject stale processes, including identical restored state.
- Failed storage and lost acknowledgments prevent a new broadcast; original hashes survive recovery.
- Owner hashes are saved before receipt RPC calls; unchanged reads avoid unnecessary uploads.
- Wrong encryption keys and existing destination files fail safely.
- App/API access requires login; the health endpoint exposes no workspace data.
- Writes require the expected public origin and the original application CSRF token.
- Cookies use Secure, HttpOnly and SameSite=Strict; expiry, tampering, logout and password-rate limits are checked.
- Failed persistence blocks the response and further work.
- The existing executor pays exact 200 + 150 MDT locally, leaves 650 MDT, restores receipts and rejects replay.

An earlier test-harness failure was caused by Node fetch replacing a custom Host header. The harness now uses `node:http` to represent a TLS reverse proxy accurately; the gateway's host checks were not relaxed.

## Earlier prepared source and remaining checks

[Render configuration](../render.yaml), [hosting entry point](../scripts/hosting/start.mjs), [gateway](../scripts/hosting/gateway.mjs), [persistence](../scripts/hosting/persistence.mjs), [Neon repository](../scripts/hosting/neon.mjs) and [tests](../test/hosting.test.mjs) are prepared locally. The separate hosting dependency is `@neondatabase/serverless` 1.2.0. Core source, contract rules and measured evaluation are unchanged.

At that earlier checkpoint, still pending: Render account/workspace access, application database credentials and real Neon storage/migration verification, private source deployment, Render build, browser review, authenticated live read-only checks and cloud restart persistence. Do not claim production authentication, an independent security audit or a deployed full workspace from these local tests.

## Verified access, migration and startup checkpoint — 20 October 2026

Both private management keys returned HTTP 200. Render plugin workspace listing also succeeds; its workspace is `tea-dbbh6rgu01pc73dq2k2g` (My Workspace), which the user authorized the agent to choose. The Neon app connector reports USER_NOT_LOGGED_IN, so the working API keys are selected. Private key values were never printed or placed in source. The access file remains 0600 and Git-ignored.

Render CLI v2.30.0 was downloaded from the official release; SHA-256 `cd914e3dfda306d22b0dcf3e16f2c0ce741c64a2e76dfe1b0ae9fc54f65b49e9` matches the release digest. `render blueprints validate` with the explicit workspace returned valid=true and one Free web service. The build includes development dependencies explicitly; autodeploy is disabled.

Current local hosting suite: **15 passed, zero failed**, about 2.61 seconds. The additional migration check verifies consistent backup of an open SQLite source, unchanged source bytes, restored owner review/pending hash and refusal to overwrite cloud state. The earlier 14-check run above remains historical.

Actual Neon initial migration saved revision 1: 114688 bytes; one document, three drafts, 13 owner intents, three agent plans and two payments. Restored plaintext bytes match snapshot SHA-256 `57d7055032473211e007ffa0e6ab785863d40b3f3e476d30007ca9846e59c782`; only ciphertext was stored. The local source and private snapshot are preserved.

[Cloud-backed startup/read](hosting/2026-10-20/cloud-startup.json) then restored all three reviewed drafts and both original confirmed receipts, verified chain 11155111, 650 MDT, policy version 7 and zero agent address, and closed cleanly. It made no live model call or public transaction. This is a local process using real Neon storage and read-only Sepolia RPC, not a deployed Render app. Actual Render build, authenticated browser review and restart persistence remain pending.

## Private source and first Render creation attempt — 20 October 2026

The isolated checkout installed both pinned dependency sets with zero npm audit findings, built contracts/browser code and passed all 15 hosting checks. The staged repository/privacy check passed for 260 tracked files and 457 local links. Only the 12 hosting source/config/test files were committed and pushed to the existing private repository on `deploy/render-owner-workspace`, commit `f4c08785491aa373cf4dcbe2005b6cddc4a2bc92`, preserving the configured human author and all 47 frozen source files.

[Linux hosting CI](https://github.com/arifshekhk8/chainsentinel-mandate/actions/runs/39389883818) completed successfully for that exact commit; [original CI log](hosting/2026-10-20/github-actions-hosting.txt). The workflow has no cloud/model/wallet credentials.

Render API creation with plan=free, region=singapore, manual deployments, the verified branch and private runtime variables returned HTTP 400: repository URL invalid or unfetchable. The URL matches the existing verified private repository; missing Git deployment access is the likely cause. A subsequent Render workspace service listing returned null, confirming no service was created. The rejected response is preserved privately. No paid resource, source-visibility change or repeated creation attempt occurred. The user has been asked to connect GitHub deployment credentials and include only the Mandate repository.

The first isolated browser rehearsal timed out waiting for the restored balance after login. Direct cloud-backed application reads had passed; the browser-specific failure is being diagnosed and is not reported as a successful browser/deployment check.

## Browser repair and Render service created — 20 October 2026

The first browser failure was diagnosed as Referrer-Policy=no-referrer causing Origin:null on navigation form POSTs. [Browser reproduction](hosting/2026-10-20/origin-policy-reproduction.json) confirms no-referrer gives null, while same-origin retains the origin. The gateway now uses same-origin; strict host/origin/CSRF checks were not relaxed. [MDN Origin documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin). The earlier diagnostic harness lacked an HTML content type and timed out; its corrected reproduction and the full gateway browser regression pass.

Current local suite: **16 passed, zero failed**, about 2.65 seconds. It adds a real-browser form sign-in/sign-out regression. [TLS browser rehearsal](hosting/2026-10-20/browser-v2/verification.json) using actual Neon plus read-only Sepolia passed anonymous rejection, sign-in, three bills, 650 MDT, zero script errors, no mobile overflow and sign-out invalidation. [Login](hosting/2026-10-20/browser-v2/login-desktop.png), [desktop](hosting/2026-10-20/browser-v2/owner-desktop.png) and [mobile](hosting/2026-10-20/browser-v2/owner-mobile.png) were visually inspected. No model request or public transaction occurred. The earlier failed browser artifacts remain intact.

The repair is pushed in private commit `8495f599ea635e5e68a5643df43225da7164d60a`; staged privacy/docs checks passed for 261 files and 457 local links. Its updated hosting CI is running; the earlier commit retains its separate passing CI result. The user confirmed GitHub repository access was connected. The corrected Render creation returned HTTP 201: service `srv-dbbi29e7bikc738l0pn0`, plan free, region singapore, manual deploys, branch deploy/render-owner-workspace. First deploy: `dep-dbbi2a67bikc738l0tu0`. Assigned URL: https://chainsentinel-mandate.onrender.com. The build is being monitored; this record does not claim the URL is live or restart-tested yet.

## Final live verification — 20 October 2026, 14:16 Bangladesh

The assigned HTTPS URL is live: https://chainsentinel-mandate.onrender.com. Service `srv-dbbi29e7bikc738l0pn0` uses plan free in Singapore; deployed commit `8495f599ea635e5e68a5643df43225da7164d60a`, deployment `dep-dbbi2a67bikc738l0tu0`, status live. [Matching Linux CI](https://github.com/arifshekhk8/chainsentinel-mandate/actions/runs/39391063970) passes all 16 checks (15 plus the separate browser test); [complete CI log](hosting/2026-10-20/github-actions-hosting-browser.txt).

Public checks: GET /healthz returns 200 ready; GET /api/state returns 401; GET /login returns 200; GET / redirects to login. Authenticated checks confirm three reviewed drafts, both original confirmed payment hashes, chain 11155111, 650 MDT, policy 7 and zero agent. Private environment/key/source routes return 404. All six actual runtime secret values are absent from browser state, and runtime plus management secrets are absent from all 261 tracked source files. Render has the intended nine app variables; neither management API key is deployed. Session cookie flags are Secure, HttpOnly and SameSite=Strict.

[Before restart](hosting/2026-10-20/live/before-restart.json) and [after restart](hosting/2026-10-20/live/restart-verification.json) have the same bill/review, owner-intent and payment-history fingerprint `fe9d0737300772f2c898c643db43f280ff30dc9b0a3a37e5555384305630c6b4`. A real Render restart returned HTTP 200 and advanced the startup cloud revision 6→7. Fresh sign-in/restored history/sign-out all pass, with zero script errors or outer mobile overflow. The original restart harness incorrectly expected a new deployment ID and timed out: this API retained the existing live deployment record. Verification was corrected to use the actual restart response, fresh cloud revision and identical owner history; no second restart or fabricated deployment record was used.

[Live desktop](hosting/2026-10-20/live/owner-desktop.png), [live mobile](hosting/2026-10-20/live/owner-mobile.png) and post-restart screenshots were checked. One post-restart full-page mobile capture repeated viewport tiles; the original is preserved and a fresh mobile context/DOM check is used for that artifact. No product layout change or source/evaluation change was inferred from that capture.

Private login details are in `local-data/hosting/owner-login.txt` (0600, ignored). Local source SQLite, original keys, private runtime configuration and migration snapshot are preserved. The repository remains private and autodeploy is off. No new model request, owner wallet signature, funding, permission grant or public-chain transaction occurred. Hosted live-AI calls and actual MetaMask signing were not repeated. The technical report revision 2 predates hosting and needs the URL/access/storage facts before final approval; the competition submission remains unsent.

[Final byte-level audit](hosting/2026-10-20/final-audit.json) confirms the decrypted live cloud workspace is still byte-for-byte identical to the initial 114688-byte SQLite snapshot after restart (SHA-256 `57d7055032473211e007ffa0e6ab785863d40b3f3e476d30007ca9846e59c782`). The private login file is 0600. [Fresh post-restart mobile capture](hosting/2026-10-20/live/after-restart-mobile-fresh.png) and [DOM/capture check](hosting/2026-10-20/live/mobile-capture-check.json) confirm one sidebar, one shell, three bill rows and no outer overflow; the earlier repeated-tile screenshot remains preserved.
