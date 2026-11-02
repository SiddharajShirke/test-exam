# How to apply this drop (phases 0-6)

This archive holds the **whole backend repository content** for phases 0-6 and nothing else.

## Replace (delete the old copy first, then copy the new one in)
`.github/`  `api/`  `docs/`  `infra/`  `scripts/`  `tests/`
and the root files `README.md`, `AGENTS.md`, `pytest.ini`, `ruff.toml`, `.editorconfig`, `.gitignore`, `docker-compose.yml`.

## Keep exactly as you have them (not in this archive)
`frontend/`  `backend/`  `database/`  `ai_service/`  and your copy of `AI_Assessment_MVP_Design_and_API_Contract.pdf`.

## Then (any machine with Python 3.12, no Docker, no Azure needed)
```bash
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r api/requirements-dev.txt
ruff check . && ruff format --check . && (cd api && mypy app)
pytest -m "not sql"                      # about 1 minute; SQL Server variants run in GitHub Actions
```
Commit and push; the `fast` and `container` CI jobs are the first proof of the SQL Server path.
Read `docs/phase-reports/06-ai-generation.md` (decisions to confirm) and `docs/UNVERIFIED_AZURE_LEDGER.md` first.
