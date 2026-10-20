# Reviewer guide

Team ChainSentinel · Mandate · International Track · Topic F: Agent Wallet

1. Watch the [3:40 captioned demonstration](https://drive.google.com/file/d/1pXyCMtp6S4SXizyRs329teKoPWw_YkYc/view).
2. Read the [technical report](submission/Mandate-Technical-Report.pdf), then the [security self-assessment](submission/Mandate-Security-Assessment.pdf) and [execution evidence](submission/Mandate-Execution-Evidence.pdf).
3. Open [the hosted workspace](https://chainsentinel-mandate.onrender.com) using the password supplied in the submission email. No username, signup or wallet connection is needed to inspect saved records. The service may need time to wake.
4. In **Bills**, inspect HOST-1001 (200 MDT), ART-2001 (150 MDT) and HOST-1002 (75 MDT). Review a bill against its saved source and inspect its confirmed receipt. All three have now been paid.
5. In **Activity** and **Rules & access**, inspect the confirmed final owner stop. Access is cleared; the recorded final balance is 575 MDT and policy version 10. Sign out when finished.
6. For an independent experiment, follow [the local setup](README.md#reproduce-locally) and [test guide](TESTING.md) using disposable test accounts.

The shared hosted password grants workspace access, including editing drafts and using the configured AI quota. There is no separate read-only judge role. Owner approvals and rule changes still require the owner's wallet signature. The restricted agent is revoked. Inspection does not require a new payment or access grant.

## Independent transaction evidence

| Date | Action | Receipt |
| --- | --- | --- |
| 19 October | HOST-1001: 200 MDT | [Sepolia explorer](https://sepolia.etherscan.io/tx/0xa35b0bd2785c1b9272e571d2a5197eb5530089151c6b8e751935b02941931ba4) |
| 19 October | ART-2001: 150 MDT | [Sepolia explorer](https://sepolia.etherscan.io/tx/0x37ba350085b7cf15423745251aa71c8530c7c5915493534663f7eb0a46029ac9) |
| 20 October | HOST-1002: 75 MDT | [Sepolia explorer](https://sepolia.etherscan.io/tx/0x088567a80bd1076ca269bea25e0ed7168b9638d4d90ea268a18c2e7cd12168b7) |
| 20 October | Final agent revocation | [Sepolia explorer](https://sepolia.etherscan.io/tx/0xc90ebb8a9ee27df4ccea6fe606bd428b92f8f3261828ead8141798bc1ce9397e) |

Compare successful receipt status, vault address, exact token Transfer and BillPaid event against [the recorded follow-up](evidence/RECORDED_DEMO_RESULTS.md). Local synthetic receipts and unmined rejection simulations are labeled separately. MDT is a test token with no cash value; organizer acceptance of Sepolia is not independently established.

The reports' 650 MDT checkpoint is the 19 October run. The video contains the later 75 MDT payment and expired-approval recovery. This does not replace or remeasure the earlier fixed evaluation. The [complete submitted package](https://drive.google.com/drive/folders/19YKvnvqd5wzL9QtmsGvZ18Bhrl1FyG7I?usp=drive_link) preserves the original files; [their manifest](submission/manifest.json) records hashes. The original source ZIP describes the repository's earlier private state; this repository was subsequently made public by the team.

If an old hosted page reports a `Sign in to` JSON error, reload and sign in again. Do not repeat a wallet action to solve an expired login session.
