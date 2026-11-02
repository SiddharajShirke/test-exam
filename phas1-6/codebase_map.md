# Codebase Map: AI Candidate Assessment Platform Backend (Phases 0 to 6)

**Repo path when saved:** `docs/CODEBASE_MAP.md`
**Purpose:** one page every team member can read to understand what each folder and file does. Paste a block into the group chat or take a screenshot of it.
**Correction:** an earlier version of this map in chat labelled Phases 3 to 5 wrongly. The labels below follow `docs/PROGRESS.md` and `docs/phase-reports/`.

## Phase labels (the real ones)

| Phase | What it added | Status |
|---|---|---|
| 0 | Foundation: settings, logging, error envelope, health, provider ports, fakes | Done |
| 1 | Azure discovery and provisioning scripts (dry-run, sign-off gated), probe tool | Done locally; office run waits for human sign-off |
| 2 | Database layer: schema, migrations, tenant-scoped repositories | Done; SQL Server path proven only in GitHub Actions |
| 3 | Python rebuild integration: Dockerfile, CI/CD workflows, E2E harness, Postman | Done locally; image/CI unverified until the first green run |
| 4 | Login, sessions, tenants, users (endpoints 1 to 7) | Done locally |
| 5 | Assessments and job-description upload (endpoints 8 to 14) | Done locally |
| 6 | Job engine, AI question generation, review, approval (endpoints 15 to 22) | Done locally; real GPT-4o unverified |
| 7 to 13 | Invitations/email, candidate exam, scoring, results/export, hardening, full CI/CD, release | Pending |

---

## Block 1: root, CI/CD, infrastructure scripts

```
test-exam/                                 repository root
├── README.md                              Overview + quick start
├── AGENTS.md                              Rules every AI agent/IDE must obey (no secrets, sign-off gate, backend only)
├── pytest.ini                             Test config: paths (api, tests) + markers sql / e2e / container / azurite
├── ruff.toml                              Lint + format rules
├── .editorconfig  .gitignore              Editor + git hygiene
├── docker-compose.yml                     Old local SQL Server dev file (optional; Docker is not used on our laptops)
├── AI_Assessment_MVP_Design_and_API_Contract.pdf    Confidential specification (source of truth)
│
├── .github/workflows/                     CI/CD. Docker runs ONLY here
│   ├── deploy.yml                         fast (lint, types, tests) → container (SQL Server 2022, Azurite, image build, container E2E)
│   │                                      → security (Trivy) → deploy (OIDC login, push, update app, smoke test, auto rollback)
│   │                                      deploy runs only on main AND when variable AZURE_DEPLOY_ENABLED = true
│   ├── live-e2e.yml                       Manual: E2E harness against a deployed URL (inputs: base_url, upto_phase, with_ai, with_email)
│   ├── nightly.yml                        Scheduled 02:00 UTC regression
│   ├── rollback.yml                       Manual: redeploy an older image tag
│   └── load-test.yml                      Manual: small load test (no stress profile)
│
├── infra/azure/                           Azure provisioning. DRY_RUN=1 by default; writes need the human SIGN-OFF line
│   ├── _run.sh                            Shared helper: dry-run, sign-off gate, run / run_read
│   ├── 10-core.sh                         Log Analytics, Application Insights, budget (reuse or create)
│   ├── 20-sql.sh                          Verify existing SQL; prints the T-SQL step (cannot run T-SQL itself)
│   ├── 30-blob.sh                         Storage account + private container jd-files
│   ├── 40-ai.sh                           Verify existing GPT-4o deployment (reuse only)
│   ├── 50-email.sh                        Communication Services + managed email domain
│   ├── 60-registry.sh                     Container Registry (reuse or create)
│   ├── 70-assess-api.sh                   Create the assess-api Container App + identity + GitHub trust
│   ├── 80-assess-api-config.sh            Apply probes/size/scale from the YAML
│   ├── assess-api.containerapp.yaml       Desired runtime shape: 0.25 vCPU / 0.5 GiB, 1 replica, probes, secret references
│   └── discovery/
│       ├── inventory.sh                   READ-ONLY Azure inventory (OC-0)
│       └── sql-inventory.sql              READ-ONLY SQL inventory (schemas, table names, no data)
│
└── scripts/
    ├── run-plan.sh                        Prints every provisioning command as DRY-RUN (the plan output)
    ├── ci/install_odbc.sh                 Installs ODBC Driver 18 on the runner
    ├── ci/prepare_sql.py                  Creates the test database/user on the CI SQL Server
    ├── db/create-app-user.sql             Schema `assess` + least-privilege user `assess_app` (run by a human in Query editor)
    ├── e2e/run.py                         E2E harness: runs checks/pNN_*.py against any base URL
    ├── e2e/smoke.sh                       Post-deploy smoke: /health must be ok AND x-app-version = commit SHA
    ├── e2e/checks/p00 .. p06_*.py         One live-check module per phase
    └── azure-smoke/                       Placeholder folder (empty .gitkeep)
```

## Block 2: the application, `api/`

```
api/
├── Dockerfile                             Multi-stage python:3.12-slim + ODBC 18, non-root, port 8080, graceful shutdown 8 s
├── requirements.txt  requirements-dev.txt Runtime / dev dependencies (ruff pinned >=0.16,<0.18)
├── pyproject.toml                         Package + tool config
├── .env.example                           Reference list of variable names (NOT read by the app)
└── app/
    ├── main.py                            FastAPI app factory; lifespan runs migrations and starts/stops the job engine; mounts routers under /api/v1
    ├── config.py                          Settings (environment variables) + production guard rails
    ├── deps.py                            Dependency injection: Repos, Clock, Config, Providers, Auth, Staff/Admin guards
    ├── middleware.py                      Request id, security headers, body-size limits, access log
    ├── telemetry.py                       Application Insights hook
    │
    ├── core/                              Tiny shared pieces
    │   ├── clock.py                       SystemClock and FakeClock (tests)
    │   ├── errors.py                      AppError → {"error":{"code","message","details?"}}
    │   ├── ids.py                         UUID helpers, constant-time compare
    │   └── logging.py                     JSON logger with secret redaction
    │
    ├── db/                                Database layer
    │   ├── engine.py                      SQL Server (pyodbc) or in-memory SQLite engine, retry, serialised memory access
    │   ├── schema.py                      12 tables + schema_migrations, in schema `assess`
    │   └── coltypes.py                    Column type helpers
    │
    ├── migrations/                        Versioned T-SQL changes (idempotent, applied at start under an app-lock)
    │   ├── runner.py                      Applies pending migrations
    │   └── sql/  0001_init.sql · 0002_sessions_last_seen.sql · 0003_jobs_questions_ai.sql
    │
    ├── repositories/                      The ONLY code that talks to the database
    │   ├── __init__.py                    Factory: memory or sql
    │   ├── base.py  models.py  mappers.py Base class, row models, row ↔ model conversion
    │   ├── tenant_scoped.py               Every repository; every query is filtered by tenant (company isolation)
    │   └── system.py                      The few cross-tenant queries (job claim, requeue stuck jobs, ...)
    │
    ├── providers/                         External services behind interfaces
    │   ├── ports.py                       Interfaces: AI, Email, Files
    │   ├── ai_azure.py   ai_fake.py       Real GPT-4o (v1 route) / deterministic fake
    │   ├── files_azure.py  files_memory.py   Azure Blob (or Azurite) / in-memory
    │   └── email_azure.py  email_fake.py  Real email (Phase 7) / fake
    │
    ├── security/                          passwords.py (Argon2id) · cookies.py (signed sid cookie)
    ├── schemas/                           Request/response shapes (Pydantic): common, auth, assessments, questions
    │
    ├── services/                          Business logic
    │   ├── auth.py  rate_limit.py         Login, sessions, lockout, throttling
    │   ├── accounts.py                    Create tenant + admin, users, last-admin guard
    │   ├── assessments.py                 Assessment lifecycle (draft → approved → open → closed)
    │   ├── jd_files.py  text.py           JD upload: type check by magic bytes + text extraction (PDF/TXT); word counting
    │   ├── questions.py                   Question CRUD, approval rule (exact count per section)
    │   └── generation.py                  Queue generation, daily caps, JD word check
    │
    ├── routes/                            HTTP endpoints (prefix /api/v1)
    │   ├── health.py                      GET /health
    │   ├── auth.py                        POST /auth/login · POST /auth/logout · GET /auth/me                       (1-3)
    │   ├── platform.py                    POST /platform/tenants  (X-Platform-Key)                                   (4)
    │   ├── users.py                       GET/POST /users · PATCH /users/{id}                                       (5-7)
    │   ├── assessments.py                 POST/GET /assessments · GET/PATCH/DELETE /assessments/{id}
    │   │                                  · POST /assessments/{id}/jd-file · POST /assessments/{id}/close         (8-14)
    │   └── generation.py                  POST /assessments/{id}/generate · GET /jobs/{id}
    │                                      · GET/POST /assessments/{id}/questions · PATCH/DELETE /questions/{id}
    │                                      · POST /questions/{id}/regenerate · POST /assessments/{id}/approve      (15-22)
    │
    ├── ai/                                prompts.py (JD fenced as data) · validator.py (checks every AI answer)
    ├── jobs/                              engine.py (2 s tick, ≤ 3 concurrent, retries, stuck-job recovery)
    │                                      · handlers.py (generate and regenerate-question handlers, batches of 5, de-duplication)
    └── tools/                             probe.py (Azure checks, run inside the container) · seed_tenant.py (first tenant + admin)
```

## Block 3: tests (organised by phase; "write once, run twice" on memory and SQL)

```
tests/
├── conftest.py  helpers_pdf.py            Shared fixtures: settings, app, live server, repos (memory + sql), PDF builder
├── phase0/   test_p0_app · config · core · providers · static        Foundation rules and repo hygiene
├── phase1/   test_p1_infra_guards · probe                           Scripts are dry-run + sign-off gated; probe masks secrets
├── phase2/   test_p2_repo_contract · migrations · boundaries · engine   Repositories, migration parity, tenant boundaries
├── phase3/   unit/ (container, scripts, workflows, runtime, postman) · integration/ (stack) · e2e/ (container, live)
│             postman/  spec.py + generate.py + run_collection.py + 3 collection JSON + environment
├── phase4/   unit/ (security, sessions, static+seed) · integration/ (auth, accounts) · e2e/ (live)
├── phase5/   unit/ (rules) · integration/ (assessments, azurite) · e2e/ (live)
└── phase6/   unit/ (ai, engine, packaging, postman) · integration/ (generation, loop, questions) · e2e/ (live, container)
              postman/  spec46.py + generate46.py + run46.py + 3 collection JSON + environment

Totals (laptop tier): 719 passed, 2 skipped, 288 deselected (those need SQL Server / Docker / Azurite and run in GitHub Actions)
```

## Block 4: documentation

```
docs/
├── PROGRESS.md                            Phase status board, last session notes
├── decisions.md                           Why each choice was made
├── PROVISIONING_PLAN.md                   The plan a human signs (SIGN-OFF line is written ONLY by a human)
├── ARCHITECTURAL_EVALUATION_AND_PROVISIONING_PLAN.md   Architecture + cost evaluation
├── OFFICE_CONNECTION_AND_TESTING_GUIDE.md Full 13-phase office manual (OC-0 .. OC-13)
├── OFFICE_AZURE_CONNECTION_GUIDE_PHASES_1_6.md   Focused office manual for phases 1-6 (matches the workflows exactly)
├── LOCAL_RUN_AND_TEST_GUIDE.md            How to run the server and test every phase on a laptop
├── CODEBASE_MAP.md                        This file
├── UNVERIFIED_AZURE_LEDGER.md             Everything not yet proven on real SQL Server/Azure (AZ-001 .. AZ-030)
├── data-model.md  runbook.md              Tables / operations notes
├── phase-reports/                         One report per phase (00 to 06) + verification report
└── prompts/                               PROMPT_A_MASTER · PROMPT_B_ADDENDUM · PROMPT_C_STACK_OVERRIDE_PYTHON
```

## Not part of this backend (left untouched)

```
frontend/     React/Next.js, separate team
backend/      empty placeholder (our backend lives in api/)
database/     empty placeholder (schema lives in api/app/migrations + scripts/db)
ai_service/   old reference code; useful parts are re-implemented in api/app/ai and api/app/jobs; marking logic is ported in Phase 9
              (it contains a real hostname: never copy it into this public repo)
```

## How one request flows (for newcomers)

```
HTTP request
  → middleware.py        request id, security headers, body-size limit
  → routes/*.py          validate input with schemas/*.py, require login via deps.py
  → services/*.py        business rules (who may do what, limits, state changes)
  → repositories/*.py    SQL, always filtered by the caller's tenant
  → providers/*.py       only when needed: AI, files, email (fake locally, Azure in production)
  → response or {"error": {"code", "message"}}
Background work: services queue a row in `jobs`; jobs/engine.py claims it every 2 s and jobs/handlers.py runs it.
```