# Project Progress & Phase Tracking

**Project:** AI Candidate Assessment Platform (MVP Backend)  
**Specification:** `docs/prompts/PROMPT_A_MASTER.md` + `docs/prompts/PROMPT_B_ADDENDUM_OFFLINE_AZURE_READY.md`  
**Guide:** `docs/OFFICE_CONNECTION_AND_TESTING_GUIDE.md`  
**Current State:** Phase 0 (Foundation) Complete; Ready for Phase 1 / Phase 2 Offline Azure-Ready Development.  
**Last Updated:** 2026-11-01  

---

## Phase Status Summary

| Phase | Description | Status | Evidence / Notes |
|---|---|---|---|
| **Phase 0** | **Foundation** | **COMPLETED & VERIFIED** | [`docs/phase-reports/00-foundation.md`](phase-reports/00-foundation.md) — 53 tests passing (unit & contract), ESLint clean, typecheck clean, fakes implemented. |
| **Phase 1** | **Azure Provisioning & Guide** | **STAGE 1 COMPLETED** | [`docs/phase-reports/01-azure-provisioning.md`](phase-reports/01-azure-provisioning.md) — 75 tests passing, discovery scripts (read-only), provisioning scripts with sign-off gate, probe tool, `UNVERIFIED_AZURE_LEDGER.md`, GitHub Actions workflows, dry-run verified. Office execution pending sign-off. |
| **Phase 2** | **Database & API Skeleton** | Pending | Schema, migrations, repositories, tenant isolation. |
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

- **Phase 1 Stage 1 Complete (Offline Azure-Ready Tooling):**
  - Authored read-only Azure discovery script `infra/azure/discovery/inventory.sh` and T-SQL catalog query `infra/azure/discovery/sql-inventory.sql`.
  - Authored execution wrapper `infra/azure/_run.sh` with hard sign-off gate (`SIGN-OFF: APPROVED by` in `docs/PROVISIONING_PLAN.md`) and `DRY_RUN=1` default.
  - Authored 7 targeted Azure provisioning scripts `infra/azure/10-core.sh` to `70-assess-api.sh` and DDL script `scripts/db/create-app-user.sql` for `assess` schema isolation.
  - Authored connectivity probe CLI `api/src/tools/probe.ts` with round-trip SQL latency tracking, anonymous blob access block check, AI Foundry endpoint style handling, and secret masking.
  - Authored GitHub Actions workflow `.github/workflows/deploy.yml` with `fast` and `security` jobs, plus `live-e2e.yml`, `rollback.yml`, `nightly.yml`, and `load-test.yml`.
  - Created ledger `docs/UNVERIFIED_AZURE_LEDGER.md` documenting AZ-001 through AZ-010.
  - Replaced native `argon2` with `@node-rs/argon2`, added `cross-env`, removed `db:*` docker scripts from developer workflow.
  - Generated and verified complete dry-run plan output in `docs/phase-reports/01-plan-output.txt`.
  - Authored comprehensive Phase 1 report in `docs/phase-reports/01-azure-provisioning.md`.
  - All 75 tests passing (`npm test`), ESLint clean (`npm run lint`), TypeScript compile clean (`npm run build`).

