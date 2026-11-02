# Run and Test the Backend Locally (Phases 0 to 6)

**Repo path when saved:** `docs/LOCAL_RUN_AND_TEST_GUIDE.md`
**Who this is for:** any team member on a normal laptop. **No Docker, no Azure, no SQL Server, no internet beyond `pip install`.**
**Checked on:** Python 3.12, Linux. Every command marked ✅ was run on a clean copy of the repository and gave the stated result. Windows differences are called out.

---

## 1. What you are running

A FastAPI backend (`api/app`) for a multi-tenant AI candidate assessment platform. Locally it runs **fully in memory with fake AI, fake email and in-memory file storage**, so you can exercise everything from Phase 0 to Phase 6 without any cloud service.

| Phase | What it gives you | Endpoints |
|---|---|---|
| 0 | Config, logging, error envelope, health, security headers | `GET /api/v1/health` |
| 1 | Azure provisioning scripts (dry-run only here) and the `probe` tool | none (scripts) |
| 2 | Database layer, migrations, tenant-scoped repositories | none (internal) |
| 3 | Container image, CI/CD workflows, E2E harness, Postman | none (pipeline) |
| 4 | Login, sessions, tenants, users | 1 to 7 |
| 5 | Assessments, job description upload (PDF/TXT) | 8 to 14 |
| 6 | Background job engine, AI question generation, review, approval | 15 to 22 |

**What cannot be tested on a laptop** (it runs in GitHub Actions or at the office, see section 11): real SQL Server / Azure SQL, Azurite or Azure Blob, the Docker image, Trivy, real GPT-4o, real email.

---

## 2. Prerequisites

| Need | Version | Check |
|---|---|---|
| Python | **3.12** (3.13 is not what CI uses; install 3.12) | `python3.12 --version` |
| Git | any | `git --version` |
| curl | any (Windows: use `curl.exe`) | `curl --version` |
| Postman (optional) | any | only for the GUI route in section 8 |

You do **not** need the ODBC driver unless you point the app at SQL Server (`REPO_BACKEND=sql`), which this guide does not do.

---

## 3. One-time setup

**Linux / macOS / Git Bash / WSL**
```bash
git clone https://github.com/SiddharajShirke/test-exam.git
cd test-exam
git checkout phase/06-ai-generation        # or main, once phases 3 to 6 are merged
python3.12 -m venv .venv
. .venv/bin/activate
pip install -r api/requirements-dev.txt
```

**Windows PowerShell**
```powershell
git clone https://github.com/SiddharajShirke/test-exam.git
cd test-exam
git checkout phase/06-ai-generation
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r api/requirements-dev.txt
```
(If PowerShell blocks the activation script: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.)

✅ Expected: `pip` finishes without errors; `python -c "import fastapi, uvicorn, argon2, pypdf, httpx; print('deps ok')"` prints `deps ok`.

---

## 4. Configuration (read this once)

**The application does NOT read `.env` files.** `api/.env.example` is only a reference list of variable names. Settings come from **environment variables of the shell that starts the server**. Defaults already run everything in memory, so for normal local work you set **nothing**.

| Variable | Local default | Meaning |
|---|---|---|
| `REPO_BACKEND` | `memory` | `memory` = in-memory SQLite, wiped on every restart. `sql` needs `DATABASE_URL`. |
| `AI_MODE` | `fake` | Deterministic fake model. `azure` needs `FOUNDRY_*`. |
| `EMAIL_MODE` | `fake` | Prints/stores instead of sending. |
| `FILES_MODE` | `memory` | In-memory blob store for JD uploads. |
| `PORT` | `8080` | Listen port. |
| `SESSION_SECRET`, `PLATFORM_KEY` | `dev-only-...` placeholders | Fine locally. `APP_ENV=production` refuses them. |
| `COOKIE_SECURE` | `true` | **See the two modes below.** |
| `JOB_LOOP_ENABLED` | `true` | Background job loop (needed for AI generation). |
| `APP_ENV` | `development` | `production` refuses fakes, memory, placeholder secrets. |

Default platform key for local calls: `dev-only-platform-key-change-me-00000`.

### Two ways to start the server (important)

The session cookie `sid` is marked `Secure`. Browsers and curl may not send a `Secure` cookie back over plain `http://`, so there are two modes:

| Mode | Start with | Use it for |
|---|---|---|
| **A: Automated (default)** | no extra variable | The E2E harness and both Postman runners. They send the cookie explicitly. ✅ 28/28 harness checks pass only in this mode. |
| **B: Manual** | `COOKIE_SECURE=false` | Typing `curl` commands with a cookie jar, Postman GUI, a browser. ✅ verified. With this mode two harness checks (cookie must be `Secure`, "unauthenticated is 401") fail by design, so do not run the harness against it. |

Run mode A and mode B on **different ports** if you want both at once (for example 8080 and 8081).

---

## 5. Start the server

**Mode A (automated tests):**
```bash
cd api
python -m app.main
```
**Mode B (manual testing):**
```bash
cd api
COOKIE_SECURE=false python -m app.main               # Linux / macOS / Git Bash
```
```powershell
cd api
$env:COOKIE_SECURE="false"; python -m app.main        # PowerShell
```
Another port: `PORT=8081 python -m app.main` (PowerShell: `$env:PORT="8081"`).

✅ **Expected log lines** (JSON): `migrations applied`, `job_loop_started`, and `Uvicorn running on http://0.0.0.0:8080`.

**Alternative start** (same result): `cd api && uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8080`.

**Check it is alive** (second terminal):
```bash
curl -i http://localhost:8080/api/v1/health
```
✅ Expected: `HTTP/1.1 200 OK`, body `{"status":"ok"}`, headers `x-request-id`, `x-app-version: local`, `x-content-type-options: nosniff`, `x-frame-options: DENY`, `cache-control: no-store`.

**Interactive API docs** (development only): <http://localhost:8080/api/v1/docs>. (`/docs` without the prefix is a 404 by design. In production the docs are off.)

**Stop** with `Ctrl+C`. The log shows `job_loop_stopped` and `shutdown complete`.
**Reset all data:** stop and start again (memory mode).

---

## 6. Guided manual walkthrough (Phases 4 to 6, about 5 minutes)

Start the server in **mode B** (section 5), then in another terminal (Linux / macOS / Git Bash / WSL):

```bash
B=http://localhost:8080/api/v1
KEY=dev-only-platform-key-change-me-00000
```

**1. Create a company (tenant) and its admin** (endpoint 4)
```bash
curl -s -X POST $B/platform/tenants -H "X-Platform-Key: $KEY" -H 'content-type: application/json' \
  -d '{"name":"Acme","adminName":"Ada","adminEmail":"ada@example.com","password":"correct-horse-9"}'
```
✅ `201` with `{"tenantId":"...","adminUserId":"..."}`. A wrong key gives `401`.

**2. Log in and keep the cookie** (endpoint 1)
```bash
curl -s -c jar.txt -X POST $B/auth/login -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse-9"}'
curl -s -b jar.txt $B/auth/me
```
✅ `/auth/me` returns `{"user":{"id":...,"name":"Ada","role":"admin"},"tenant":{...,"name":"Acme"}}`.

**3. Create an assessment** (Phase 5). Save this as `a.json`. The job description must have at least **100 words** or generation answers `422 JD_TOO_SHORT`:
```json
{
  "title": "Backend Engineer",
  "jobDescription": "Senior Backend Engineer. We are hiring an engineer to design, build and operate Python web services on Azure. You will own REST APIs written with FastAPI, model relational data in SQL Server, write background jobs, add automated tests, review code, and improve reliability, security and observability of production systems. Strong communication, mentoring and a habit of measuring results are important. Experience with containers, continuous delivery pipelines, structured logging and incident response is a clear advantage for this role and for the team that you will join as an experienced individual contributor. The team values clear written design documents, small reviewed changes, honest estimates, calm on-call rotations, careful handling of customer data, and steady improvement of tooling that other engineers use.",
  "durationMinutes": 30,
  "passingScore": 50,
  "sections": [
    {"type": "mcq", "domain": "Python", "difficulty": "medium", "count": 3},
    {"type": "descriptive", "domain": "System design", "difficulty": "medium", "count": 1}
  ]
}
```
```bash
AID=$(curl -s -b jar.txt -X POST $B/assessments -H 'content-type: application/json' -d @a.json \
  | python -c "import sys,json;print(json.load(sys.stdin)['id'])"); echo $AID
```
✅ A UUID is printed (`201`).

**4. Generate questions with the (fake) AI** (Phase 6)
```bash
JID=$(curl -s -b jar.txt -X POST $B/assessments/$AID/generate -H 'content-type: application/json' -d '{}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['jobId'])")
sleep 5
curl -s -b jar.txt $B/jobs/$JID
```
✅ `status":"done"`, `"result":{"questionsCreated":4,...}`, `tokensUsed` above 0. (`queued` or `running` for the first 2 to 4 seconds is normal. The loop ticks every 2 s.)

**5. Read the questions and approve**
```bash
curl -s -b jar.txt $B/assessments/$AID/questions | python -m json.tool | head -40
curl -s -b jar.txt -X POST $B/assessments/$AID/approve
```
✅ Three `mcq` questions (4 options, `correctAnswer` A to D) and one `descriptive` (with `rubric`, `maxScore`). `position` counts per section (0,1,2 then 0). Approve returns `{"id":...,"status":"approved","questionCount":4}`. Editing a question afterwards returns `409`.

**Windows PowerShell:** use `curl.exe` (not `curl`, which is an alias) and write JSON to a file with `-d "@a.json"`; or use Postman (section 8), which is easier on Windows.

---

## 7. Test every phase

General rules:
- Always activate the virtual environment first, and run from the **repository root** (where `pytest.ini` is).
- `pytest -m "not sql and not container and not azurite"` is the "laptop tier": ~76 seconds for everything.
- Tests marked `sql`, `container`, `azurite` are skipped here and run in GitHub Actions.
- ✅ Whole suite: **719 passed, 2 skipped, 288 deselected**.

### 7.0 Quality gates (run before and after any change)
```bash
ruff check api scripts tests            # ✅ All checks passed!
ruff format --check api scripts tests   # ✅ 117 files already formatted
(cd api && mypy app)                    # ✅ Success: no issues found in 64 source files
```

### 7.1 Phase 0: foundation
```bash
pytest tests/phase0 -m "not sql and not container and not azurite"      # ✅ 86 passed, 1 skipped
```
Manual checks (server running):
| Check | Command | ✅ Expected |
|---|---|---|
| Health | `curl -i $B/health` | 200 `{"status":"ok"}` + security headers |
| Unknown route uses the error envelope | `curl -i $B/nope` | 404 `{"error":{"code":"NOT_FOUND","message":"Route not found"}}` |
| Request id echo | `curl -i -H 'x-request-id: abc-1' $B/health` | same id in the response header |
| Production refuses fakes | `cd api && APP_ENV=production python -m app.main` | exits with `ConfigError: AI_MODE must be 'azure' in production; ... REPO_BACKEND must be 'sql' ...` |

### 7.2 Phase 1: Azure scripts and probe (dry-run only)
```bash
pytest tests/phase1                                  # ✅ 56 passed
bash scripts/run-plan.sh | less                      # prints every Azure command as [DRY-RUN]; nothing is executed
cd api && python -m app.tools.probe config           # ✅ FAILS locally by design: "11 required var(s) missing"
```
The probe failing on a laptop is the **correct** result: it proves the probe really checks the environment. `bash` is needed for the plan script (Git Bash or WSL on Windows). Writing to Azure is blocked until `docs/PROVISIONING_PLAN.md` contains a human-written `SIGN-OFF: APPROVED by ...` line. Do not add that line yourself.

### 7.3 Phase 2: database layer
```bash
pytest tests/phase2 -m "not sql and not container and not azurite"      # ✅ 96 passed (52 SQL Server variants deselected)
```
Covers repository contract (every repository tested on both backends), migration files versus `db/schema.py`, tenant isolation (only 5 pinned cross-tenant queries are allowed), engine retry. The SQL Server variants run in the GitHub `container` job.

### 7.4 Phase 3: container, CI/CD, harness, Postman
```bash
pytest tests/phase3 -m "not sql and not container and not azurite"      # ✅ 105 passed, 1 skipped
```
Start the server in **mode A**, then:
```bash
python scripts/e2e/run.py --base-url http://127.0.0.1:8080 --upto 3
python tests/phase3/postman/run_collection.py --base-url http://127.0.0.1:8080
```
✅ Harness prints `PASS` per check and ends `E2E PASS: 9/9 checks passed (upto=3)`. (Cumulative counts: `--upto 4` → 18/18, `--upto 5` → 23/23, `--upto 6` → 28/28.) Postman runner: **UNIT 30/30, INTEGRATION 33/33, E2E 15/15** assertions passed.
The Docker image, `deploy.yml` jobs and Trivy cannot run on a laptop. The unit tests here only inspect the Dockerfile and workflow files for rules (no secrets, no `:latest`, least-privilege permissions, non-root user).

### 7.5 Phase 4: login, tenants, users (endpoints 1 to 7)
```bash
pytest tests/phase4 -m "not sql and not container and not azurite"      # ✅ 96 passed
python scripts/e2e/run.py --base-url http://127.0.0.1:8080 --upto 4    # mode A server
```
Manual checks (mode B server, `jar.txt` from section 6):
| Check | ✅ Expected |
|---|---|
| Wrong password | `401`, same message for unknown user and wrong password |
| 5 wrong logins in 10 min | the 6th attempt returns `429 RATE_LIMITED` ("Too many failed sign-in attempts"), even with the right password |
| Create a recruiter: `POST $B/users` `{"name":"Rec","email":"rec@example.com","role":"recruiter","password":"correct-horse-9"}` | `201` |
| Recruiter cannot create users | `403` |
| Disable or demote the last admin: `PATCH $B/users/<adminId>` `{"status":"disabled"}` | `409 CONFLICT` "Cannot disable or demote the last active admin" |
| Second tenant touches the first tenant's user (`PATCH $B/users/<id>` with the other tenant's cookie) | `404` (never `403`) |
| `POST /auth/logout` then `/auth/me` | `204`, then `401` |
| Bad UUID in a path, e.g. `GET $B/assessments/not-a-uuid` | `400 VALIDATION_ERROR`; a well-formed but unknown or foreign id gives `404` |

Sessions: idle timeout 30 min, absolute 8 h (tested with a fake clock, not by waiting).

### 7.6 Phase 5: assessments and JD upload (endpoints 8 to 14)
```bash
pytest tests/phase5 -m "not sql and not container and not azurite"      # ✅ 108 passed (53 deselected need SQL/Azurite)
python scripts/e2e/run.py --base-url http://127.0.0.1:8080 --upto 5
```
Manual checks:
```bash
# upload a text JD (a real PDF also works; limit 2 MB, 20 to 20,000 characters of extracted text)
curl -s -b jar.txt -X POST $B/assessments/$AID/jd-file -F "file=@jd.txt"
curl -s -b jar.txt $B/assessments/$AID | python -m json.tool | head -20
curl -s -b jar.txt -X POST $B/assessments/$AID/close
curl -s -b jar.txt -o /dev/null -w "%{http_code}\n" -X DELETE $B/assessments/$AID      # 204
```
✅ Expected: the upload returns `{"fileName":"jd.txt","wordCount":153,"jobDescription":"...extracted text..."}`; a body over the limit → `413 PAYLOAD_TOO_LARGE`; a PDF with no extractable text → `FILE_UNREADABLE` (needs a real scanned PDF to try); another tenant gets `404` for your assessment; delete returns `204` and removes the stored file. `POST .../close` returns `409` on a draft: only an approved or open assessment can be closed.

### 7.7 Phase 6: job engine, AI generation, review, approval (endpoints 15 to 22)
```bash
pytest tests/phase6 -m "not sql and not container and not azurite"      # ✅ 172 passed (109 deselected)
python scripts/e2e/run.py --base-url http://127.0.0.1:8080 --upto 6     # ✅ 28/28 (mode A server)
python tests/phase6/postman/run46.py --base-url http://127.0.0.1:8080   # ✅ UNIT 35/35, INTEGRATION 43/43, E2E 37/37
```
Manual checks, in order of the API's checks for `POST /assessments/{id}/generate`:
| Situation | ✅ Expected |
|---|---|
| Unknown assessment | `404` |
| Assessment already approved/closed | `409` |
| Job description under 100 words | `422 JD_TOO_SHORT` |
| `sectionIndexes` out of range | `400` |
| 21st generation of the day for a tenant | `429 DAILY_AI_LIMIT` with `Retry-After` |
| Regenerate one question: `POST $B/questions/{id}/regenerate` | `202` with a `jobId`; a few seconds later the same question id and position hold new content |
| Edit a question: `PATCH $B/questions/{id}` `{"explanation":"..."}` | `200`; `source` stays `ai` |
| Approve with a section short of its configured count (delete one question first) | `409 SECTION_INCOMPLETE`, details `sections[0] has 2 of 3 questions` |
| Approve with no questions | `409 NO_QUESTIONS` |
| Edit after approve | `409` |

The fake AI is deterministic, so results repeat. The real GPT-4o behaviour (JSON mode, retries, `AI_OUTPUT_INVALID` after 3 bad answers) is covered by unit tests with a scripted provider and is proven live only at the office (OC-6).

### 7.8 Everything in one go
```bash
ruff check api scripts tests && ruff format --check api scripts tests && (cd api && mypy app)
pytest -m "not sql and not container and not azurite"
# server in mode A running in another terminal:
python scripts/e2e/run.py --base-url http://127.0.0.1:8080 --upto 6
python tests/phase3/postman/run_collection.py --base-url http://127.0.0.1:8080
python tests/phase6/postman/run46.py --base-url http://127.0.0.1:8080
```
✅ Summary lines to look for: `719 passed, 2 skipped`, `E2E PASS: 28/28 checks passed`, and six `... assertions passed` lines. **Restart the server between full harness/Postman runs**: rate limits and lockouts are kept in memory and accumulate on a long-running server.

---

## 8. Postman (GUI)

1. Start the server in **mode B**.
2. Postman, **Import**: from `tests/phase3/postman/` the `*.postman_collection.json` files and `AssessPlatform_Local.postman_environment.json`; from `tests/phase6/postman/` the `AssessPlatform_Phase4to6_*` files.
3. Select the environment. Variables: `baseUrl` (`http://localhost:8080`), and for phases 4 to 6 `platformKey` (`dev-only-platform-key-change-me-00000`), `password`, `waitSeconds` (3).
4. Run each collection in order: **Unit, Integration, E2E** (Runner → Run collection). The collections are generated from `spec.py` / `spec46.py`, the same source the Python runners use, so the results match.
5. Regenerate the JSON after changing a spec: `python tests/phase3/postman/generate.py` and `python tests/phase6/postman/generate46.py`.

---

## 9. Optional: SQL Server variants locally

The tests marked `sql` run every API test against a real SQL Server. In this project they run **only in GitHub Actions** (SQL Server 2022 container on the runner). Local Docker is not allowed on our laptops. If you ever have a SQL Server you may use, set `TEST_DATABASE_URL` (ADO.NET style, **never commit it**), install the ODBC Driver 18 and run `pytest -m sql`. Otherwise skip.

---

## 10. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `ModuleNotFoundError: fastapi` | The virtual environment is not active, or you used another Python. Activate it; check `python --version` is 3.12. |
| `address already in use` on start | An old server still runs. Use another `PORT`, or stop the old one. A failed second start leaves the first answering: always check which one you hit. |
| `python -m app.main` → `No module named app` | Run it from inside `api/`, not the repo root. |
| Harness: `cookie missing secure` / `GET /auth/me should be 401` fails | Server was started with `COOKIE_SECURE=false`. Restart in **mode A** for the harness. |
| `curl` cookie jar login works but `/auth/me` is `401` | Server is in mode A. Restart in **mode B** for manual curl. |
| `401` on `POST /platform/tenants` | Wrong `X-Platform-Key`. |
| `409 EMAIL_EXISTS` | Tenant/user already created in this run. Use another email or restart (memory resets). |
| Generate stays `queued` | `JOB_LOOP_ENABLED` is false, or less than 2 s passed. |
| `422 JD_TOO_SHORT` | JD under 100 words. |
| `ConfigError ... in production` | You set `APP_ENV=production` locally. Remove it. |
| Probe `FAIL ... missing` | Expected locally. The probe is for the deployed container. |
| `ruff` reports new findings after an upgrade | `requirements-dev.txt` pins ruff to `>=0.16,<0.18`. Reinstall: `pip install -r api/requirements-dev.txt`. |
| Tests hang or look stuck | Run one folder at a time: `pytest tests/phase6 -x`. Report the last test name. |
| Windows: `bash` not found | Use Git Bash or WSL for `scripts/*.sh`. Python commands work in PowerShell. |

---

## 11. What is NOT proven by anything in this guide

Tracked in `docs/UNVERIFIED_AZURE_LEDGER.md` (AZ-001 to AZ-030). In short: T-SQL on real SQL Server / Azure SQL (claim query, MERGE upsert, migrations), Azure SQL from Container Apps, Azurite and Azure Blob, the Docker image and Trivy, real GPT-4o on the v1 route, real email, GitHub OIDC deploy and rollback. GitHub Actions proves the SQL Server, Azurite and image parts. The office guide (`docs/OFFICE_AZURE_CONNECTION_GUIDE_PHASES_1_6.md`) proves the Azure parts.