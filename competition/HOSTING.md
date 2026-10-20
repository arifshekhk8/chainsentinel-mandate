# Mandate hosted owner workspace

The hosting adapter runs the existing Sepolia application on Render Free and keeps an encrypted copy of its SQLite workspace in Neon Free. Use synthetic bills and test tokens only. The owner key stays in the browser wallet; the server uses only the existing restricted test-agent key. Deployment and startup do not grant on-chain access or send payments.

**Verified live, 20 October 2026:** [Open Mandate](https://chainsentinel-mandate.onrender.com). Protected sign-in, the original three reviewed bills/two receipts and identical history after a real restart pass. Use the private owner login file locally; never publish it. [Evidence](../evidence/HOSTING_RESULTS.md).

## Source and configuration

The private GitHub repository remains private. The deployment branch is `deploy/render-owner-workspace`. [render.yaml](../render.yaml) specifies one free Node service in Singapore, `/healthz` readiness and manual deployments. Direct API creation uses the same settings; no Blueprint sync is active unless explicitly configured later. Keep these two representations synchronized when changing hosting.

Build with `npm ci --include=dev && npm --prefix scripts/hosting ci --omit=dev && npm run build && npm run build:app`. Start with `node scripts/hosting/start.mjs`. Node is pinned to 25.2.1; the hosting package separately pins `@neondatabase/serverless` 1.2.0. The public gateway listens on `0.0.0.0:$PORT`, while the original application remains on a private loopback port.

Required private runtime values: `DATABASE_URL`, `MANDATE_OWNER_PASSWORD`, `MANDATE_SESSION_SECRET`, `MANDATE_STORAGE_SECRET`, `MANDATE_AGENT_PRIVATE_KEY` and `GROQ_API_KEY`. Also set `AI_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-120b` and `NODE_VERSION=25.2.1`. Render provides `RENDER_EXTERNAL_URL`. Keep all secret values in private configuration; none belong in source or a submission archive. Management API keys are separate and must not be deployed as app variables.

## First migration and recovery

Stop the old local signing workspace before moving to the hosted one. Preserve its files. Run `node scripts/hosting/migration.mjs` only after privately preparing `local-data/hosting/render-secrets.env`. It takes a consistent read-only SQLite backup, encrypts it, saves only into an empty cloud workspace and compares the restored bytes. It refuses to overwrite existing cloud state. Preserve the storage secret: replacing it makes existing ciphertext unreadable.

Render's local files are ephemeral. On startup, the app restores a fresh temporary SQLite file from Neon. Saved bills, reviews, original transaction hashes and receipts survive local-file loss. Cloud revision checks fence older hosted instances. Save failures block further work; an uncertain transaction keeps its original hash and is never blindly retried. Keep one active owner workspace. A transaction already in flight can still finish after an instance change; its saved original hash is reconciled.

Use the owner password from private runtime configuration to sign in. Sign-out invalidates the current session. Sessions expire after eight hours and reset when the service restarts. The public health check returns readiness only; app/API routes require authentication, and writes retain the original CSRF check.

## Checks and current scope

Run `node --test test/hosting.test.mjs test/hosting-migration.test.mjs test/hosting-browser.test.mjs` after installing both dependency sets and building contracts. These 16 local checks cover authentication, source-preserving migration, encrypted recovery, conflicting saves, storage failure before broadcast and exact disposable-chain payments. Browser checks use an isolated Chrome profile locally and Chromium in CI; install Chromium with `npx playwright install --with-deps chromium` in a new CI environment. The hosting CI workflow repeats them on Ubuntu without cloud/model/wallet credentials.

Before claiming deployment complete, verify the actual Render build, unauthenticated API rejection, sign-in, retained three-bill/two-payment history, expected Sepolia balance/revoked agent and persistence after a cloud restart. A successful create request or build alone is insufficient. Check [PROGRESS.md](../PROGRESS.md) for the latest actual status.

Free Render services can sleep and take time to wake. Neon and Render free usage limits still apply. This is a protected competition prototype, not production authentication or an external audit. The original evaluation and public Sepolia receipts remain historical evidence; hosting checks do not add new model-evaluation cases or on-chain payments.

Official references checked 20 October 2026: [Render free services](https://render.com/docs/free), [Blueprint specification](https://render.com/docs/blueprint-spec), [Render environment settings](https://render.com/docs/configure-environment-variables), [Neon pricing](https://neon.com/pricing), [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver).
