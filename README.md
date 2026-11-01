# AI Candidate Assessment Platform — Backend

Multi-tenant AI-powered candidate assessment backend built with Node.js 20, Express, TypeScript, Azure SQL, Blob Storage, Azure AI Foundry (GPT-4o), and Azure Communication Services.

## Quick Start (local)

```bash
# 1. Copy env and fill in values
cp api/.env.example api/.env.local

# 2. Start SQL Server + Azurite
docker compose up -d

# 3. Install deps
cd api && npm ci

# 4. Run migrations
npm run migrate

# 5. Start dev server
npm run dev
```

## Project Structure

```
api/          — Express API (TypeScript)
infra/azure/  — Azure provisioning scripts
scripts/      — DB, smoke, and E2E scripts
docs/         — Architecture and phase reports
```

## Testing

```bash
cd api
npm run lint
npm run typecheck
npm test
npm run test:unit
npm run test:integration
npm run test:contract
```

## Docs

- [Phase Reports](docs/phase-reports/)
- [Decisions](docs/decisions.md)

