# Phase 00 Report: Foundation

**Status:** GATE PASS (Pending Human Decisions a–g for Phase 1 handover)  
**Executed on:** 2026-11-01  
**Scope:** Repository layout, local stack definition, configuration module with validation, Clock & ID helpers, error model, provider interfaces & fakes, Express app factory with `/api/v1/health`, unit & contract test suite, lint rules.

---

## 1. Steps Executed

1. **Preflight Check (0.1):**
   - Node: `v24.15.0`
   - npm: `12.0.2`
   - Git: `2.50.1.windows.1`
   - GitHub CLI (`gh`): `2.97.0`
   - Azure CLI (`az`): `2.86.0`
   - Azure CLI extensions installed: `containerapp` (preview), `application-insights` (`1.2.3`).
   - Docker CLI: Docker daemon is not running locally. *[HUMAN action required for local SQL container tests if running outside test mocks]*.

2. **Decisions Documented (0.2):**
   - Created `docs/decisions.md` capturing questions (a) to (i).
   - Questions (a) to (g) presented to human for confirmation before Phase 1 provisioning.

3. **Repository Layout (0.3):**
   - Created standard project structure:
     - `api/src/` (`config`, `lib`, `middleware`, `routes`, `services`, `repositories`, `providers`, `jobs`, `export`, `migrations`, `dto`)
     - `api/test/` (`unit`, `integration`, `contract`, `fixtures`)
     - `infra/azure/`, `scripts/db/`, `scripts/azure-smoke/`, `scripts/e2e/`, `docs/phase-reports/`
     - Root `.gitignore`, `.editorconfig`, `.nvmrc`, `README.md`, `docker-compose.yml`

4. **API Package & Tooling (0.4):**
   - TypeScript 5.6.3 configuration (`tsconfig.json`) in strict mode.
   - ESLint 9 flat configuration (`eslint.config.js`) with `@typescript-eslint` and rule `no-restricted-imports` restricting SQL pool imports exclusively to repositories and migrations.
   - Vitest 2.1.4 test runner configured.
   - Pinned dependencies per specification (argon2, @azure/storage-blob, @azure/communication-email, applicationinsights, express, helmet, cookie-parser, mssql, openai, pdf-parse, pdfkit, uuid, zod, supertest).

5. **Local Stack (0.5):**
   - Created `docker-compose.yml` with SQL Server 2022 (`mcr.microsoft.com/mssql/server:2022-latest`) and Azurite blob storage (`mcr.microsoft.com/azure-storage/azurite`).
   - Created `api/.env.example` with safe local defaults and all required variables.

6. **Config Module (0.6):**
   - Created `src/config/index.ts` using Zod validation.
   - Fails fast on missing or invalid environment variables.
   - Enforces production safety invariants (production mode mandates `AI_MODE=azure`, `EMAIL_MODE=azure`, `FILES_MODE=azure`, and min 32-char keys for `SESSION_SECRET` and `PLATFORM_KEY`).

7. **Core Libraries & Middleware (0.7):**
   - `src/lib/clock.ts`: `Clock` interface with `SystemClock` and `FakeClock`.
   - `src/lib/id.ts`: `newId` (UUID v4), `hashToken` (SHA-256), `generateSecureToken` (32 bytes base64url), `timingSafeEqual`, `isUUID`.
   - `src/lib/logger.ts`: Structured JSON logger with request ID propagation and automatic secret redaction.
   - `src/lib/errors.ts`: Standard `AppError` class serializing to `{ error: { code, message, details? } }`.
   - `src/middleware/index.ts`: `validate(schema)`, `validateQuery(schema)`, `errorHandler`, `asyncHandler`.
   - `src/middleware/requestId.ts`: Request ID extraction/generation and access logger.

8. **Provider Abstraction & Fakes (0.8):**
   - Defined interfaces in `src/providers/types.ts`: `AiProvider`, `EmailProvider`, `FilesProvider`.
   - `src/providers/ai/fake.ts`: Scriptable `FakeAiProvider` supporting transient errors, malformed JSON, 429 backoff, partial generation, and simulated timeouts.
   - `src/providers/email/fake.ts`: In-memory `FakeEmailProvider` with outbox inspection.
   - `src/providers/files/azure.ts`: `AzureBlobFilesProvider` supporting Azurite and Azure Blob Storage via `@azure/storage-blob`.
   - `src/providers/index.ts`: Factory `createProviders(config)`.

9. **App Factory & Health Route (0.9):**
   - `src/app.ts`: Express application with `trust proxy: 1`, `helmet`, body parsing, request ID, router mounting, 404 handler, and error handler.
   - `src/routes/health.ts`: `GET /api/v1/health` returning `{"status":"ok"}` with `x-app-version` header populated from `GIT_SHA`.
   - `src/server.ts`: Server entrypoint with graceful shutdown handling.

10. **Test Suite Execution (0.10):**
    - Unit tests (`test/unit/`):
      - `config.test.ts`: Validates development mode vs production requirements.
      - `clock.test.ts`: Validates `FakeClock` advance and `SystemClock`.
      - `errors.test.ts`: Validates error envelope serialization and factory helpers.
      - `id.test.ts`: Validates UUID v4 regex, token generation, SHA-256 hashing, timing-safe equality.
      - `logger.test.ts`: Validates redaction of passwords, tokens, keys, authorization headers, and connection strings.
      - `middleware.test.ts`: Validates request validation and error normalization.
      - `lint-pool-import.test.ts`: Validates that ESLint prevents pool imports outside repositories.
    - Contract test (`test/contract/health.test.ts`):
      - Verifies `GET /api/v1/health` returns `{ "status": "ok" }` and `x-app-version` header.

---

## 2. Test & Verification Evidence

- `npm run lint`: **PASS** (0 errors, 0 warnings across all source and test files)
- `npm run typecheck`: **PASS** (0 TypeScript errors)
- `npm run build`: **PASS** (TypeScript compilation to `dist/` clean)
- `npm test`: **PASS** (8 test files, 53 tests passed)
- Secret scan: **PASS** (Only `.env.example` placeholders found; no actual secrets in repository)

---

## 3. Deviations & Observations

- **ESLint v9 Flat Config:** Adapted config structure to ESLint 9 (`eslint.config.js`) with CommonJS syntax and explicit Node globals.
- **Docker Daemon:** Local Docker engine is not running on the host Windows system. Supertest and unit tests run with in-memory fakes. Integration tests with Azure SQL / container will be exercised once Docker is started or against Azure SQL directly in Phase 1 / Phase 2.

---

## 4. Phase Gate Conclusion

**PHASE 00 GATE: PASS**
Waiting for human answers to decisions (a) through (g) to proceed with Phase 1 Azure provisioning.

