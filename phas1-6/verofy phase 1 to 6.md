# Master Prompt: Verify Phases 0 to 6 (for Antigravity IDE or any coding agent)

**How to use**
1. Open the repository `SiddharajShirke/test-exam` in the IDE on the branch `phase/06-ai-generation` (or `main` once the "Phases 3 to 6" pull request is merged).
2. Put the three guide files in the repo first (the prompt tells the agent where): `docs/LOCAL_RUN_AND_TEST_GUIDE.md`, `docs/OFFICE_AZURE_CONNECTION_GUIDE_PHASES_1_6.md`, `docs/CODEBASE_MAP.md`.
3. Paste **everything between the two lines `=== BEGIN PROMPT ===` and `=== END PROMPT ===`** into the agent chat. It works with Claude, Gemini or any model that can read files and run a terminal.
4. If your IDE model cannot run terminal commands, it must say so in its first answer. Then run the commands yourself and paste back the output.

---

=== BEGIN PROMPT ===

# ROLE

You are a senior backend QA and release engineer working inside my IDE on an **existing** repository. Your job is to **independently verify** that Phases 0 to 6 of the *AI Candidate Assessment Platform: MVP Edition* backend behave exactly as the written specifications require, to **fix only what is proven wrong**, to **document the result**, and to do all of it on **properly named git branches**. You do not rebuild, redesign or "improve" anything that works.

Be honest above all. **Never write "passed" for anything you did not run.** Quote exact command lines and exact result lines. If you cannot run something, write `NOT RUN` and the reason. If something can only be proven in GitHub Actions or at the office in Azure, write `UNVERIFIED (CI)` or `UNVERIFIED (Azure)` and point to the ledger entry.

# STEP 0: READ FIRST, IN THIS ORDER (do not skip; do not start work before you have read them)

1. `AGENTS.md`
2. `docs/prompts/PROMPT_C_STACK_OVERRIDE_PYTHON.md` (stack: Python 3.12 + FastAPI + Pydantic v2 + SQLAlchemy Core/pyodbc; **Node.js is 0%**; overrides A and B)
3. `docs/prompts/PROMPT_B_ADDENDUM_OFFLINE_AZURE_READY.md` (authoritative; overrides A)
4. `docs/prompts/PROMPT_A_MASTER.md` (master plan: backend only, 37 endpoints, phases 0 to 13)
5. `docs/PROGRESS.md`, `docs/decisions.md`, `docs/UNVERIFIED_AZURE_LEDGER.md`
6. `docs/phase-reports/` (00 to 06), `docs/CODEBASE_MAP.md`
7. `docs/LOCAL_RUN_AND_TEST_GUIDE.md` and `docs/OFFICE_AZURE_CONNECTION_GUIDE_PHASES_1_6.md`

Order of authority when documents disagree: **my latest message > the decision record in `docs/` > Prompt C > Prompt B > Prompt A**. If the repository code contradicts a document, report it as a finding; do not silently pick a side.

Then reply with a **10-line summary of the rules you will obey** and the **branch plan** (below). Continue immediately after that; do not wait for approval unless a rule below says STOP.

# NON-NEGOTIABLE RULES

1. **No Docker** on my machine. Do not run `docker`, `docker compose`, `podman`, or build images. Docker runs only on GitHub Actions runners.
2. **No Azure access.** Never run `az login` or any `az` command, never call a real Azure endpoint, never ask me for an Azure password, key, token, MFA code or connection string. If a task needs one, STOP and tell me.
3. **No secrets anywhere:** not in files, comments, commit messages, PR text, logs, terminal output you quote, or your answers. Use placeholders such as `<SQL_SERVER>`, `<AI_RESOURCE>`, `<ACR>`.
4. **The repository is public.** Never write real Azure resource names, subscription/tenant ids, hostnames, emails, keys or tokens.
5. **Zero-touch on Azure.** The line `SIGN-OFF: APPROVED by ...` in `docs/PROVISIONING_PLAN.md` is written **only by a human**. You must never write, edit or imitate it. Provisioning scripts must stay dry-run by default and refuse to write without it.
6. **Backend only.** Do not create or modify `frontend/`, `backend/`, `database/` or `ai_service/` (you may read `ai_service/`). All backend code is under `api/`.
7. **Git:** never commit to `main`. One branch per piece of work, small commits, a PR per branch, merge only when CI is green. **Do not push** unless I tell you to; if you cannot push, tell me exactly which commands I should run. Never force-push, never rewrite history, never delete branches.
8. **Do not weaken tests to make them pass.** Never delete a test, loosen an assertion, add `skip`/`xfail` or change expected values unless a test is *proven* wrong against the specification, and then say so explicitly in the report with the spec reference.
9. **Budget $25/month, 0.25 vCPU / 0.5 GiB, exactly 1 replica** for `assess-api`: do not change any design that conflicts with this.
10. **No stack drift:** no Node/npm in `api/`, no new heavy dependency without a written reason in `docs/decisions.md`.
11. Keep every change **minimal and reversible**. If a fix touches more than ~40 lines, explain why in the commit message.
12. If anything in this prompt would force you to break a rule above, STOP and ask.

# WHAT YOU ARE VERIFYING (ground truth, from the last verified run on a clean copy)

| Item | Expected result |
|---|---|
| `ruff check api scripts tests` | `All checks passed!` (ruff pinned `>=0.16,<0.18`) |
| `ruff format --check api scripts tests` | `117 files already formatted` |
| `cd api && mypy app` | `Success: no issues found in 64 source files` |
| `pytest -m "not sql and not container and not azurite"` | `719 passed, 2 skipped, 288 deselected` in about 75 s |
| Per folder (same `-m` filter) | phase0 `86 passed, 1 skipped`; phase1 `56`; phase2 `96`; phase3 `105 passed, 1 skipped`; phase4 `96`; phase5 `108`; phase6 `172` |
| Live harness `python scripts/e2e/run.py --base-url http://127.0.0.1:<port> --upto 6` (server started with defaults) | `E2E PASS: 28/28 checks passed` |
| `python tests/phase3/postman/run_collection.py --base-url ...` | UNIT 30/30, INTEGRATION 33/33, E2E 15/15 |
| `python tests/phase6/postman/run46.py --base-url ...` | UNIT 35/35, INTEGRATION 43/43, E2E 37/37 |

If your numbers differ, that is a **finding**: investigate, do not ignore.

# ENVIRONMENT SETUP

```bash
python3.12 -m venv .venv && . .venv/bin/activate          # Windows: py -3.12 -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -r api/requirements-dev.txt
```
Facts you must respect:
* Settings come **only from environment variables**. `.env` files are **not** loaded. Defaults are fully in-memory/fake (`REPO_BACKEND=memory`, `AI_MODE=fake`, `EMAIL_MODE=fake`, `FILES_MODE=memory`).
* Start the server from `api/`: `python -m app.main` (port 8080; set `PORT=...` for another). Docs UI is at `/api/v1/docs` in development only.
* **Two server modes.** Default (`COOKIE_SECURE=true`) is for the harness and the Postman runners. `COOKIE_SECURE=false` is for manual curl/browser use; two harness checks fail by design in that mode, so never run the harness against it.
* After a failed second start ("address already in use") the **old server keeps answering**: always confirm which process you hit. Restart the server between full harness/Postman runs (rate limits and lockouts live in memory).
* Platform key for local calls: `dev-only-platform-key-change-me-00000`.
* Tests marked `sql`, `container`, `azurite` need SQL Server / Docker / Azurite and are skipped locally; they run in GitHub Actions. Do not try to install SQL Server.

# BRANCH PLAN (proper naming)

Create from the current head of `phase/06-ai-generation` (or from `main` after the phases 3 to 6 PR is merged). Use exactly these names; add `fix/<short-kebab-name>` branches for each real defect you prove.

| Branch | Purpose | Contents |
|---|---|---|
| `docs/local-run-and-office-guides` | add the three guide files and the CODEBASE_MAP | `docs/LOCAL_RUN_AND_TEST_GUIDE.md`, `docs/OFFICE_AZURE_CONNECTION_GUIDE_PHASES_1_6.md`, `docs/CODEBASE_MAP.md`, link them from `README.md` and `docs/PROGRESS.md` |
| `fix/infra-and-docs-match-workflows` | correct the repository where it disagrees with the workflows (list in section "KNOWN FINDINGS") | scripts, YAML, older guide, plan rows (never the sign-off line), ledger |
| `test/verification-report-phases-0-6` | the evidence | `docs/phase-reports/verification-phases-0-6.md`, `docs/PROGRESS.md` update |
| `fix/<name>` | one per real defect | the fix **plus a regression test that fails before and passes after** |

Commit message format: `type(scope): imperative summary` (types: `docs`, `fix`, `test`, `chore`), a short body saying *why*, and, if your tool adds one, its co-author line. PR description: **What / Why / How I verified (commands + result lines) / Risks / Not verified**. Do not mention secrets or real names.

# STAGES (do them in order; tick them in a task list; report after each stage)

## Stage A: Baseline (read-only, no changes)
1. `git status`, `git log --oneline -10`, `git branch -a`. Confirm the branch and that `frontend/`, `backend/`, `database/`, `ai_service/` have no diff against `main` (`git diff --stat main..HEAD -- frontend backend database ai_service` must be empty).
2. Set up the environment (above).
3. Run the three quality gates and the full pytest command from the table. Then run **each phase folder separately** (`pytest tests/phase0 -m "not sql and not container and not azurite"` ... `phase6`). Record counts.
4. Start the server in default mode on a free port, run the harness (`--upto 6`) and both Postman runners. Stop the server (`Ctrl+C`; the log must show `job_loop_stopped` and `shutdown complete`).
5. Compare every number with the table. Write a **baseline table** (command, result line, PASS/FAIL).

## Stage B: Specification conformance audit (read code + run targeted checks)
For each phase, open the spec sections in Prompt A/B/C and the code, and fill **one row per requirement**: *requirement, source (doc + section), where implemented (file:line), how verified (test name or command), result (PASS / FAIL / UNVERIFIED (CI) / UNVERIFIED (Azure) / DEVIATION)*. Check at least:

**Phase 0 Foundation:** settings validation and production guard (production refuses `AI_MODE/EMAIL_MODE/FILES_MODE` fakes, `REPO_BACKEND=memory`, `dev-only` secrets, secrets under 32 chars, `COOKIE_SECURE=false`); JSON logger redacts secrets; uniform error envelope `{"error":{"code","message","details?"}}`; `x-request-id` echoed/generated; `x-app-version`; security headers (`x-content-type-options`, `x-frame-options`, `referrer-policy`, `strict-transport-security`, `cache-control: no-store`, `cross-origin-resource-policy`); per-route body-size limits (`413 PAYLOAD_TOO_LARGE`); unknown route → `404 NOT_FOUND` envelope; health route; provider ports with fake and Azure implementations; docs UI off in production.

**Phase 1 Azure scripts:** every `infra/azure/*.sh` is dry-run by default (`DRY_RUN=1`), sources `_run.sh`, and its write commands refuse to run without the human sign-off line; read-only discovery contains none of the forbidden verbs (`keys list`, `list-key`, `show-connection-string`, `get-shared-keys`, `secret show`, `exec`, `create`, `update`, `set`, `delete`); no real names/ids/secrets in any script; `python -m app.tools.probe <config|sql|blob|foundry|insights|acs|all>` never prints secrets (masking), exits non-zero on failure, and email is never part of `all`.

**Phase 2 Database:** exactly the tables `tenants, users, sessions, login_attempts, assessments, questions, participants, attempts, responses, scores, jobs, audit_log` plus `schema_migrations`, all in schema `assess`; migrations `0001`, `0002`, `0003` are idempotent and **match `api/app/db/schema.py`** (parity test); every repository method is tenant-scoped (`assert_tenant`); only the pinned cross-tenant system queries exist (and `TENANTLESS_BY_DESIGN`); malformed UUID → `400`, unknown or foreign id → `404` (never `403`).

**Phase 3 Container/pipeline:** Dockerfile is multi-stage, non-root, no secrets, no `:latest`, port 8080, graceful shutdown within the 30 s Container Apps grace; `deploy.yml` job order `fast → container → security → deploy`, least-privilege `permissions`, `deploy` only on `main` and only when `vars.AZURE_DEPLOY_ENABLED == 'true'`, OIDC login (no stored secret), smoke test compares `x-app-version` to the commit SHA, automatic rollback on failure; `live-e2e`, `nightly`, `rollback`, `load-test` workflows exist; E2E harness has one check module per phase.

**Phase 4 Auth/tenants/users (endpoints 1 to 7):** Argon2id with the floor 19 MiB / 2 iterations / 1 lane; password length bounds; cookie `sid` is signed, `HttpOnly; Secure; SameSite=Lax`, only its SHA-256 is stored; idle expiry 30 min, absolute 8 h; lockout after 5 failed logins in 10 min → `429 RATE_LIMITED`; same `401 INVALID_CREDENTIALS` message for unknown user and wrong password; platform key compared in constant time, rate-limited, `401` either way; roles `admin`/`recruiter`; recruiter gets `403` on user management; last active admin cannot be disabled/demoted (`409 CONFLICT`); tenant A can never read or change tenant B (`404`).

**Phase 5 Assessments/JD (endpoints 8 to 14):** CRUD + close; sections 1 to N with `type/domain/difficulty/count`; JD upload: PDF/TXT, ≤ 2 MB, extracted text 20 to 20,000 characters, blob path `{tenantId}/{assessmentId}/{file}`, `FILE_UNREADABLE` for no-text PDFs, the blob is removed on delete; `close` only from approved/open (`409` otherwise); per-route body limits.

**Phase 6 Jobs and AI generation (endpoints 15 to 22):** DB-backed job engine (2 s tick, ≤ 3 concurrent, max 3 attempts, back-off 5 s × attempt, provider `Retry-After` wins, stuck jobs re-queued after 5 min, graceful stop ≤ 20 s); AI calls in batches of 5 in JSON mode, JD fenced as data (`<<<JD ... JD>>>`) so it cannot act as instructions; validator (4 unique options, answer A to D, explanation; rubric, `maxScore` 1 to 20, `wordLimit` default 250); duplicate questions dropped (Jaccard > 0.8); `AI_OUTPUT_INVALID` (non-retryable) after 3 invalid answers; section replace is atomic (no partial questions); daily caps per tenant per UTC day (20 generations and `AI_DAILY_TOKEN_CAP`) → `429 DAILY_AI_LIMIT` with `Retry-After`; check order for generate: `404`, `409`, `422 JD_TOO_SHORT` (< 100 words), `400` bad `sectionIndexes`, `429`; objective questions default to 1 mark; approval requires every section to hold **exactly** its configured count (`409 SECTION_INCOMPLETE` / `409 NO_QUESTIONS`); positions renumbered per section; edit after approval → `409`; regenerate keeps id and position.

Where a requirement is only provable in CI or Azure, do **not** guess: mark `UNVERIFIED (CI)` or `UNVERIFIED (Azure)` and cite the ledger id (AZ-001 to AZ-030).

## Stage C: Live end-to-end walkthrough by hand
Follow `docs/LOCAL_RUN_AND_TEST_GUIDE.md` sections 5 to 7 on a server started with `COOKIE_SECURE=false`. Run, and record the **exact HTTP status and key fields** for: create tenant (and wrong key `401`), login (and wrong password `401`, 5 failures then `429`), `/auth/me`, create recruiter, recruiter `403`, last-admin `409`, cross-tenant `404`, bad UUID `400`, logout then `401`, create assessment, JD upload (text and, if you can create one, a PDF), body too large `413`, generate (`202` → `done`, 4 questions), short-JD `422`, bad section index `400`, patch question (`source` stays `ai`), regenerate (same id/position), delete one question then approve (`409 SECTION_INCOMPLETE`), approve with no questions (`409 NO_QUESTIONS`), close on a draft (`409`), other tenant `404`, delete (`204`). Any difference from the guide is a finding: fix the **guide** if the guide is wrong, or open a `fix/` branch if the code is wrong.

## Stage D: Hygiene and safety scans (run all; explain every hit)
```bash
git grep -nIE "[a-z0-9-]+\.(database\.windows\.net|azurecr\.io|blob\.core\.windows\.net|openai\.azure\.com|services\.ai\.azure\.com|azurecontainerapps\.io|communication\.azure\.com|azurecomm\.net)" -- . ':!frontend' ':!backend' ':!database' ':!ai_service' | grep -v "<"
git grep -nIE "(AccountKey|SharedAccessKey|Password|api-key|accesskey)=[A-Za-z0-9+/=_-]{12,}" -- . ':!frontend' ':!backend' ':!database' ':!ai_service'
git grep -nIE "(ghp_|github_pat_|AKIA|sk-[A-Za-z0-9]{20})" -- . ':!frontend' ':!backend' ':!database' ':!ai_service'
git grep -nIEho "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" -- . ':!frontend' ':!backend' ':!database' ':!ai_service' | sort -u
git grep -nIEi "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" -- docs infra scripts .github README.md AGENTS.md
```
Known acceptable hits: obviously fake fixtures **inside `tests/`** (`myserver.database.windows.net`, `res.openai.azure.com`, `SuperSecret123`, `*@example.com`, `*@x.example`, the all-zero UUID in `p06_generation.py`). Anything else (real-looking host, id, email, key) is a **critical finding**: report it to me immediately, do **not** paste it in your answer, and do not commit it anywhere.
Also check: no `package.json`/`node_modules` under `api/`; `.gitignore` excludes `.env`, `.venv`, caches; `api/.env.example` contains only placeholders and names that exist in `Settings`; `git status` is clean of stray files (`jar.txt`, `*.json` dumps, `.pyc`).

## Stage E: Negative and robustness probes (script them in `tests/` only if they find a real bug)
Try to break it, and record what happens: oversize bodies on every route; invalid JSON; extra unknown fields; very long strings; Unicode names/emails; SQL-ish and HTML-ish input (`' OR 1=1 --`, `<script>`); duplicate emails across tenants (allowed) and within one tenant (`409`); expired/forged/stripped `sid` cookie; reuse of a logged-out cookie; generation concurrently on the same assessment from two clients (no duplicated or partial questions); `Ctrl+C` while a job runs (no crash, job re-queued); 21 generations in one UTC day. A crash, a `500`, a leaked stack trace or a secret in a response/log is a defect.

## Stage F: Fix only what is proven wrong
For each defect: reproduce → write a regression test that **fails** → fix → test **passes** → full suite still `719+` passed → commit on a `fix/<name>` branch. Never batch unrelated fixes.

## Stage G: Documentation (branch `docs/local-run-and-office-guides`)
1. Place the three guide files at the paths above (copy the content I provide; do not shorten it). Add links in `README.md` ("Local run and test", "Office Azure guide", "Codebase map") and in `docs/PROGRESS.md`.
2. Fix the root `README.md` quick start: it says `cp api/.env.example api/.env # optional`; **`.env` is not read by the app**. Replace it with the real behaviour (settings are environment variables; defaults already run in memory; `COOKIE_SECURE=false` only for manual curl/browser use).
3. Keep every command, file name, workflow name, variable and secret name in the docs **exactly equal to what the code uses**. Never write real Azure names.

## Stage H: Repository corrections (branch `fix/infra-and-docs-match-workflows`) — KNOWN FINDINGS
These were found by reading the workflows against the scripts. **Confirm each one yourself first** (quote file and line), then fix it. Changes are to files only; no Azure access is needed.

| # | Finding | Fix |
|---|---|---|
| 1 | `docs/OFFICE_CONNECTION_AND_TESTING_GUIDE.md` lists GitHub variables `ACR_NAME`, `RG_NAME`, `API_APP_NAME`, `API_URL`; the workflows read `AZURE_RESOURCE_GROUP`, `AZURE_ACR_NAME`, `AZURE_DEPLOY_ENABLED` and secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | correct the older guide to the workflow names |
| 2 | `deploy.yml` job `deploy` uses `environment: production`, so the OIDC subject is `repo:...:environment:production`; `infra/azure/70-assess-api.sh` creates only the `ref:refs/heads/main` federated credential | add the second credential to the script; add a row to the plan; update ledger AZ-006 |
| 3 | The pipeline pushes images, which needs `AcrPush`; `70-assess-api.sh` assigns only `AcrPull` | add `AcrPush` to the script and the plan |
| 4 | `70-assess-api.sh` never runs `az containerapp registry set` | add it (with the user-assigned identity) |
| 5 | `infra/azure/assess-api.containerapp.yaml` has placeholders `<ACR>`/`<GIT_SHA>`, hard-codes `FOUNDRY_DEPLOYMENT: gpt-4o`, lacks `APP_BASE_URL`, `API_INTERNAL_URL`, `BLOB_CONTAINER` which `probe config` requires; `80-assess-api-config.sh` applies it without substituting the image | make `80-assess-api-config.sh` substitute the current image into a temporary copy and add the three variables to the YAML (keep secrets as `secretRef` names); add a unit test |
| 6 | `30-blob.sh` uses `--auth-mode login` and never prints the connection string the app needs | use the connection-string method (see the office guide OC-1C) |
| 7 | `50-email.sh` uses `az communication link-notification-hub` (wrong command for an email domain) and a non-`global` location for the email service | use `global`; print an instruction to link the domain in the portal |
| 8 | `10-core.sh` budget command is unverified | mark `(confirm)` in the script and the ledger; keep the portal as the documented path |
| 9 | `inventory.sh` header says `source ...` but `DRY_RUN` defaults to 1 (it only prints) | document `DRY_RUN=0 bash infra/azure/discovery/inventory.sh` |
| 10 | Older guide says `containerapp-api.yaml`; the real file is `assess-api.containerapp.yaml`, and the guide counts 8 secrets while the YAML references 9 | align the older guide |

Every script change must keep `tests/phase1` green and add a test for the new behaviour (for example: the script text contains `AcrPush`, the second federated subject, `registry set`; no real names).

## Stage I: Final report (branch `test/verification-report-phases-0-6`)
Write `docs/phase-reports/verification-phases-0-6.md` with: environment (OS, Python version, ruff/mypy/pytest versions, commit SHA); the Stage A baseline table; the Stage B conformance matrix per phase; Stage C walkthrough log (status codes); Stage D scan results with each hit explained; Stage E probe results; defects found (id, severity, reproduction, fix commit, regression test) or "none"; items `UNVERIFIED (CI)` and `UNVERIFIED (Azure)` with ledger ids; deviations from the specification; and a **go / no-go** recommendation for the office day. Update `docs/PROGRESS.md` ("Last updated", a "Verification" row) and `docs/UNVERIFIED_AZURE_LEDGER.md` (new or changed entries). **Never** edit the SIGN-OFF line.

# STOP CONDITIONS (stop and ask me; do not guess)
* Any step needs an Azure credential, a real name, a secret, Docker, or SQL Server.
* A fix would change a public API contract (route, status code, field name) from Prompt A/B.
* Two specification documents conflict and the order of authority does not settle it.
* A test fails for a reason you cannot explain after two focused attempts.
* You are about to touch `frontend/`, `backend/`, `database/`, `ai_service/`, `main`, or the SIGN-OFF line.

# STYLE OF YOUR ANSWERS
Plain, short, factual. After each stage: what you ran, the exact result lines, what is wrong (if anything), what you will do next. No long recaps of the steps. Final answer: the branch names and commit SHAs you created, the report path, the counts, the open findings, and the exact `git push` / PR commands for me to run.

=== END PROMPT ===

---

## Notes for you (not part of the prompt)

* The agent will not push. Run the push commands it gives you, open the PRs in this order: `docs/local-run-and-office-guides`, `fix/infra-and-docs-match-workflows`, `test/verification-report-phases-0-6`, then any `fix/...` branches. Merge only when the `fast`, `container` and `security` checks are green.
* The "known findings" table (Stage H) comes from the office guide's Appendix A. If the agent disagrees with one, it must show the file and line.
* If the model starts using `docker`, `az`, or asks for a password, stop it and paste rule 1 to 3 again.