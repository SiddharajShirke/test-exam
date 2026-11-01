# Phase 2 — Database and API Skeleton Technical & Verification Report

**Project:** AI Candidate Assessment Platform (MVP Backend)  
**Phase:** 2 — Database and API Skeleton  
**Status:** **STAGE COMPLETED & VERIFIED** (Offline Azure-Ready)  
**Date:** 2026-11-02  
**Specifications:** `docs/prompts/PROMPT_A_MASTER.md` (Phase 2), `docs/prompts/PROMPT_B_ADDENDUM_OFFLINE_AZURE_READY.md` (B7 Phase 2), `docs/decisions.md`  

---

## 1. Executive Summary

Phase 2 establishes the database foundation, repository architecture, multi-tenant isolation barriers, connection pooling, migration runner, and API skeleton for the platform.

All deliverables were completed according to organizational constraints (shared Azure SQL database with the existing Assessment Portal, strictly isolated schema `assess`, no Docker on local developer environments, zero direct Azure credential access).

### Key Outcomes:
- **100% of Phase 2 Tests Passing:** 100 tests passing across 13 test suites (unit, repo-contract, schema-isolation, lint).
- **TypeScript & ESLint:** Clean compilation (`tsc --noEmit`, `tsc`) and zero ESLint warnings (`npm run lint`).
- **Complete Multi-Tenant Schema:** 13 tables defined in `[assess]` schema with composite foreign keys, filtered unique indexes, and JSON validation constraints.
- **Dedicated Isolation Enforcement:** Static architectural tests verify no direct SQL outside repositories/migrations, zero usage of `dbo`, and strict schema qualification on all objects.
- **Repository Abstraction:** Dual implementation (`SqlRepositories` and `MemoryRepositories`) satisfying the behavioral contract across memory and SQL Server.
- **Cross-Tenant Guardrails:** Cross-tenant system queries segregated in `src/repositories/system/` with documented justifications.

---

## 2. Deliverables & Implementation Details

### 2.1 Connection Pool (`src/db/pool.ts`)
- **Engine:** `mssql` connection pool initialized from `DATABASE_URL`.
- **Pool Sizing & Timeouts:** Pool max 10, min 0, idle timeout 30s, request timeout 15s.
- **Azure SQL Transient Fault Handling:** Exponential backoff retry logic (up to 3 attempts) handling transient error codes (`4060`, `40197`, `40501`, `40613`, `49918`, `49919`, `49920`, `10928`, `10929`, `10053`, `10054`, `10060`, `ETIMEOUT`, `ESOCKET`).
- **Transaction Helper:** `withTransaction(fn)` executing under `READ COMMITTED` with `SET XACT_ABORT ON` and rollback on uncaught errors.

### 2.2 Migration Runner (`src/migrations/runner.ts`)
- **Tracking Table:** `[assess].[schema_migrations] ([version] INT PRIMARY KEY, [name] NVARCHAR(255), [applied_at] DATETIME2(3))`.
- **Fail-Fast Schema Check:** Does NOT create schema (OC-1B requirement); immediately aborts if schema `assess` is absent from target database.
- **Concurrency Protection:** Wraps migration run in `sp_getapplock` (`assess-migrations`, session scope, 60s timeout) preventing replica race conditions.
- **Server Integration:** Runs automatically in `server.ts` before `listen` when `REPO_BACKEND=sql`, and CLI executable via `npm run migrate`.

### 2.3 Schema `0001_init.sql` (`src/migrations/sql/0001_init.sql`)
13 tables implemented in schema `[assess]`:
1. `tenants`: Primary tenant registry with status check (`active`, `suspended`).
2. `users`: Multi-tenant staff accounts with role check (`admin`, `recruiter`, `reviewer`) and global email uniqueness.
3. `sessions`: Authenticated sessions with composite FK `(tenant_id, user_id)`.
4. `login_attempts`: Rate-limiting and brute-force tracking by email and IP.
5. `assessments`: Assessment definitions with JSON validation on `sections_json` and duration/passing score bounds.
6. `questions`: Questions with composite FK `(tenant_id, assessment_id)`, section index, type check (`mcq`, `descriptive`, `cognitive`), and options JSON.
7. `participants`: Candidates with composite FK `(tenant_id, assessment_id)` and filtered unique index on `token_hash` (`WHERE token_hash IS NOT NULL`).
8. `attempts`: Candidate test sessions with single-attempt constraint per participant and composite FKs.
9. `responses`: Autosaved answers with composite FKs and unique constraint on `(attempt_id, question_id)`.
10. `scores`: Detailed scoring breakdown per question with source check (`auto`, `ai`, `manual`).
11. `jobs`: Background async worker queue (`generate`, `mark`, `email`) with attempts tracking and locking columns.
12. `audit_log`: Tenant-scoped audit events with actor ID, entity reference, and details JSON.
13. `schema_migrations`: Migration execution history.

### 2.4 Repositories & Cross-Tenant Boundary
- **Dual Implementation:** Both `SqlRepositories` and `MemoryRepositories` implement the unified `Repositories` contract.
- **Tenant Assertions:** `assertTenant(tenantId)` validates UUID format at the entrypoint of every tenant-owned repository method.
- **System Segregation:** Cross-tenant operations are isolated in `src/repositories/system/index.ts`:
  1. `claimNextJob(workerId)`: Cross-tenant worker queue polling.
  2. `findExpiredAttempts(now)`: Auto-submit deadline sweep past `deadline_at + 15s`.
  3. `findSessionByTokenHash(tokenHash)`: Cookie authentication resolver.
  4. `findParticipantByTokenHash(tokenHash)`: Public invitation landing resolver.
  5. `findAttemptByTokenHash(attemptTokenHash)`: Candidate exam resume resolver.

### 2.5 API Middleware & Error Boundary
- **Request ID & Traceability:** `x-request-id` attached to every request and echoed in response headers.
- **Structured Access Logging:** Access logger records method, path (query stripped), status, duration in ms, and `tenantId` when established.
- **Security & Body Parsing:** `helmet` security headers, JSON body parser with 1MB limit, URL-encoded parser, and `cookie-parser`.
- **Async Error Boundary:** `errorHandler` middleware catches uncaught exceptions, normalizes errors into standard envelope `{ error: { code, message, details? } }`, and prevents SQL query or schema leakage.

### 2.6 Data Model Documentation & Demo Seed
- **Data Model:** `docs/data-model.md` authored with Mermaid ER diagram and documentation of composite keys and constraints.
- **Demo Seed:** `scripts/db/seed-demo.mjs` initialized as placeholder.

---

## 3. Test Suite & Verification Results

### 3.1 Test Execution Summary (`npm test`)

```
 RUN  v2.1.4 C:/Users/adity/OneDrive/Desktop/WeSelect/test-exam/api

 ✓ test/unit/config.test.ts (5 tests)
 ✓ test/unit/clock.test.ts (10 tests)
 ✓ test/unit/logger.test.ts (11 tests)
 ✓ test/unit/schema-isolation.test.ts (3 tests)
 ✓ test/unit/id.test.ts (10 tests)
 ✓ test/unit/phase1.test.ts (22 tests)
 ✓ test/repo-contract/repositories.contract.ts (10 tests)
 ✓ test/unit/system-queries.test.ts (5 tests)
 ✓ test/unit/errors.test.ts (6 tests)
 ✓ test/unit/middleware.test.ts (5 tests)
 ✓ test/contract/health.test.ts (5 tests)
 ✓ test/unit/pool.test.ts (7 tests)
 ✓ test/unit/lint-pool-import.test.ts (1 test)

 Test Files  13 passed (13)
      Tests  100 passed (100)
   Duration  3.39s
```

### 3.2 Verification Breakdown

| Verification Area | Target | Status | Details |
|---|---|---|---|
| **Repository Contract** | `test/repo-contract/repositories.contract.ts` | **PASS** | 10 behavioral contract tests passing against `MemoryRepositories`. |
| **System Queries** | `test/unit/system-queries.test.ts` | **PASS** | 5 tests verifying cross-tenant exceptions and strict rejection of bad tenantId. |
| **Schema Isolation** | `test/unit/schema-isolation.test.ts` | **PASS** | Validated: zero `dbo` references, all 13 tables use `[assess]`, zero raw SQL keywords outside repositories/migrations/probe. |
| **Connection Pool** | `test/unit/pool.test.ts` | **PASS** | Verified connection string parsing, transient error detection, exponential backoff, assertTenant UUID validation. |
| **Architectural Linting** | `test/unit/lint-pool-import.test.ts` | **PASS** | Verified ESLint `no-restricted-imports` blocks importing database pool from application layers. |
| **Linter & Typecheck** | `npm run lint` & `npm run typecheck` | **PASS** | 0 errors, 0 warnings. |

---

## 4. Documentation & Guide Alignment

1. **Office Guide:** `docs/OFFICE_CONNECTION_AND_TESTING_GUIDE.md` updated:
   - Checkpoint **OC-2** verified and table names synchronized (`audit_log` exact match).
2. **Unverified Azure Ledger:** `docs/UNVERIFIED_AZURE_LEDGER.md` updated with items **AZ-011**, **AZ-012**, and **AZ-013**:
   - `AZ-011`: `sp_getapplock` concurrency lock under `assess_app`.
   - `AZ-012`: `MERGE ... WITH (HOLDLOCK)` in `responses.upsert`.
   - `AZ-013`: Filtered unique index on `participants(token_hash)` with multiple NULL values.
3. **Progress Tracker:** `docs/PROGRESS.md` updated marking Phase 2 Complete.
