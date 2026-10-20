# Hosted workspace verification — 20 October 2026

Mandate runs on Render with encrypted Neon persistence. The deployed implementation is `8495f599ea635e5e68a5643df43225da7164d60a`; source handover commit `3fe846b56197b8cc04e2ac3756531bb151e7bc43` adds documentation and evidence. This source organization does not deploy a replacement service.

## Verified behavior

- HTTPS sign-in/logout and anonymous API rejection were checked. Private file routes remain inaccessible. Existing Host/Origin/CSRF enforcement is retained behind the gateway.
- A consistent 114688-byte source workspace was encrypted into Neon. Restored plaintext matched SHA-256 `57d7055032473211e007ffa0e6ab785863d40b3f3e476d30007ca9846e59c782` after a real service restart. The original data was preserved.
- Cloud revision fencing blocks stale writers. Persistence failures block further work; uncertain transactions reconcile their original hashes instead of resending.
- At the hosting checkpoint, three reviewed bills, two original payment receipts, 650 MDT and revoked policy 7 survived restart. The separate later recording paid 75 MDT, leaving 575 and revoked policy 10; see [the dated follow-up](RECORDED_DEMO_RESULTS.md).
- The later password-only change passed new-password sign-in, old-password rejection and logout checks. Passwords, API/database keys and management access records are excluded from this repository.

## Checks and limitations

Sixteen local synthetic hosting checks passed, including browser sign-in/sign-out. [The recorded Linux CI](https://github.com/arifshekhk8/chainsentinel-mandate/actions/runs/39393603438) passed on the handover revision. The checks cover encrypted storage, migration, conflicting saves, save failure before broadcast, exact disposable-chain payments and the login form. They are not new live-model evaluation cases or public payments.

Earlier harness/browser failures and the first unsuccessful service-creation attempt were investigated before the successful deployment. Original failure artifacts and later passing checks remain under [hosting evidence](hosting/). They are not counted as additional successful cases.

The hosted password grants a full shared workspace; there is no separate read-only judge role. Owner changes still require the owner's wallet signature, and the restricted payment agent is revoked. Sessions expire after eight hours and service restarts clear session memory. An old page may show a JSON parse error after login expiry; reload and sign in again. The prototype has no external security audit or production-service claim.

## Evidence

- [Final cloud audit](hosting/2026-10-20/final-audit.json)
- [Restart verification](hosting/2026-10-20/live/restart-verification.json)
- [Browser verification](hosting/2026-10-20/browser-v2/verification.json)
- [Later reviewer access verification](hosting/2026-10-20/reviewer-access/access-verification.json)
- [Recorded hosting CI output](hosting/2026-10-20/github-actions-hosting.txt)
- [Recorded browser CI output](hosting/2026-10-20/github-actions-hosting-browser.txt)

Implementation and independent reproduction: [hosting guide](../competition/HOSTING.md), [tests](../TESTING.md), [gateway](../scripts/hosting/gateway.mjs), [persistence](../scripts/hosting/persistence.mjs).
