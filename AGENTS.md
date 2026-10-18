# Working instructions for Mandate

These instructions apply to this workspace. Follow the user's latest instructions and keep all work within the active step.

## Read before working

1. Read [PROGRESS.md](PROGRESS.md) to find the current state and authorization.
2. Read the active step in [PROJECT_PLAN.md](PROJECT_PLAN.md).
3. Read the relevant acceptance criteria in [REQUIREMENTS.md](REQUIREMENTS.md), design in [ARCHITECTURE.md](ARCHITECTURE.md), safeguards in [SECURITY.md](SECURITY.md), and checks in [TESTING.md](TESTING.md).

## Work one step at a time

- Read current authorization in PROGRESS.md. A user instruction to start a numbered step authorizes its listed local work. Plans and sample data alone do not authorize implementation, deployment or sending messages.
- The user starts a step. Complete its necessary work and checks without repeatedly asking about routine choices within that step.
- Do not silently add features or start a later step. After completing a step, report its result and stop. Begin the next when the user asks to continue or names that step.
- Before working, state the step, intended result and files likely to change in simple English.
- Send a short progress update during longer work. Explain blockers and what can still proceed.
- Do not delegate work to other agents unless the user requests it.
- If the user stops for the night, finish only the requested handoff/cleanup and stop. Do not run live AI, start a later step, schedule jobs or resume automatically on the next date. Continue when the user returns.

## Folder and handoff rules

- Keep the seven requested planning files and README at the root. Use the existing `app/`, `contracts/`, `scripts/`, `test/`, `demo/`, `competition/` and `evidence/` folders; avoid duplicate plans or unnecessary downloads.
- Treat PROGRESS.md as the current status. Earlier step reports are historical evidence, not the current task list. Preserve their results and link to the latest report.
- Keep originals, source code, case definitions and saved evidence. Never clear `.env`, local drafts, registration identity files or installed dependencies as routine cleanup. Only remove known disposable build/test output and metadata.
- On return, read the dated resume checklist in PROGRESS.md. Do not repeat completed tests merely because a session restarted; test again when changes, failures or unresolved concerns justify it.

## Keep implementation honest and focused

- Build Mandate as described in the seven planning files. ProofPay and GrantGuard are rejected plans.
- Every payment must refer to owner-approved bill details stored on-chain. AI output and invoice text never grant permission.
- Keep each release tied to the judging map in PROJECT_PLAN.md: prove task completion, contract protection and useful conversation. A read-only question or an ambiguous request must not silently start payments.
- Use synthetic bills and test tokens. Support local development and Sepolia only in this prototype.
- Never request a seed phrase or owner private key. Keep secrets out of source files, browser responses, model prompts and logs.
- Obtain an explicit user instruction before wallet setup that sends transactions, public deployment, emails, registration submission or project publication. A request to create plans grants none of these permissions.
- Label scripted mode, local-chain evidence and public-testnet evidence correctly. Never invent payments, test results, users, savings or finalist-selection claims.
- Use exact integer token amounts. The model does not calculate balances or decide whether contract rules pass.
- Keep dependencies and files minimal. Verify current official documentation before relying on a library or API; record the versions actually chosen during implementation.
- Keep the GitHub repository private. Use the configured Git author and meaningful, plain-language commit messages; do not add AI co-author trailers, invent an earlier development history or backdate commits. Push coherent changes separately when requested. Never stage keys, local invoices/databases or completed registration/identity material.

## Finish each session

1. Run checks appropriate to the active step; investigate failures instead of hiding them.
2. Check changed requirements against implementation and tests. Keep their IDs consistent.
3. Update [PROGRESS.md](PROGRESS.md): completed work, evidence, current work, blockers, decisions and next action.
4. Update other planning files only when the agreed design changes. Do not mark planned work as completed.
5. Report what changed, what passed, what remains untested, and the next step. Keep generated caches and secrets out of the project.
