# Step 5 — Sepolia preparation

**Historical preparation snapshot, 19 October 2026, Asia/Dhaka:** local checks passed before public sending was authorized. Subsequent authorization and all seven verified owner-confirmed setup actions are documented in the [current public report](STEP5_SEPOLIA_RESULTS.md). The preparation observations below retain their original scope. [Exact public bill execution and unmined replay/daily-limit rejection](sepolia/public/step5-sepolia-payment-verification.json) are now verified; owner revocation/stop and final export are now verified in the public report.

**At preparation:** no public transaction had been sent. The user started the remaining Step 5 and supplied a public owner address. The deployment review then ran at `http://127.0.0.1:4174` with wallet requests disabled, and an unsent token-deployment review was saved privately. Actual extension operation and public deployments/payments were unverified at that checkpoint. The current public report supersedes those status statements; organizer acceptance remains unconfirmed.

## Spending review

| Item | Limit or observation |
| --- | --- |
| Total reviewed owner outflow | **0.001 Sepolia ETH maximum**, including setup, owner actions and the entire agent funding |
| Separate agent funding | **0.00005 Sepolia ETH**, included above; allocation, not a claim that all of it is burned as gas |
| Maximum fee per gas | **0.05 gwei**; stop above the cap, without raising it automatically |
| Confirmation policy | Two public confirmations; not an absolute finality guarantee |
| Token | 1,000 synthetic six-decimal MDT, no purchase or real-value claim |
| RPC fee observation | 19 October, about 17:20 Bangladesh: base fee 15 wei, priority fee 1 wei, quoted maximum 33 wei |
| First unsent token review | Gas limit 4,109,378 after 20% allowance; maximum debit 0.000000000135609474 ETH at that quote |

Fees change. Every action is simulated and priced again before wallet submission. Maximum reviewed outflow is reserved durably, including pending/unknown actions; this conservative reservation is not actual spending. An action that would exceed the remaining budget is refused. The wallet must retain the reviewed fee/gas bounds. No automatic resend, replacement, fee increase or provider fallback exists.

Read-only RPC probes also tested vault creation using a temporary six-decimal token stub in an `eth_estimateGas` state override. No code was deployed. The probe estimated 12,616,726 gas, or 15,140,072 with the 20% allowance. This is a constructor preflight, not execution evidence or a substitute for estimating against the real deployed MDT. The application ceiling is 16,000,000 gas, below the [EIP-7825 limit](https://eips.ethereum.org/EIPS/eip-7825). The independent ETH cap still applies. Higher public estimates are not inferred from the lower local Cancun deployment measurements.

## Prepared workflow

Seven explicit owner reviews deploy MDT, deploy the initially paused vault, deposit 1,000 MDT, register two fictional vendors, grant the separate restricted agent 24-hour access and fund that agent with 0.00005 ETH. Limits stay 250 MDT per bill, 400 MDT per UTC day and a 300 MDT reserve. Bill approvals and Resume are later separate owner actions. AI cannot authorize any of these.

`npm run sepolia:setup -- --owner YOUR_PUBLIC_ADDRESS` creates or preserves private setup state and starts review only. `--allow-wallet` enables wallet requests only after the user's explicit public-action instruction. Stop the owned process before switching modes; never run two against the same database. The browser checks the owner, Sepolia, exact calldata/destination/value and fee limits before requesting each signature. A durable `wallet_requested` state is written before opening the wallet. A lost response stays locked; recover the original hash rather than send again. Explicit wallet rejection can cancel an unsent review.

After all setup receipts match, `npm run sepolia` opens the persistent owner workflow. `npm run sepolia:export` verifies setup receipts and exports public metadata after stopping the app. The export does not claim actual extension testing without separate observation. RPC credentials and agent keys are excluded.

The dedicated agent key is stored only in ignored `local-data/sepolia/agent-key.json`, owner-readable with mode 0600. It is not encrypted by this prototype. Setup files are preserved across restarts. The owner key remains in the browser wallet and is never requested or read. Existing local drafts and private registration material are untouched.

## Verification

| Check | Result / evidence |
| --- | --- |
| Sepolia preparation and public-branch boundaries | 11 passing local tests: [latest output](sepolia/preparation/checks/step5-sepolia-preparation-tests-final.txt) |
| Full seven-step deployment/payment rehearsal | [Local chain 31337 receipts](sepolia/preparation/step5-sepolia-preparation-local.json): paused funded vault, explicit owner approvals/Resume, exact 200 + 150 MDT payments, 650 MDT left, replay rejection and revocation |
| Existing agent checks | 59 passed: [output](sepolia/preparation/checks/step5-sepolia-agent-regression.txt), [separate scripted proof](sepolia/preparation/step5-sepolia-scripted-agent-regression.json) |
| Existing owner/intake checks | 35 passed: [output](sepolia/preparation/checks/step5-sepolia-app-regression.txt) |
| Browser checks | 19 passed: [output and screenshots](sepolia/preparation/ui/v4/); isolated disposable wallets, including lost-response recovery and read-only setup |
| Evaluator checks | Nine passed: [output](sepolia/preparation/checks/step5-sepolia-evaluator-regression.txt) |
| Human-readable review | [Local setup screenshot](sepolia/preparation/step5-sepolia-setup-review-local.png) |

Public-chain behaviors requiring two confirmations and fee matching are exercised with local chains and controlled RPC responses; these are not actual public-network confirmations. The unchanged 58 mandatory contract checks passed earlier in Step 5 and were not rerun solely for this integration. No new live model call was made. Browser-only assertions were checked after their UI changes; the later gas-ceiling boundary change was checked in the preparation suite.

Initial preparation v1/v2 runs exposed invalid test hash/report aggregation in the harness; the preserved outputs disclose both failures. Browser v1/v3 exposed an outdated synthetic-note fixture and a missing test-wallet connection. The fixtures were corrected; no failing case was skipped and no timeout was raised. The full passing browser run followed the lost-response UI repair. Original Step 3/4 saved evidence was restored after the regression runs.

The [integration freeze](../demo/evaluation-freeze-sepolia-v1.json) preserves the [Groq v5 freeze](../demo/evaluation-freeze-groq-v5.json) and archived earlier service/executor/client/runner source. The completed 40-case metrics remain evidence for that historical version. Contracts, prompts, selected model and casebook are unchanged. This integration has the checks above, not a new 40-case model measurement or public receipt.

[Final checks](sepolia/preparation/step5-sepolia-preparation-final-checks.json) verify all 47 frozen source hashes, review-only state, zero public hashes, unchanged real Git index, original competition templates and candidate-file/private-path hygiene. Actual API/agent key values were checked against candidate Git files and both browser bundles without printing them. Trailing whitespace was trimmed in two browser logs; all failure/result text remains. No source was committed or pushed. At that preparation checkpoint, the public-spending question was pending and wallet requests were disabled. The later explicit cap approval and verified setup are recorded in the current public report; the original preparation evidence is unchanged.

## Subsequent Step 5 completion

The concrete public-spending instruction and all seven owner-confirmed setup actions are complete; [receipts and actual MetaMask observations](STEP5_SEPOLIA_RESULTS.md) are recorded separately. The owner app is running at `http://127.0.0.1:4173` with its existing database/key. Three synthetic sample drafts are now loaded and checked against source/registry. The owner has since reviewed all three; their exact public batch approval and separate [Resume receipt/state](sepolia/public/step5-sepolia-resume-verification.json) are verified. The [first live read-only response](sepolia/public/step5-sepolia-read-only-observation.json) caused no payment but missed the requested approved total (350 MDT eligible shown versus 425 MDT approved). [Ambiguous clarification](sepolia/public/step5-sepolia-clarification-verification.json) is now verified with no selected bill or payment. The [explicit 350 MDT payment plan](sepolia/public/step5-sepolia-payment-plan-verification.json) is now independently verified. The user has since executed it: [exact public payments, balances and read-only replay/daily-limit rejections](sepolia/public/step5-sepolia-payment-verification.json) are verified. [Confirmed owner revocation/OnlyAgent simulation](sepolia/public/step5-sepolia-revocation-verification.json) and the [final export](sepolia/public/step5-sepolia-export-verification.json) are now independently verified. The revoked-state bill also exceeds today’s remaining daily allowance; clean otherwise-eligible revocation remains separate local-test evidence. Step 5 is complete within its recorded scope. Do not redeploy or rerun setup. Organizer acknowledgment, Sepolia acceptance and the final submission channel remain unresolved. Step 6 has not started; no email, publication, commit or push was performed here.

Official references checked during implementation: [ethers providers](https://docs.ethers.org/v6/api/providers/), [contract deployment preparation](https://docs.ethers.org/v6/api/contract/), [wallet generation](https://docs.ethers.org/v6/api/wallet/), [Ethereum networks](https://ethereum.org/developers/docs/networks/) and [PublicNode](https://www.publicnode.com/). Existing versions remain Node 25.2.1, ethers 6.17.0, Foundry 1.7.1 and Solidity 0.8.37; no dependency was added.
