# Marg.ai — Capstone Scaffold

Personalized learning platform: Syllabus → Knowledge Graph → Student Knowledge Profile →
Knowledge Gap Detection → Personalized Learning Path → AI Teaching → Practice → Reassessment → Mastery.

This is a **skeleton scaffold** for a 3-member B.Tech capstone. Every route/function that needs
real logic has a `// TODO` marker. It runs end-to-end with mock/stub responses out of the box,
so the team can build features incrementally without breaking the pipeline.

## Services

| Service      | Tech                      | Owner (suggested)     | Port |
|--------------|---------------------------|------------------------|------|
| frontend     | Next.js (App Router)      | Member 1 (Frontend)    | 3000 |
| backend      | Node.js + Express         | Member 2 (Backend/DB)  | 4000 |
| ai-service   | Python + FastAPI          | Member 3 (AI/NLP)      | 8000 |
| postgres     | PostgreSQL 16             | Member 2               | 5432 |
| neo4j        | Neo4j 5 (Community)       | Member 3               | 7474 / 7687 |

## Quick start

```bash
cp .env.example .env          # fill in secrets later, defaults work for local dev
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api/health
- AI service: http://localhost:8000/health
- Neo4j browser: http://localhost:7474 (user: neo4j / pass: see .env)

## How the pieces talk to each other

```
Frontend (Next.js)
      │  REST/JSON
      ▼
Backend (Express)  ── reads/writes ──▶ PostgreSQL   (users, syllabus, assessments, attempts,
      │                                              mastery scores, learning sessions)
      │  REST/JSON
      ▼
AI Service (FastAPI) ── reads/writes ─▶ Neo4j        (concepts, prerequisites, hierarchy)
      │
      ▼
LLM provider (pluggable: Anthropic / OpenAI / local / mock)
```

The **backend never talks to Neo4j or the LLM directly** — it always goes through the
AI service. This keeps the "smart" logic (NLP, KG reasoning, RAG, recommendation) in one
place that Member 3 owns, and keeps the backend a normal CRUD+auth service that Member 2 owns.

## Where to plug in real logic first (priority order)

1. `ai-service/app/routers/concept_extraction.py` — turn syllabus text into a concept list
2. `ai-service/app/routers/knowledge_estimation.py` — score a diagnostic assessment into per-concept mastery
3. `ai-service/app/routers/recommendation.py` — the personalization algorithm (pseudocode included)
4. `ai-service/app/routers/teaching.py` + `rag.py` — AI Teaching Module + RAG doubt support
5. `ai-service/app/routers/question_generation.py` — practice question generation/selection

## Choosing an LLM provider

Set `LLM_PROVIDER` in `.env` to one of:
- `mock` (default) — returns canned responses, good for building UI before you have a key
- `anthropic` — set `ANTHROPIC_API_KEY`
- `openai` — set `OPENAI_API_KEY`
- `local` — stub for a local/open-source model via Ollama (fill in `ai-service/app/llm_client.py`)

Nothing else in the codebase needs to change when you switch providers.

## Team division (suggested)

- **Member 1 — Frontend/UI-UX**: `frontend/` — dashboard, mode selection, KG visualization,
  teaching/practice/assessment screens, progress screens.
- **Member 2 — Backend/Database**: `backend/`, `database/postgres/` — auth, APIs, Postgres schema,
  learning session/progress tracking.
- **Member 3 — AI/ML/NLP**: `ai-service/`, `database/neo4j/` — concept extraction, KG construction,
  student knowledge estimation, recommendation engine, AI teaching, RAG, question generation.
