# Marg.ai — Personalized AI Learning Platform

> **B.Tech Computer Science capstone project** | Source-code-based technical documentation

Marg.ai is a web application that organizes a student's learning around a syllabus, concept dependencies, assessment performance, and AI-assisted teaching. Students can upload syllabus PDFs, view extracted units/topics/concepts, generate prerequisite-aware learning paths, attempt assessments and practice questions, request AI explanations, and ask syllabus-related doubts through a retrieval-augmented question-answering workflow.

**Documentation basis:** The uploaded `Marg.AI-main (1).zip` repository snapshot (Git commit recorded in the archive: `2539a547325fb0167b3d91cbed5a386b8ccba314`, dated October 24, 2026). This document is based on source and configuration files, **not on claims in the prior README**. Some subsequent changes discussed during development, including Groq retries and the `/ask` subject-resolution patch, are newer than this ZIP and **must be compared with your current branch before relying on exact details**. The existence of code is not a guarantee that a workflow has passed an end-to-end test.

## Contents

1. [Problem and objectives](#problem-and-objectives)
2. [Implemented capabilities and status](#implemented-capabilities-and-status)
3. [Technology stack](#technology-stack)
4. [Architecture](#architecture)
5. [Repository structure](#repository-structure)
6. [Application workflows](#application-workflows)
7. [Local setup using Docker Compose](#local-setup-using-docker-compose)
8. [Local setup without Docker](#local-setup-without-docker)
9. [Configuration reference](#configuration-reference)
10. [Databases and data model](#databases-and-data-model)
11. [Backend API reference](#backend-api-reference)
12. [FastAPI AI endpoints](#fastapi-ai-endpoints)
13. [Core algorithms and implementation notes](#core-algorithms-and-implementation-notes)
14. [Testing and quality checks](#testing-and-quality-checks)
15. [Deployment](#deployment)
16. [Troubleshooting](#troubleshooting)
17. [Security, privacy, and limitations](#security-privacy-and-limitations)
18. [Development roadmap](#development-roadmap)
19. [Contributing and maintenance](#contributing-and-maintenance)

## Problem and objectives

Generic learning resources do not automatically map an individual student's syllabus to prerequisite relationships or adapt the learning sequence based on that student's assessment results. Marg.ai attempts to address that gap by combining:

- **Syllabus structure:** subjects, units, topics, concepts.
- **Concept graph:** links between concepts and their prerequisites.
- **Mastery estimates:** rule-based understanding scores derived from assessment data.
- **Learning recommendations:** sequences that consider dependencies and previous performance.
- **Generative teaching:** multiple explanation modes and practice-question generation.
- **Retrieval-augmented doubt answering:** contextual answers grounded in chunks indexed from uploaded syllabi, when RAG storage is properly configured.

Target users are students studying computer science subjects. The application is an educational support tool, not a replacement for instructors or a guarantee of factual correctness in generated answers.

## Implemented capabilities and status

| Capability | Code evidence | Status / caveat |
|---|---|---|
| Register and log in | `backend/src/routes/auth.js`, JWT middleware | Implemented in code; full security audit pending |
| Student dashboard and progress | `backend/src/routes/dashboard.js`, `frontend/app/dashboard`, `frontend/app/progress` | Implemented routes and UI; real-data behavior needs verification |
| PDF syllabus upload | `backend/src/routes/syllabus.js` | Implements 20 MiB in-memory upload, PDF parsing and text storage; scanned/image-only PDFs may not be readable |
| Syllabus processing | Express syllabus processing + FastAPI concept extraction | Implements extraction and database persistence; dependent on LLM, Neo4j and RAG setup |
| Knowledge graph | `ai-service/app/routers/graph.py`, `database/neo4j/schema.cypher` | Neo4j hierarchy and prerequisite queries; authorization review needed |
| Knowledge estimation | `ai-service/app/routers/knowledge_estimation.py` | Rule-based assessment score logic; not a trained student knowledge model |
| Learning paths | `ai-service/app/routers/recommendation.py`, `backend/src/routes/learningPath.js` | Single-topic and full-syllabus logic; integration and cycle tests required |
| Explanation and re-teaching | `ai-service/app/routers/teaching.py` | LLM-based plain-text responses; susceptible to model output limits/quotas |
| Practice and assessments | `backend/src/routes/practice.js`, `assessment.js`; AI question generator | Code paths exist; generated output must be validated |
| Ask a Doubt (RAG) | `backend/src/routes/teaching.js`, `ai-service/app/routers/rag.py` | Requires subject resolution, `DATABASE_URL`, pgvector extension and `rag_chunks` table; not fully provisioned by ZIP schema |

**Definition of “implemented”:** source code for the operation exists. This table does **not** claim that every route or integration passed live testing.

## Technology stack

| Layer | Technology | Why it is used |
|---|---|---|
| Browser UI | Next.js 14, React 18, CSS | Routes, reactive page state and student-facing pages |
| Interactive graph | React Flow | Visualization of knowledge-graph data |
| Markdown answers | `react-markdown`, `remark-gfm` | Present model-generated formatted content |
| HTTP client | Axios | Frontend ↔ Express and Express ↔ FastAPI requests |
| Application API | Node.js 20, Express 4 | Authentication, business logic and SQL persistence |
| Authentication | JWT (`jsonwebtoken`), `bcryptjs` | Signed sessions and password hashing |
| Files | Multer, `pdf-parse` | PDF upload and extraction |
| Relational data | PostgreSQL 16, `pg` | User records, syllabus metadata, assessments, mastery, paths and interactions |
| Graph data | Neo4j 5, Neo4j Python driver | Prerequisite relationships and graph traversal |
| AI API | Python 3.11, FastAPI, Pydantic | Validated AI-related endpoints |
| LLM | Groq OpenAI-compatible API via `openai` Python package | Explanations, question generation and concept processing |
| Text retrieval vectors | scikit-learn `HashingVectorizer`, NumPy | Deterministic 384-dimensional sparse-feature hashing converted to dense vectors |
| Vector persistence | pgvector via PostgreSQL + Psycopg | Store/retrieve indexed syllabus text vectors |
| Containers | Docker Compose | Local five-service environment |
| CI | GitHub Actions | Frontend build, backend syntax check, deploy hook |

**Precision note:** `HashingVectorizer` is **not** a transformer-based semantic embedding model. Groq model availability and API behavior can change; the actual configured model is determined by the deployed `GROQ_MODEL` variable.

## Architecture

```mermaid
flowchart TD
    Student[Student browser] --> Next[Next.js / React frontend]
    Next -->|REST + JWT| Express[Express backend :4000]
    Express --> Postgres[(PostgreSQL :5432)]
    Express -->|HTTP service calls| FastAPI[FastAPI AI service :8000]
    FastAPI --> Neo4j[(Neo4j :7687)]
    FastAPI -->|Psycopg / pgvector| Postgres
    FastAPI -->|Chat completions| Groq[Groq API]
```

The frontend calls the Express API, **not** Groq directly. Express owns authenticated student operations and relational persistence. FastAPI handles concept extraction, graph queries, recommendations, teaching, question generation and syllabus retrieval. PostgreSQL stores structured student/application records; Neo4j stores graph structure. The RAG module also accesses PostgreSQL directly to read and write vectors.

### Service defaults

| Service | Local URL / port | Health or interface |
|---|---|---|
| Frontend | `http://localhost:3000` | Browser app |
| Backend | `http://localhost:4000` | `GET /api/health` |
| AI service | `http://localhost:8000` | `GET /health`, `/docs` |
| PostgreSQL | `localhost:5432` | Database client / `pg_isready` |
| Neo4j | `http://localhost:7474` / Bolt `7687` | Browser / Cypher |

## Repository structure

```text
Marg.AI-main/
├── .github/workflows/ci.yml          # CI and optional backend deploy hook
├── .env.example                       # Example only; currently stale
├── docker-compose.yml                 # Local service orchestration
├── frontend/
│   ├── app/                           # App Router pages
│   │   ├── login/  register/  dashboard/  progress/
│   │   └── learn/                     # Mode, syllabus, topic, path, teach, practice, assessment
│   ├── components/                    # Navbar and knowledge-graph viewer
│   └── lib/api.js                     # Axios client / JWT interceptor
├── backend/
│   ├── src/index.js                   # Express app and route mounts
│   ├── src/routes/                   # Auth, dashboard, syllabus, graph, assessments,
│   │                                  # paths, teaching, practice
│   ├── src/services/aiServiceClient.js # Axios calls to FastAPI
│   ├── src/middleware/auth.js         # JWT verification
│   └── src/db/postgres.js             # PostgreSQL pool
├── ai-service/
│   ├── app/main.py                    # FastAPI initialization
│   ├── app/llm_client.py              # Shared LLM integration
│   ├── app/neo4j_client.py            # Graph driver
│   ├── app/routers/                   # Extraction, graph, estimation, recommendation,
│   │                                  # teaching, RAG, questions
│   └── tests/                         # Pytest modules
└── database/
    ├── postgres/schema.sql           # Relational schema (RAG table not included)
    └── neo4j/schema.cypher            # Graph constraints / DBMS example data
```

## Application workflows

### 1. Registration and login

1. User enters name/email/password in the frontend.
2. Express validates the submitted fields and checks the `users` table.
3. Registration hashes passwords with bcrypt (cost 10); login compares against the stored hash.
4. Backend issues a JWT valid for seven days.
5. Frontend stores it in `localStorage` under `margai_token` and sends it in `Authorization: Bearer <token>` headers.
6. `requireAuth` verifies the JWT on protected backend endpoints.

**Security improvement:** Prefer secure, HttpOnly cookies and stricter input handling for a production application. JWT verification alone does not establish resource ownership.

### 2. Upload and process a syllabus

1. The student uploads a PDF with `subjectName` to `POST /api/syllabus/upload`.
2. Multer holds the file in memory (20 MiB limit). `pdf-parse` extracts text.
3. Express creates `subjects` and `syllabi` records, including extracted raw text.
4. The user triggers `POST /api/syllabus/:syllabusId/process`.
5. Express checks ownership and passes text to FastAPI `POST /concepts/extract`.
6. Concept extraction attempts to identify units, topics and concepts, persist graph data in Neo4j and return structured data.
7. The backend persists relational metadata and calls `POST /teach/index-syllabus` to index text for RAG.

The processing endpoint depends on both AI output validation and persistence. A successful upload does **not** imply that concept extraction or RAG indexing succeeded. Image-only PDFs may require OCR, which is not implemented in the inspected upload flow.

### 3. Generate a learning path

1. Student chooses **single topic** or **full syllabus**.
2. Backend reads `concept_mastery` and sends the requested scope and mastery data to `POST /recommend/path`.
3. The AI service resolves relevant concepts and relationships through Neo4j; single-topic queries can generate a graph for a previously unknown topic.
4. Prerequisite dependencies determine ordering; mastery affects which concepts need review.
5. The backend saves a `learning_paths` row and `learning_path_steps` rows.
6. Frontend renders the ordered steps and updates step status via PATCH.

**Known concern:** In the inspected backend, single-topic paths save `subject_id` as null, which can complicate RAG subject resolution later.

### 4. Assessment, learning and reassessment

- Assessment endpoints start an assessment, save answers and complete the attempt.
- Knowledge estimation evaluates performance and contributes to `concept_mastery` updates.
- Students can open a concept for AI explanation in one of five modes: `simple`, `detailed`, `example`, `step_by_step`, `exam_oriented`.
- Practice question generation requests question content from FastAPI; answers and progress are handled by Express.
- Re-teaching uses an alternative explanation prompted by previous difficulties.
- Reassessment is a subsequent evaluation; the frontend should display a friendly concept label while preserving the immutable ID for requests.

### 5. Ask a Doubt (RAG)

1. Frontend sends `conceptId`, question and ideally `subjectId` or learning-path `stepId` to `POST /api/teach/ask`.
2. Backend determines the subject and forwards to FastAPI `POST /teach/rag-answer`.
3. RAG retrieves subject-linked indexed syllabus chunks from `rag_chunks` via pgvector similarity.
4. Retrieved snippets are included in a grounded prompt to Groq.
5. The response includes answer text and source snippets; Express writes the interaction to `ai_interactions`.

**Important:** The ZIP's initial `/ask` logic may return HTTP 400 when no subject can be identified. The newer subject-resolution patch discussed during development is **not** part of the October ZIP. Also, there is no complete `rag_chunks` DDL in the bundled `schema.sql`.

## Local setup using Docker Compose

### Requirements

- Git, Docker Engine/Desktop, Docker Compose plugin.
- Ports **3000, 4000, 8000, 5432, 7474 and 7687** available.
- Groq API credentials for features that call an LLM.

### Commands (PowerShell, from the repository root)

```powershell
Copy-Item .env.example .env
notepad .env
```

Before starting, **correct the stale `.env.example` values**: use `LLM_PROVIDER=groq`, add `GROQ_API_KEY`, and configure `DATABASE_URL` for the AI service. The example contains old `mock`/Anthropic/OpenAI provider options that are not evidence of supported behavior in this snapshot.

A typical Compose-oriented `.env` includes:

```dotenv
POSTGRES_USER=margai
POSTGRES_PASSWORD=replace_with_local_password
POSTGRES_DB=margai
NEO4J_AUTH=neo4j/replace_with_neo4j_password
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=replace_with_neo4j_password
JWT_SECRET=replace_with_long_random_secret
AI_SERVICE_URL=http://ai-service:8000
LLM_PROVIDER=groq
GROQ_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=your_key_here
LLM_TIMEOUT_SECONDS=60
LLM_MAX_RETRIES=3
DATABASE_URL=postgresql://margai:replace_with_local_password@postgres:5432/margai
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Never commit actual API keys or passwords. The two `NEO4J` password settings must agree, and `DATABASE_URL` must match the PostgreSQL credentials.

```powershell
docker compose up --build -d
docker compose ps
docker compose logs -f backend ai-service
```

Verify:

```powershell
curl.exe http://localhost:4000/api/health
curl.exe http://localhost:8000/health
```

**Critical RAG setup gap:** The supplied `database/postgres/schema.sql` does not create `rag_chunks` or install the `vector` extension, and `postgres:16` does not necessarily include pgvector. Therefore the bundled Compose setup is **not sufficient** to run the complete RAG workflow unchanged. Install/use a compatible pgvector-enabled PostgreSQL image or instance, add a reviewed migration for the required RAG table and indexes, and only then test syllabus indexing. Avoid claiming this is a turnkey deployment before completing that work.

**Database initialization:** Docker's `/docker-entrypoint-initdb.d` scripts execute only when PostgreSQL initializes an empty data volume. Editing `schema.sql` later will not automatically migrate an existing volume. Use SQL migrations for established databases; do not delete volumes containing valuable data merely to reload the schema.

Stop services without deleting data:

```powershell
docker compose down
```

Do **not** use `docker compose down -v` unless you intentionally want to delete the database volumes.

## Local setup without Docker

For development, start PostgreSQL 16, Neo4j 5 and their schemas separately. Configure real network addresses rather than Compose service names (`postgres`, `neo4j`, `ai-service`).

**Backend (PowerShell):**

```powershell
cd backend
npm ci
npm run dev
```

Backend requires a PostgreSQL `DATABASE_URL`, `JWT_SECRET` and `AI_SERVICE_URL`; it listens on `BACKEND_PORT` (default `4000`).

**AI service (separate PowerShell terminal):**

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Configure `GROQ_API_KEY`, Neo4j variables and a suitable PostgreSQL `DATABASE_URL`. AI service Python dependencies are defined in `ai-service/requirements.txt`; the ZIP pins `openai==1.35.0`. If you upgrade or change SDK API arguments, check compatibility first.

**Frontend (third PowerShell terminal):**

```powershell
cd frontend
npm ci
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api` in the frontend's environment. Visit `http://localhost:3000`.

## Configuration reference

| Variable | Consumed by | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend, FastAPI RAG | PostgreSQL connection; crucial for RAG |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Compose PostgreSQL | Database initialization |
| `POSTGRES_HOST`, `POSTGRES_PORT` | Local/Compose configuration | Environment metadata; backend pool uses `DATABASE_URL` |
| `NEO4J_AUTH` | Compose Neo4j | Initial Neo4j login configuration |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | FastAPI graph client | Neo4j Bolt connectivity |
| `JWT_SECRET` | Express auth middleware | JWT signing and verification; **must be unique and secret** |
| `AI_SERVICE_URL` | Express AI client | FastAPI base URL |
| `BACKEND_PORT` | Express app | HTTP listener (defaults to 4000) |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend Axios | Public Express API URL, exposed to browser |
| `LLM_PROVIDER` | AI LLM client | Inspected code accepts `groq` |
| `GROQ_API_KEY`, `GROQ_MODEL` | AI LLM client | Provider credential and model |
| `LLM_TIMEOUT_SECONDS`, `LLM_MAX_RETRIES` | AI LLM client | Timeout and attempt count in ZIP implementation |
| `EMBEDDING_PROVIDER` | FastAPI RAG | Read from environment; inspected embedding path uses hashing vectors |

Configuration differences between your October ZIP and more recent deployed versions should be reviewed before editing Render variables.

## Databases and data model

### PostgreSQL

The checked-in relational schema includes these tables:

| Area | Tables |
|---|---|
| Accounts | `users` |
| Course structure | `subjects`, `syllabi`, `units`, `topics`, `topic_concepts` |
| Questions | `questions`, `question_concepts` |
| Assessments | `assessments`, `assessment_questions`, `attempts` |
| Mastery | `concept_mastery`, `mastery_history` |
| Learning | `learning_paths`, `learning_path_steps`, `learning_sessions` |
| Audit/content | `ai_interactions`, `resources` |

The schema stores concept identifiers as strings referencing Neo4j concept IDs; cross-database foreign-key enforcement is not available. Relational constraints, ownership filters and ID consistency matter.

### Neo4j

The graph schema includes `Subject`, `Unit`, `Topic` and `Concept` nodes, with relationship types such as `HAS_UNIT`, `HAS_TOPIC`, `HAS_CONCEPT`, `REQUIRES` and `PART_OF`. The supplied Cypher file also contains a DBMS example graph. Concept dependencies can be traversed to build prerequisite-aware paths.

### pgvector / RAG

The RAG implementation chunks text using `max_chars=1600`, `overlap=200`, creates 384-dimensional vectors using `HashingVectorizer`, and accesses a table named `rag_chunks`. A working database requires a pgvector extension and a migration whose column types match the SQL in `ai-service/app/routers/rag.py` (`syllabus_id`, `subject_id`, `chunk_index`, `content`, `embedding`, `source_filename`). **Do not run a guessed table migration in production without reviewing constraints and retrieval queries.**

## Backend API reference

All backend paths are prefixed with `/api`. Most application endpoints require `Authorization: Bearer <JWT>`; register, login and health do not.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Backend health |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Authenticate and return JWT |
| GET | `/api/dashboard/overview` | Dashboard overview |
| GET | `/api/dashboard/knowledge-profile` | Mastery profile |
| GET | `/api/dashboard/current-learning` | Active learning context |
| GET | `/api/dashboard/assessments` | Assessment history |
| GET | `/api/dashboard/progress` | Progress summary |
| POST | `/api/syllabus/upload` | Upload PDF + subject name |
| POST | `/api/syllabus/:syllabusId/process` | Process uploaded syllabus |
| GET | `/api/graph/prerequisites/:conceptId` | Concept dependencies |
| GET | `/api/graph/subject/:subjectId` | Subject graph |
| POST | `/api/assessments/start` | Create an assessment |
| POST | `/api/assessments/:assessmentId/answer` | Submit an answer |
| POST | `/api/assessments/:assessmentId/complete` | Finalize assessment |
| POST | `/api/learning-paths/generate` | Generate learning path |
| GET | `/api/learning-paths/:pathId` | Retrieve stored path |
| PATCH | `/api/learning-paths/steps/:stepId` | Update learning-step status |
| POST | `/api/teach/explain` | Generate explanation |
| POST | `/api/teach/ask` | RAG-based doubt answering |
| POST | `/api/teach/reteach` | Alternative teaching |
| POST | `/api/practice/questions` | Fetch/generated practice questions |
| POST | `/api/practice/attempt` | Submit practice attempt |

### Example: registration

```http
POST /api/auth/register
Content-Type: application/json

{"fullName":"Example Student","email":"student@example.com","password":"use-a-strong-password"}
```

The successful response contains a `token` and user information. Protect the token; do not include real JWTs in issue reports.

### Example: request an explanation

```http
POST /api/teach/explain
Authorization: Bearer <JWT>
Content-Type: application/json

{"conceptId":"dbms.normalization","explanationMode":"simple"}
```

These examples describe request shape; they are **not captured successful test evidence**.

## FastAPI AI endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Service health |
| POST | `/concepts/extract` | Extract syllabus structure and graph concepts |
| GET | `/graph/prerequisites/{concept_id}` | Read graph prerequisites |
| GET | `/graph/subject/{subject_id}` | Read a subject graph |
| POST | `/graph/subject/{subject_id}/infer-prerequisites` | Graph prerequisite inference endpoint; verify internals before claiming completeness |
| POST | `/knowledge/estimate` | Calculate mastery from assessment data |
| POST | `/recommend/path` | Recommend concepts and order |
| POST | `/teach/explain` | Generate natural-language explanation |
| POST | `/teach/reteach` | Generate alternative explanation |
| POST | `/teach/index-syllabus` | Index syllabus for retrieval |
| POST | `/teach/rag-answer` | Retrieve context and answer a doubt |
| POST | `/practice/select` | Generate/select practice questions |

FastAPI offers interactive API documentation at `/docs` when running and reachable.

## Core algorithms and implementation notes

### Concept extraction

Uses an LLM to transform raw syllabus content into structured units/topics/concepts. The extraction router validates model-produced structure and writes graph information. Always verify malformed JSON handling and avoid assuming the generated dependency edges are factually correct.

### Knowledge estimation

A rule-based scoring algorithm derives per-concept mastery indicators from student performance; this is not an ML model trained on historic student learning data. The system maintains `concept_mastery` snapshots and history in relational storage.

### Recommendation

Uses concept/prerequisite information with mastery inputs to choose learning steps. The inspected module defines a `MASTERY_THRESHOLD` of 75, a revision band of 65–75, maximum generated concepts of 30, and prerequisite-depth safeguards. Cycle handling matters because a directed cycle is not a valid prerequisite learning order.

### LLM teaching

The explanation endpoint selects prompts by explanation mode and mastery hint; outputs are plain text (not JSON). GPT-OSS is a reasoning model and may consume completion budget before finishing the visible explanation. Your later debugging logs showed truncated completions (`finish_reason=length`) and SDK compatibility problems with `max_completion_tokens`. Pin or validate the SDK and keep rate-limit handling deliberate.

### Retrieval-augmented generation

Indexing chunks the syllabus, computes lightweight hashing vectors and inserts them into PostgreSQL/pgvector. A doubt query retrieves subject-relevant chunks and adds them to the Groq prompt. Without suitable subject linkage or RAG database setup, `/ask` may fail even when `/explain` works. These vectors do not provide the semantic capabilities of a learned transformer embedding model.

## Testing and quality checks

The snapshot contains Python tests:

- `test_full_syllabus.py`
- `test_personalization.py`
- `test_recommendation.py`
- `test_recommendation_api.py`
- `test_subject_agnostic.py`

**PowerShell — AI service:**

```powershell
cd ai-service
python -m pytest tests -v
python -m compileall -q app
```

Install test dependencies as required (for example `pytest`); `pytest` is not listed in the checked-in `requirements.txt`. Tests mocking graph resolution should avoid accidentally triggering live Neo4j or LLM calls.

**PowerShell — backend:**

```powershell
cd backend
npm ci
node --check src/index.js
```

**PowerShell — frontend:**

```powershell
cd frontend
npm ci
npm run build
```

**CI:** `.github/workflows/ci.yml` builds the frontend and checks backend entrypoint syntax on configured branches. It does **not** establish complete end-to-end feature coverage. A Render deploy hook is used in CI and requires a repository secret.

### Recommended manual end-to-end test sequence

1. Register → log in → open dashboard.
2. Upload a text-based PDF; confirm upload and extraction.
3. Process syllabus; check both relational and Neo4j entries.
4. Confirm RAG chunks exist for the uploaded subject.
5. Generate a subject learning path and open its steps.
6. Generate explanation in multiple modes.
7. Generate questions, submit assessment and inspect mastery changes.
8. Open a learning-path concept; ask a doubt and inspect sources.
9. Reassess and confirm learning-step/progress state.
10. Test invalid JWT, nonexistent IDs, empty PDF, rate-limit and database-failure cases.

Record actual outcomes and logs. Do not mark a test **Passed** without execution evidence.

## Deployment

### General layout

The source includes Dockerfiles for all three application services and a Compose file for local development. Deployment-specific hosts and credentials must be configured per environment. Frontend and backend/AI services can be deployed independently; this repository's runtime defaults alone do not prove a specific hosted environment is live.

### Example: Render backend

- Root directory: `backend`.
- Build command: `npm ci`.
- Start command: `npm start` (`node src/index.js`).
- Set `DATABASE_URL`, strong `JWT_SECRET`, and `AI_SERVICE_URL` in Render's Environment settings.
- Verify `/api/health`, then login and DB connectivity.

### Example: Render FastAPI

- Root directory: `ai-service`.
- Build command: `pip install -r requirements.txt`.
- Example start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (use the port exposed by the hosting environment).
- Configure `LLM_PROVIDER=groq`, `GROQ_API_KEY`, `GROQ_MODEL`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, and `DATABASE_URL`.
- Verify `/health` and inspect `/docs` if accessible.

### Example: Vercel frontend

- Root directory: `frontend`.
- Framework: Next.js.
- Environment: `NEXT_PUBLIC_API_BASE_URL=https://<your-backend-host>/api`.
- Rebuild after changing public frontend environment variables.

### Operations and logs

For Render, use the service's **Events/Deploys** to identify new deploys, restarts or suspensions, and **Logs** to inspect stdout/stderr. Review timestamp and timezone before concluding that a log belongs to the current outage. A healthy FastAPI log generally includes startup lines and an HTTP 200 response for `/health`.

**Graceful shutdown is not necessarily a crash:**

```text
INFO: Shutting down
INFO: Waiting for application shutdown.
INFO: Application shutdown complete.
INFO: Finished server process [64]
```

These lines show that Uvicorn exited cleanly after a shutdown signal. Check whether a new instance started and whether the deployment is Live. The lines by themselves do not identify why the process was stopped.

## Troubleshooting

| Symptom | Likely cause / diagnostic action |
|---|---|
| Backend logs `npm error signal SIGTERM` | Process received termination signal. Check Render Events and startup logs; deploy replacement can be normal. |
| FastAPI logs graceful `Shutting down` | Graceful stop/restart. Inspect Events and the next startup; not automatically a code crash. |
| `/teach/explain` returns HTTP 429 with HTML `Just a moment...` | Edge/Cloudflare challenge on public AI endpoint; compare backend vs FastAPI request logs and response headers. Not the normal Groq quota response. |
| Groq request returns HTTP 429 | Provider quota/rate limit; inspect actual response headers and appropriate `Retry-After` handling. |
| `TypeError ... unexpected keyword argument max_completion_tokens` | Incompatible installed `openai` SDK method signature. Use an SDK-compatible token argument or deliberately upgrade/test SDK. |
| `LLM output was truncated twice` | Model returned `finish_reason=length`; reduce reasoning effort if supported, limit response length, and review completion budget. |
| `/api/teach/ask` returns 400 for subject | Missing/ambiguous `subjectId` or `stepId`; validate user's syllabus ownership and preserve subject context through navigation. |
| `/teach/rag-answer` returns 503 | Check `DATABASE_URL`, pgvector installation, `rag_chunks` DDL, DB availability and indexing logs. |
| PostgreSQL `relation rag_chunks does not exist` | Required RAG migration is missing; the checked-in SQL does not define this table. |
| `ECONNREFUSED` to Neo4j | Wrong Bolt URI/credentials, stopped container, or network configuration. |
| PDF upload has no extracted text | PDF may contain scans; OCR not implemented in inspected upload path. |
| Generated concept title shows a hash suffix | UI is displaying `generated.<slug>_<hash>` ID; use a human-friendly label in views but preserve raw ID for requests. |
| Docker SQL changes not applied | Init scripts execute only on first database volume initialization; apply a migration. |

### Recommended incident triage

1. Record the exact timestamp and user action.
2. Inspect the browser Network response status/body.
3. Find the matching Express backend log.
4. Check whether FastAPI logged the corresponding request.
5. If FastAPI was reached, inspect Groq/Neo4j/PostgreSQL errors.
6. Distinguish a request failure from an unrelated platform restart.
7. Make the smallest code/configuration change; run tests and reproduce the original action.

## Security, privacy, and limitations

### Current concerns

- JWTs are held in browser `localStorage`; XSS could expose them.
- `JWT_SECRET` has an unsafe development fallback. Production should refuse startup without a real secret.
- Some graph endpoints in the inspected snapshot read IDs without clear per-user ownership checks; validate access in the backend and AI service.
- RAG queries and indexing should enforce user/subject boundaries throughout the pipeline.
- Groq outputs can be inaccurate, incomplete, expensive or temporarily unavailable.
- `HashingVectorizer` similarity has limitations compared with semantic embeddings.
- Some generated prerequisite relationships may be incorrect or cyclic.
- `rag_chunks` provisioning is missing from the checked-in PostgreSQL schema.
- PDF upload does not cover image-only documents without OCR.
- The `.env.example` lists providers and vector backends that are not verified as implemented in the code.
- No measured production availability, scale or answer accuracy is established from source inspection alone.

### Future improvements (not currently claimed as implemented)

- Complete and versioned migrations for pgvector and RAG storage.
- End-to-end ownership checks and secure session storage.
- Better observability (request IDs, error categories, structured metrics).
- Retry budgeting, request throttling, quota visibility and caching.
- Benchmark retrieval quality, learning-path relevance and explanation accuracy.
- Improved concept-label resolution and subject association for generated topics.
- OCR for scanned PDFs, if required.
- Trained semantic embeddings or a hybrid retrieval approach, with measured evidence.
- Additional automated integration and E2E tests.

## Development roadmap

| Priority | Work item | Completion criterion |
|---|---|---|
| P0/P1 | Secure and provision RAG Postgres + pgvector | Migration applies; index/retrieve tested against a real uploaded syllabus |
| P1 | Enforce per-user graph/RAG authorization | Cross-user access tests fail safely |
| P1 | Fix subject propagation for Ask a Doubt | Single-topic and full-syllabus questions both resolve correct context |
| P1 | Make teaching robust to LLM API errors | Provider error, truncation and quota cases tested |
| P2 | Validate prerequisite inference and recommendation paths | Deterministic tests and real graph cases including cycles pass |
| P2 | Build full integration/E2E suite | Critical student journey has execution evidence |
| P2 | Improve generated concept display names | No hash IDs shown in headings; API IDs unchanged |
| P3 | Improve deployment/logging documentation | Operators can identify process restarts and upstream failures |

These priorities are engineering assessments, not claims of bugs that have all been reproduced in production.

## Contributing and maintenance

When editing Marg.ai:

1. Create a branch and describe the issue and expected behavior.
2. Check related UI, Express route, FastAPI route and persistence logic.
3. Prefer small changes that preserve API contracts.
4. Add tests for regressions, including auth/ownership and invalid input.
5. Run syntax/build/tests locally and save observed results.
6. Do not commit `.env`, keys, JWTs or private student data.
7. Update this README, environment examples and database migrations when behavior changes.

### Technical reference files

- `docker-compose.yml`
- `backend/src/index.js`
- `backend/src/services/aiServiceClient.js`
- `backend/src/routes/`
- `frontend/lib/api.js`
- `ai-service/app/main.py`
- `ai-service/app/routers/`
- `database/postgres/schema.sql`
- `database/neo4j/schema.cypher`
- `.github/workflows/ci.yml`

---

**Project:** Marg.ai — AI-powered personalized learning platform  
**Repository:** https://github.com/Garv-Saluja/Marg.AI  
**Document status:** Comprehensive source-code-based README; runtime/deployment claims require independent verification against the latest main branch.
