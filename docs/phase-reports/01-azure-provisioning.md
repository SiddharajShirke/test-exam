# Phase 1 Report: Azure Discovery, Plan, and Provisioning Tooling

**Phase:** Phase 1 (Azure Provisioning & Guide)  
**Stage:** Stage 1 (Build Tools Offline at Home) Complete  
**Date:** 2026-11-01  
**Status:** `HOME-DONE` — Ready for Office Checkpoints (OC-0 Discovery, OC-PLAN Sign-off)

---

## 1. Summary of Deliverables

| Deliverable | Location | Purpose & Constraints |
|---|---|---|
| **Discovery Scripts** | `infra/azure/discovery/inventory.sh`<br>`infra/azure/discovery/sql-inventory.sql` | Strictly read-only (`list` and `show` only). No state changes, no keys/passwords printed. T-SQL reads catalog views only. Tested by forbidden-verb unit test. |
| **Run Wrapper & Gate** | `infra/azure/_run.sh` | Shared execution wrapper sourced by all provisioning scripts. Defaults to `DRY_RUN=1`. Enforces hard sign-off gate requiring `SIGN-OFF: APPROVED by` in `docs/PROVISIONING_PLAN.md` before any write. |
| **Provisioning Scripts** | `infra/azure/10-core.sh`<br>`infra/azure/20-sql.sh`<br>`infra/azure/30-blob.sh`<br>`infra/azure/40-ai.sh`<br>`infra/azure/50-email.sh`<br>`infra/azure/60-registry.sh`<br>`infra/azure/70-assess-api.sh` | Targeted provisioning supporting `reuse|create|skip` modes. Uses placeholders only. Never modifies portal resources. Creates only `assess-api`, `jd-files` storage, ACS email domain, and budget. |
| **App User DDL** | `scripts/db/create-app-user.sql` | T-SQL script executed in Azure Portal Query Editor. Creates schema `assess` and dedicated user `assess_app` scoped to `assess` with zero `dbo` access. |
| **Provisioning Plan** | `docs/PROVISIONING_PLAN.md` | Pre-filled inventory template with placeholders (`<RG>`, `<SQL_SERVER>`), cost drivers ($25 budget ceiling), and unapproved sign-off block. |
| **Connectivity Probe** | `api/src/tools/probe.ts` | Multi-target probe (`sql`, `blob`, `foundry`, `insights`, `acs`, `config`, `all`). Validates 10-trip SQL latency (<150ms warning), anonymous blob access blocking, and foundry endpoint style. Masks all secrets. |
| **Azure Ledger** | `docs/UNVERIFIED_AZURE_LEDGER.md` | Comprehensive tracking table of all Azure-touching assumptions (AZ-001 through AZ-010) to be validated by human at the office. |
| **Workflows** | `.github/workflows/deploy.yml`<br>`live-e2e.yml`<br>`rollback.yml`<br>`nightly.yml`<br>`load-test.yml` | CI/CD pipeline containing `fast` and `security` jobs, plus dispatchable workflows for live E2E, rollback, nightly health, and k6 load testing. |
| **Plan Dry-Run Output**| `docs/phase-reports/01-plan-output.txt` | Complete execution log of all provisioning scripts under `DRY_RUN=1`. |

---

## 2. Verification at Home (Offline Test Suite)

- **Test Suite Results:**
  - 75 tests passing across 9 test suites (`test/unit/phase1.test.ts`, `config.test.ts`, `logger.test.ts`, `errors.test.ts`, `clock.test.ts`, `id.test.ts`, `middleware.test.ts`, `health.test.ts`, `lint-pool-import.test.ts`).
  - Forbidden-verb check: verified `inventory.sh` contains zero mutation verbs (`create`, `update`, `delete`, `set`, `exec`, `keys list`, etc.).
  - Sign-off gate check: verified `_run.sh` enforces the `SIGN-OFF: APPROVED by` constraint and all provisioning scripts source it.
  - Probe unit tests: verified secret masking and environment config validation.
- **Code Quality:**
  - TypeScript compilation (`npm run build`): 0 errors.
  - ESLint (`npm run lint`): 0 errors, 0 warnings.
  - No secrets detected in codebase or git commits.

---

## 3. Next Steps (Human at Office / Phase 2)

1. **Human at Office (Stage 2):**
   - Run **OC-0** (`infra/azure/discovery/inventory.sh` and `infra/azure/discovery/sql-inventory.sql`) in Azure Cloud Shell / Portal Query Editor.
   - Review discovery output against `docs/PROVISIONING_PLAN.md`.
   - Record sign-off line in `docs/PROVISIONING_PLAN.md`: `SIGN-OFF: APPROVED by <name> on <date>`.
   - Execute targeted provisioning checkpoints **OC-1A** through **OC-1H** per `docs/OFFICE_CONNECTION_AND_TESTING_GUIDE.md`.
2. **Phase 2 Development (Offline at Home):**
   - Implement database schema for `assess` schema in `api/src/migrations/`.
   - Implement in-memory and SQL repository layer with tenant isolation.
   - Implement repository contract tests (`test/repo-contract/*.contract.ts`).
