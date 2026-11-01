# Unverified Azure Ledger

> **Maintained by the Agent. Verified by the Human at the Office.**  
> Specification: `docs/prompts/PROMPT_B_ADDENDUM_OFFLINE_AZURE_READY.md` Section B6.5.  
> Statuses: `UNVERIFIED` | `VERIFIED` | `FIXED-AT-OFFICE`  
> **Public Repository Rule:** Placeholders only (`<RG>`, `<SQL_SERVER>`, etc.). No real secrets or tenant IDs.

---

## Ledger Entries

| ID | Component | File | Assumption Made (Doc Citation & Date) | Verified By | Status | Notes |
|---|---|---|---|---|---|---|
| **AZ-001** | AI Foundry | `api/src/tools/probe.ts`, `infra/azure/40-ai.sh` | Foundry endpoint supports standard OpenAI-compatible route (`/openai/v1/chat/completions`) or legacy deployment route (`/openai/deployments/{deployment}/chat/completions?api-version=...`). Configured via `FOUNDRY_API_STYLE`. | OC-1D, OC-1H | `UNVERIFIED` | Portal team currently uses `azure_deployments` style in `ai_service/`. Probe supports both styles. |
| **AZ-002** | Azure SQL | `api/src/config/index.ts`, `api/src/tools/probe.ts` | Azure SQL requires `Encrypt=true;TrustServerCertificate=false`. Port 1433 standard. `tedious` driver handles encryption. | OC-1B, OC-1H | `UNVERIFIED` | Connection string parsed from `DATABASE_URL`. Office guide confirms firewall rule for client IP or Azure Services. |
| **AZ-003** | Blob Storage | `infra/azure/30-blob.sh`, `api/src/tools/probe.ts` | Storage account created with `Standard_LRS`, `--allow-blob-public-access false`, TLS 1.2+. Container `jd-files` created with `--public-access off`. Anonymous GET returns 401/403/404/409. | OC-1C, OC-1H | `UNVERIFIED` | Probe checks that anonymous read is blocked. |
| **AZ-004** | Email (ACS) | `infra/azure/50-email.sh`, `api/src/tools/probe.ts` | Azure Communication Services supports Azure-managed email domain (`AzureManagedDomain`). Free tier / minimal cost for test volume. Sender is `DoNotReply@<domain>.azurecomm.net`. | OC-1E, OC-1H | `UNVERIFIED` | Azure-managed domain requires no custom DNS setup, suitable for MVP. |
| **AZ-005** | Container Apps | `infra/azure/70-assess-api.sh` | Container App `assess-api` supports 0.25 vCPU and 0.5 GiB memory with min-replicas 1 (or 0 for dev). Managed identity assigned `AcrPull` on ACR. | OC-1F, OC-3 | `UNVERIFIED` | Sizing chosen for $25/mo budget ceiling. |
| **AZ-006** | GitHub OIDC | `infra/azure/70-assess-api.sh` | User-assigned identity supports GitHub federated credential with subject `repo:<REPO>:ref:refs/heads/main` and audience `api://AzureADTokenExchange`. Scoped Contributor role restricted to `assess-api` only (B3 row 29). | OC-1F, OC-3 | `UNVERIFIED` | Zero long-lived credentials stored in GitHub Secrets. |
| **AZ-007** | Core Monitoring | `infra/azure/10-core.sh` | Log Analytics workspace supports `PerGB2018` SKU with 30-day retention (free within 5GB/month ingestion limit). Application Insights linked to workspace. | OC-1A, OC-1H | `UNVERIFIED` | Reuse existing if present. |
| **AZ-008** | Database Permissions | `scripts/db/create-app-user.sql` | `assess_app` user granted `CONTROL` on schema `assess` and `CREATE TABLE`, `CREATE VIEW`, `CREATE PROCEDURE` at database level, but NO database-wide roles (`db_owner`, `db_datareader`, `db_datawriter`), preventing access to `dbo` tables. | OC-1B, OC-1H | `UNVERIFIED` | Enforces shared-database tenant boundary. |
| **AZ-009** | Budget Alerts | `infra/azure/10-core.sh` | Azure Consumption budget supports actual cost thresholds at 50% ($12.50), 80% ($20.00), and 100% ($25.00) sending alert emails. | OC-1A | `UNVERIFIED` | Protects $25.00 monthly spend ceiling. |
| **AZ-010** | ACR Registry | `infra/azure/60-registry.sh` | Basic SKU ACR (~$5/mo) with admin user disabled. Accessible via user-assigned managed identity with `AcrPull`. | OC-1A, OC-3 | `UNVERIFIED` | If portal already has an ACR, REUSE mode verifies it instead of creating. |
| **AZ-011** | SQL AppLock | `api/src/migrations/runner.ts` | `sp_getapplock` on resource `assess-migrations` (session scope, wait 60s) functions on Azure SQL under restricted `assess_app` without sysadmin/server-level roles. | OC-2, OC-3 | `UNVERIFIED` | Guarantees atomic, race-free schema migration across container instances. |
| **AZ-012** | SQL Merge Lock | `api/src/repositories/sql/index.ts` | `MERGE ... WITH (HOLDLOCK)` in `responses.upsert` operates correctly on Azure SQL under default READ COMMITTED for candidate answer autosaves. | OC-8 | `UNVERIFIED` | Prevents race condition during concurrent question autosave. |
| **AZ-013** | Filtered Unique Index | `api/src/migrations/sql/0001_init.sql` | Filtered unique index `UQ_participants_token_hash` allows multiple `NULL` entries while strictly preventing non-`NULL` collisions on Azure SQL. | OC-2, OC-7 | `UNVERIFIED` | Critical for uninvited candidates retaining NULL token_hash. |
