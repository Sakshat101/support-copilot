# Support Copilot (Free Edition)

An agentic, RAG-powered customer support system — same architecture as the
original Support-copilot project, rebuilt on a fully free stack (Ollama/Groq,
self-hosted Postgres+pgvector, self-hosted Redis, self-hosted Langfuse).

## Features
- Hybrid RAG retrieval (pgvector cosine similarity + Postgres full-text search, merged via Reciprocal Rank Fusion)
- LangGraph state machine with Postgres-backed checkpointing
- Self-built MCP server exposing order/refund/cancel tools
- Human-in-the-loop approval for any consequential action (`interrupt()` + `/approve`)
- Separate grounding-check step to reduce hallucination
- Episodic + semantic long-term memory per customer
- JWT auth with RBAC **and a revocation list**
- Background jobs (SLA monitoring, KB ingestion) via arq
- Full test suite wired into GitHub Actions CI

## Quick start

```bash
cp .env.example .env
docker compose up -d db redis
psql "$DATABASE_URL" -f app/db/schema.sql

# pull a free local model
ollama pull llama3.1:8b

pip install -r requirements.txt
uvicorn app.main:app --reload
```

Ingest a knowledge base:
```bash
python -m app.retrieval.ingest path/to/kb.txt
```

Run the MCP server standalone:
```bash
python -m app.mcp_server.server
```

Run the background worker:
```bash
arq app.workers.tasks.WorkerSettings
```

Run tests:
```bash
pytest -q
```

## API

- `POST /auth/register` `{email, password, role}`
- `POST /auth/login` `{email, password}` → `access_token`
- `POST /auth/logout` (revokes current token)
- `POST /chat` `{customer_id, message, thread_id}` (Bearer token required)
- `POST /approve/{thread_id}?approved=true|false` (admin role required)

## Project layout

```
app/
  api/            FastAPI routers (auth, chat, approvals)
  auth/           JWT issuing, revocation, RBAC dependency
  graph/          LangGraph state machine (retrieve/draft/grounding/approval)
  mcp_server/     Self-built MCP server (order/refund/cancel tools)
  memory/         Episodic + semantic memory store
  retrieval/      Embeddings, ingestion, hybrid RRF search
  workers/        arq background jobs (SLA monitor, KB ingestion)
  db/schema.sql   Postgres + pgvector schema
tests/            pytest suite, run in CI
.github/workflows/ci.yml
docker-compose.yml
Dockerfile
```

## Free stack

| Component | Tool |
|---|---|
| LLM | Ollama (local) or Groq free tier |
| Embeddings | sentence-transformers (`bge-small-en-v1.5`) |
| Vector DB | Postgres + pgvector (Docker or Supabase free tier) |
| Job queue | arq + Redis (Docker or Upstash free tier) |
| Observability | Langfuse (self-hosted, free) |
| CI | GitHub Actions (free for public repos) |
| Hosting | Fly.io / Render free tier, or local Docker Compose |
