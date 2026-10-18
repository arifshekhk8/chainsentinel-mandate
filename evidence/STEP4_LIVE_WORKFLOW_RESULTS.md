# Step 4 — live app and local payment review

**18 October 2026. Result: passed.** The app, Gemini and the restricted executor were tested together through an isolated Chrome browser and a fresh Anvil chain, ID **31337**. Step 4 is complete for this local prototype. The fixed 40-case evaluation, real wallet-extension testing and public receipts remain separate work.

See the [run history and receipts](step4-live-workflow.json), [actual browser screenshot](step4-live-workflow-desktop.png) and [repeatable check](../scripts/live-workflow.mjs). The successful run completed **10 workflow checks with seven real Gemini calls**. The RPC outage and provider-quota error below were deliberately injected and are labeled separately; they are not additional live model calls.

| Check | Observed result |
| --- | --- |
| Upload a text PDF; ask Gemini for fields | Invoice `HOST-1001`, exact 200 MDT and currency matched the source; applying cleared review |
| Owner source review, exact batch approval and Resume | Three bills approved; vault still held 1,000 MDT; no bill payment from these owner actions |
| Read-only question | Live response produced no payment button or transfer |
| Unclear request, then its answer | Agent asked a question; explicit answer prepared a 350 MDT plan, still awaiting separate confirmation |
| Draft amount correction | Live proposal changed the draft to 180; chain permission stayed 200; the older plan was rejected before transfer |
| Restore the original source amount | Reviewer rejected the test change, restored 200, reviewed again and signed a replacement approval |
| Inject RPC failure during payment simulation | Live plan stopped before broadcast; vault remained 1,000; a fresh request was required |
| Fresh live plan and one confirmation | Exact payments of 200 + 150 MDT, two matching successful receipts, vault balance 650 and daily spend 350 |
| Defer, replay and receipt recovery | 75 MDT bill remained unpaid because daily allowance left was 50; replay rejected; recovery sent nothing |
| Inject provider quota error | Clear error; explicit manual preview worked with its scripted label; no extra payment or exposed key |

The successful payment batch needed **zero additional owner signatures**: the owner-action count remained three before/after execution (initial batch approval, Resume and the replacement hosting approval). Payments used only the separate ephemeral local agent key. Recipient balances, exact amounts, chain/vault references, successful receipt status and payment events were checked independently.

The first workflow attempt stopped in the test harness while moving between owner-confirmation dialogs. Its failed record is preserved. The harness now waits for the dialog to open and for the previous signing action to finish; a fresh full run then passed. No product, contract, model prompt or fixed evaluation case was changed to obtain this result.

## Reproduce only when needed

With the existing private Gemini configuration and local Chrome installed:

```sh
npm run test:live-workflow
```

This explicit command makes up to seven paced Gemini calls and sends **disposable local test transactions**. It creates a separate in-memory database/browser/chain and closes them at the end; it does not operate an existing wallet, reuse local drafts or contact a public RPC. It is refused in CI. The output history appends new runs rather than hiding failed attempts. Existing recorded checks need no routine rerun.

The original [Gemini development results](STEP4_GEMINI_RESULTS.md) retain their earlier HTTP 503/429 history. The normal offline suite remains 58 contract, four identity, 35 app, 46 agent and 13 browser checks; those were not repeated locally merely to add this workflow evidence. No benchmark accuracy or final competition score is inferred from development examples. Use [TESTING.md](../TESTING.md) and [PROGRESS.md](../PROGRESS.md) for the next evaluation stage.
