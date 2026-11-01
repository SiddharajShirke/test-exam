# Project Progress & Phase Tracking

**Project:** AI Candidate Assessment Platform (MVP Backend)  
**Specification:** `docs/prompts/PROMPT_A_MASTER.md` + `docs/prompts/PROMPT_B_ADDENDUM_OFFLINE_AZURE_READY.md`  
**Guide:** `docs/OFFICE_CONNECTION_AND_TESTING_GUIDE.md`  
**Current State:** Phase 2 Complete (Commit 697a45d on phase/02-database); Ready for Phase 3.  
**Last Updated:** 2026-11-02  

---

## Phase Status Summary

| Phase | Description | Status | Evidence / Notes |
|---|---|---|---|
| **Phase 0** | **Foundation** | **COMPLETED & VERIFIED** | [`docs/phase-reports/00-foundation.md`](phase-reports/00-foundation.md) — 53 tests passing (unit & contract), ESLint clean, typecheck clean, fakes implemented. |
| **Phase 1** | **Azure Provisioning & Guide** | **STAGE 1 COMPLETED** | [`docs/phase-reports/01-azure-provisioning.md`](phase-reports/01-azure-provisioning.md) & [`docs/phase-reports/01-test-report.md`](phase-reports/01-test-report.md) — 75 tests passing, discovery scripts (read-only), provisioning scripts with sign-off gate, probe tool, `UNVERIFIED_AZURE_LEDGER.md`, GitHub Actions workflows, dry-run verified. Office execution pending sign-off. |
| **Phase 2** | **Database & API Skeleton** | **COMPLETED & VERIFIED** | [`docs/phase-reports/02-database.md`](phase-reports/02-database.md) — 100 tests passing across 13 test files, schema `assess` (13 tables), dual repository pattern (memory & SQL), migration runner with `sp_getapplock`, `docs/data-model.md` ER diagram, static schema isolation tests. |
| **Phase 3** | **Container & First Pipeline** | Pending | Dockerfile, GitHub Actions deploy workflow. |
| **Phase 4** | **Auth, Tenants, Users** | Pending | Endpoints 1 to 7. |
| **Phase 5** | **Assessments & JD (Blob)** | Pending | Endpoints 8 to 14. |
| **Phase 6** | **Job Loop & AI Generation** | Pending | Endpoints 15 to 22. |
| **Phase 7** | **Participants & Invitations (ACS)**| Pending | Endpoints 23 to 27. |
| **Phase 8** | **Candidate Exam & Timer** | Pending | Endpoints 33 to 37. |
| **Phase 9** | **Scoring & AI Marking** | Pending | Internal grading engine. |
| **Phase 10** | **Results, Override, Export, Audit**| Pending | Endpoints 28 to 31. |
| **Phase 11** | **Hardening & Resilience** | Pending | Limits, security, observability. |
| **Phase 12** | **Complete CI/CD & Testing Gates** | Pending | Full PR/main workflow. |
| **Phase 13** | **Release & Handover** | Pending | Acceptance & execution guide. |

---

## Latest Session Activity

- **Phase 2 Complete (Database & API Skeleton):**
  - Designed and verified schema `0001_init.sql` containing all 13 tables strictly within dedicated schema `[assess]`.
  - Implemented composite foreign keys, filtered unique index on `participants(token_hash)`, and JSON check constraints.
  - Implemented migration runner `api/src/migrations/runner.ts` under session-scoped `sp_getapplock` (`assess-migrations`).
  - Implemented database connection pool `api/src/db/pool.ts` with exponential backoff on transient errors and `withTransaction`.
  - Implemented full repository abstraction layer (`api/src/repositories/types.ts`) with dual implementations (`MemoryRepositories` and `SqlRepositories`).
  - Isolated cross-tenant queries into `api/src/repositories/system/index.ts` (`claimNextJob`, `findExpiredAttempts`, `findSessionByTokenHash`, `findParticipantByTokenHash`, `findAttemptByTokenHash`) with documented rationale.
  - Enforced tenant boundary assertions via `assertTenant(tenantId)` across all tenant-owned entities.
  - Completed API middleware stack: `requestIdMiddleware`, structured `accessLogMiddleware` with tenantId tracking, `helmet`, body parsers, and sanitized error boundary.
  - Authored ER diagram and data architecture specifications in `docs/data-model.md`.
  - Added items AZ-011, AZ-012, AZ-013 to `docs/UNVERIFIED_AZURE_LEDGER.md` and verified office guide alignment for checkpoint OC-2.
  - Authored Phase 2 report `docs/phase-reports/02-database.md`.
  - Verified 100/100 tests passing (`npm test`), ESLint clean (`npm run lint`), TypeScript build clean (`npm run build`).

