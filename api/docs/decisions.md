# Project Decisions & Organizational Constraints

**Project:** AI Candidate Assessment Platform (MVP Backend)  
**Context:** Existing Assessment Portal project (not a new application)  
**Last Updated:** 2026-11-01  

---

## 1. Confirmed Project & Architectural Decisions

| # | Topic / Decision | Confirmed Value | Operational Notes |
|---|---|---|---|
| a | **GitHub Repository** | Existing Repository: `https://github.com/SiddharajShirke/test-exam.git` | Do not create a new repository. Continue on current repo and branch hierarchy. |
| b | **Azure Subscription & Tenant** | Existing organizational Subscription & Tenant | Authenticated exclusively from organization-provided laptop. No credentials on dev machine. |
| c | **Azure Regional Architecture** | Distributed Architecture: **East US** (Apps, Logs, AI Foundry) + **West US** (SQL Server, SQL Database) | Preserve existing regional architecture. Deployment in West US was mandated by regional SQL availability constraints. |
| d | **R1 — Global Email Uniqueness** | **YES** | User email addresses are globally unique and case-insensitive across all tenants. |
| e | **R5 — Min Questions per Section** | **Equal to configured count** | Assessments require all configured questions to be present before approval is granted. |
| f | **R13 — API Ingress** | **External ingress enabled** | Target port 8080 with strict authentication, authorization, and rate-limiting controls. |
| g | **ACS Test Email** | User's office email | To be provided securely during Phase 1/Phase 7 live verification. |
| h | **Email Domain** | **Azure-managed domain** | For initial development and testing; avoid custom domain DNS complexity in MVP. |
| i | **Monthly Budget Ceiling** | **$25.00 USD / month** | Alerts configured at 50% ($12.50), 80% ($20.00), and 100% ($25.00). Strict cost control required. |

---

## 2. Organizational Device & Access Constraints

1. **Device Isolation:**
   - The organizational Azure account is strictly accessible **only** from the organization-provided laptop.
   - The local development laptop (Antigravity workspace) has **no direct Azure credentials or network access** to the organizational cloud.
   - Local installation of Azure CLI on the organizational laptop is blocked by corporate IT policy.
2. **Approved Administration Channels:**
   - **Azure Cloud Shell** (via browser on the organization laptop) is the primary CLI execution environment.
   - **Azure Portal UI** (browser on organization laptop) is the secondary verification and inspection channel.
3. **Workflow Separation:**
   - **Development Laptop:** Application code, TypeScript/Node.js logic, Dockerfiles, unit/integration/contract tests (with fakes), GitHub workflows, scripts, and documentation.
   - **Organization Laptop:** Cloud Shell command execution, resource inspection, service connection verification, role assignments, and production secret binding.
4. **Credential Protection:**
   - No Azure passwords, client secrets, MFA codes, or connection strings shall ever be requested, stored, or committed to Git, local files, or logs.

---

## 3. Existing Regional Resource Mapping

| Resource Category | Region | Known Existing Resource / Purpose | Notes / Constraints |
|---|---|---|---|
| **SQL Database & Server** | **West US** | Assessment SQL Server & Database | Chosen due to Azure SQL service tier availability restrictions in East US. Must not be migrated or duplicated without approval. |
| **Application & Portal** | **East US** | Existing Assessment Portal App Service / Container App | Existing user-facing portal and runtime. |
| **Telemetry & Logs** | **East US** | Log Analytics & Application Insights | Centralized diagnostic logging for application components. |
| **AI Foundry / OpenAI** | **East US** | `assessment-portal-resource` (`services.ai.azure.com`) | GPT-4o model deployment endpoint for question generation and marking. |
| **Storage & Artifacts** | **East US** *(to verify)* | Storage Account (`jd-files` blob container) | Document and file storage. |
| **Email Communication** | **East US / Global** *(to verify)* | Azure Communication Services | Managed email sending. |

---

## 4. Execution Directives Before Provisioning

- [x] Zero-touch on existing Azure resources: No creation, modification, migration, or deletion until plan approval.
- [x] Inspect existing architecture via Cloud Shell scripts executed on organizational laptop.
- [x] Evaluate East US vs. West US latency and network topology.
- [x] Produce resource-by-resource provisioning plan fitting within $25/month ceiling.
- [x] Await explicit human review and sign-off before Phase 1 provisioning.

---

## 5. Additional decisions (2026-11-01)

| # | Decision | Value |
|---|---|---|
| j | Database isolation | New schema `assess` in the existing database; app user owns only that schema; no access to existing tables |
| k | AI resource | Reuse the existing resource and its GPT-4o deployment; v1 route by default (`FOUNDRY_API_STYLE=v1`); `ai_service/` is reference only |
| l | Container apps | Create only `assess-api` in the existing environment (0.25 vCPU, 0.5 GiB, 1 replica); never touch the portal's apps |
| m | GitHub deploy identity | Contributor on the `assess-api` app only, AcrPush on the registry; subject `repo:SiddharajShirke/test-exam:ref:refs/heads/main` |
| n | Public repository | No real Azure names, ids, emails or secrets in the repo; plan uses placeholders |
| o | Removed to save cost | Clean-slate rehearsal, stress test, real database restore, RG-wide lock, availability test (unless the plan approves it) |
| p | Open question | Is the $25 ceiling for the new backend only, or the whole subscription? (answer after OC-0) |
