# Phase 0 Reconcile — Phase Report

**Branch:** `phase/00-reconcile`  
**Date:** 2026-11-01  
**Status:** HOME-DONE  
**Overrides applied:** B3 rows 3, 4, C6, C7; B4.1; B5.1; B6.5; B7 items 1–7, 9

---

## Summary

Audited the existing `phase/00-foundation` against the B7 Phase 0 reconcile checklist. All 9 items were acted on. 13 new tests added; 53 original tests still pass; total **66 tests passing**.

---

## Checklist findings

| # | Item | Found | Action |
|---|---|---|---|
| 1 | No Docker in developer workflow | `db:up`, `db:down`, `db:reset` scripts in `package.json` reference `docker compose` | **Removed** all three scripts. DB is only used in GitHub Actions CI service containers. |
| 2 | Ports-and-adapters / REPO_BACKEND / FILES_MODE=memory / production refusal | Missing entirely — only `FakeAiProvider`, `FakeEmailProvider`, `AzureBlobFilesProvider` existed | **Added**: `RepoSet` interfaces in `src/repositories/types.ts`, `MemoryRepos` in `src/repositories/memory/index.ts`, `SqlRepos` stub in `src/repositories/sql/index.ts`, `createRepos(config)` factory in `src/repositories/index.ts`, `MemoryFilesProvider` in `src/providers/files/memory.ts`. Config adds `REPO_BACKEND=memory\|sql` and `FILES_MODE=memory\|azurite\|azure`. Production refuses to start if `REPO_BACKEND!=sql` or `FILES_MODE!=azure`. |
| 3 | `argon2` → `@node-rs/argon2` (prebuilt) | `argon2@0.41.1` present (native compile) | **Replaced** with `@node-rs/argon2@1.8.0`. |
| 4 | `cross-env`, `.gitattributes` | Both missing | **Added** `cross-env@7.0.3` to dependencies; created `.gitattributes` enforcing `* text=auto eol=lf`. |
| 5 | `.env.azure.example`, new config vars | `.env.example` existed; `.env.azure.example` missing; `FOUNDRY_API_STYLE`, `AI_MAX_OUTPUT_TOKENS`, `AI_DAILY_TOKEN_CAP`, `APPINSIGHTS_SAMPLING_PERCENT`, `DB_SCHEMA` missing | **Added** `api/.env.azure.example` with all placeholder vars annotated with OC-n checkpoint. Added all new vars to `src/config/index.ts`. |
| 6 | `deploy.yml` with `fast` job | Only a `.gitkeep` in `.github/workflows/` | **Created** `.github/workflows/deploy.yml` with jobs: `fast` (T1), `sql` (T2, disabled until Phase 2), `image` (T2, disabled until Phase 3), `security`, `deploy` (guarded by `vars.AZURE_DEPLOY_ENABLED=='true'`). |
| 7 | `docs/local-dev.md` | Missing | **Created** with no-Docker workflow, T1 test commands, tier table. |
| 8 | Secret scan | Ran `git log` and grep over all files for common secret patterns. No real keys, tokens, or connection strings found in history. Fake Azurite dev account key is the well-known public key (`Eby8vdM02x...`). | **Clean.** |
| 9 | Read `ai_service/` for endpoint style | Read `ai_service/question_generator.py` and `ai_service/answer_evaluator.py` (reference only). Confirmed v1 route: `<FOUNDRY_ENDPOINT>/openai/v1/chat/completions` with `model=<deployment>`, no `api-version`. | Recorded as **AZ-001** (UNVERIFIED) in ledger. `FOUNDRY_API_STYLE=v1` is the default. |

---

## New test scripts added

| Script | Tier | Description |
|---|---|---|
| `test:repo:memory` | T1 | Repository contract suite against in-memory backend |
| `test:api:memory` | T1 | Full API test suite against in-memory backend (no DB) |
| `test:repo:sql` | T2 | Repository contract suite against SQL Server |
| `test:api:sql` | T2 | Full API test suite against SQL Server |
| `test:sql-only` | T2 | SQL-specific tests (migrations, race conditions) |

---

## Test summary

```
Test Files  9 passed (9)
Tests       66 passed (66)   (53 original + 13 new)
```

New tests:
- `test/unit/config.test.ts`: +4 (REPO_BACKEND production refusal, FILES_MODE production refusal, FOUNDRY_API_STYLE default)
- `test/repo-contract/repos.contract.test.ts`: +9 (tenant isolation, R1 email uniqueness, tenantId UUID validation, jobs claimNext atomicity, responses.upsert deadline rule)

---

## Files changed

| File | Change |
|---|---|
| `api/package.json` | Replace argon2→@node-rs/argon2; add cross-env; new test scripts; remove docker db:* scripts |
| `api/src/config/index.ts` | Add REPO_BACKEND, FILES_MODE memory, FOUNDRY_API_STYLE, AI_MAX_OUTPUT_TOKENS, AI_DAILY_TOKEN_CAP, APPINSIGHTS_SAMPLING_PERCENT, DB_SCHEMA, RETENTION_MODE; production refusal rules |
| `api/src/providers/index.ts` | Add FILES_MODE=memory branch → MemoryFilesProvider |
| `api/src/providers/files/memory.ts` | New: in-process Map-based FilesProvider |
| `api/src/repositories/types.ts` | New: all RepoSet interfaces |
| `api/src/repositories/index.ts` | New: createRepos(config) factory |
| `api/src/repositories/memory/index.ts` | New: full in-memory RepoSet implementation |
| `api/src/repositories/sql/index.ts` | New: stub that throws until Phase 2 |
| `api/test/setup.ts` | Default REPO_BACKEND=memory, FILES_MODE=memory for T1 |
| `api/test/unit/config.test.ts` | +4 tests for new config rules |
| `api/test/repo-contract/repos.contract.test.ts` | New: 9-test contract suite |
| `.gitattributes` | New: LF enforcement |
| `.github/workflows/deploy.yml` | New: fast + sql + image + security + deploy jobs |
| `api/.env.azure.example` | New: placeholder Azure env template |
| `docs/local-dev.md` | New: no-Docker local dev guide |
| `docs/UNVERIFIED_AZURE_LEDGER.md` | New: 22 UNVERIFIED rows |

---

## Phase gate: PASS

T1 checks:
- ✅ 66 tests passing
- ✅ Lint clean (eslint)
- ✅ Config typecheck clean
- ✅ No Docker required for any test
- ✅ `.gitattributes` enforces LF
- ✅ `deploy.yml` fast job authored
- ✅ No secrets in repository
