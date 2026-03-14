# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orbis ATS (formerly IntesaHR) is an Applicant Tracking System built as a microservices monorepo. It has 11 FastAPI backend services, a React SPA frontend, and infrastructure managed via Docker Compose (Postgres, Redis, MQTT, MailHog only — services run directly with uvicorn).

## Commands

### Infrastructure

```bash
# Start Postgres (pgvector), Redis, Mosquitto MQTT, MailHog
docker compose up -d

# Seed initial databases (run from repo root)
python scripts/seed_data.py
```

### Backend Services

Each service lives in `svc-*/` with its own venv and `requirements.txt`. There is no shared monorepo task runner.

```bash
# Install deps for a service (create venv first if needed)
cd svc-recruiting && pip install -r requirements.txt

# Run a service (each has its own port)
cd svc-recruiting && python main.py
# or: uvicorn main:app --host 0.0.0.0 --port 8002 --reload

# Syntax-check all Python files in a service
cd svc-workflows && python3 -m py_compile main.py && find app -name '*.py' -exec python3 -m py_compile {} +
```

No test suites or linter configurations exist yet. Validation is done via `py_compile` and manual testing.

### Frontend (ui/)

```bash
cd ui
npm install
npm run dev          # Vite dev server on port 8080
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # TypeScript type check
```

## Service Map

| Service | Port | Database | Purpose |
|---------|------|----------|---------|
| svc-gateway | 8000 | — | API gateway, routes by path prefix to backend services |
| svc-auth | 8001 | auth_db | JWT auth, OAuth (Google/LinkedIn), OTP, password reset |
| svc-recruiting | 8002 | recruiting_db | Core ATS: jobs, candidates, pipeline, interviews, screening, dashboards (50+ tables) |
| svc-admin | 8003 | auth_db | User management, audit logs, settings, templates, announcements |
| svc-ai-jd | 8010 | — | JD parsing & rubric extraction (LLMChain) |
| svc-ai-resume | 8011 | — | Resume evaluation & metadata extraction (LLMChain) |
| svc-ai-interview | 8012 | — | Interview transcript analysis & live AI interview (LLMChain) |
| svc-ai-chat | 8013 | chat_db (pgvector) | General-purpose chat |
| svc-ai-orchestrator | 8014 | orchestrator_db | LangGraph-based AI orchestration: ranking, fit summaries, skills gap, JD generation, screening scoring |
| svc-workflows | 8015 | workflows_db | Visual DAG workflow engine for talent sourcing pipelines |
| svc-mqtt | 8020 | — | Redis→MQTT bridge for real-time browser notifications |
| ui | 8080 | — | React SPA (Vite dev server proxies API calls to backend ports) |

### Gateway Routes

All frontend API calls go through the gateway or the Vite dev proxy. Key prefixes:

- `/api/auth` → 8001, `/api/job` + `/api/candidates` + `/api/interview` + `/api/dashboard` + `/api/screening` + `/api/careers` → 8002
- `/api/admin` + `/api/settings` → 8003, `/api/orchestrator` → 8014, `/api/workflows` → 8015

## Architecture

### Backend Pattern

Every Python service follows the same structure:

```
svc-*/
  main.py              # FastAPI app, lifespan, middleware, router includes
  app/
    core/config.py     # Pydantic Settings from .env
    core/security.py   # JWT validation, role guards
    db/                # SQLAlchemy async engine + session
    models/  or db/models.py  # SQLAlchemy ORM models
    schemas/           # Pydantic request/response schemas
    api/v1/ or routers/  # FastAPI route handlers
    services/          # Business logic
```

Services use **async SQLAlchemy 2.0** with asyncpg. Each service has its own PostgreSQL database (see `scripts/postgres-init.sql`). Tables are auto-created via `Base.metadata.create_all()` on startup.

### svc-ai-orchestrator (LangGraph)

The AI orchestration layer uses **LangGraph state machines** compiled at startup. Key architecture:

- `app/graphs/` — compiled LangGraph workflows (hiring_agent, resume_scoring, interview_eval, candidate_ranking, jd_generation, screening_scoring, salary_estimate, etc.)
- `app/nodes/` — organized by domain (hiring/, candidate/, interview/, resume/, jd/, screening/, salary/, lead_gen/, rag/)
- `app/tools/hiring_tools.py` — tool definitions that query recruiting_db directly (separate async session)
- Configurable LLM provider per workflow: OpenAI (default), Anthropic, Google

### svc-workflows (DAG Engine)

- Workflows are JSON definitions with `nodes[]` and `edges[]` arrays
- Execution: validate → topological sort (Kahn's) → parallel batch execution via `asyncio.gather`
- 19 built-in node types registered in `NODE_REGISTRY` (triggers, search, AI, processing, action)
- Custom user-defined nodes with dynamic Python code execution
- Only leaf nodes persist leads to `scraped_leads` table

### Frontend (React SPA)

- **Stack**: React 18 + TypeScript + Vite (SWC) + Tailwind CSS + shadcn/ui
- **Routing**: React Router v6 with role-based guards (ProtectedRoute, AdminRoute, HiringRoute, HRRoute, InterviewerRoute, CandidateRoute)
- **State**: TanStack React Query (30s stale time, single retry, no refetch on focus)
- **API**: Centralized client in `utils/api.ts` with auto token refresh on 401
- **Auth**: JWT stored in localStorage, role-based redirects (HomeRedirect routes by role)
- **Theme**: Light/dark mode + 6 accent colors via CSS custom properties, class-based dark mode
- **UI components**: shadcn/ui primitives in `components/ui/`, custom components alongside
- **Path alias**: `@` → `src/` (configured in vite.config.ts and tsconfig.json)
- **TypeScript**: `strictNullChecks: false`, `noImplicitAny: false` — lenient TS config
- **Key libraries**: @xyflow/react (workflow builder), recharts (charts), framer-motion (animations), @hello-pangea/dnd (drag-and-drop), @react-three/fiber (3D AI avatar), monaco-editor (code editor)

### Real-Time Events

svc-recruiting publishes to Redis Pub/Sub → svc-mqtt bridges to Mosquitto MQTT → browser clients subscribe via WebSocket. Topics: `intesa/user/{id}/events`, `intesa/broadcast/events`.

### Auth & RBAC

Roles: `admin`, `hr`, `hiring_manager`, `interviewer`, `candidate`. JWT access tokens (15min) + refresh tokens (DB-stored, revocable). Rate limiting on auth endpoints (5/min login, 3/min signup).

## Conventions

- **Null-safe score handling**: Use `(x.get("score") or 0)` not `x.get("score", 0)` — keys may exist with `None` from LLM output
- **SSRF prevention**: All user-provided URLs pass through `is_safe_url()` before fetching
- **No `.format()` on user templates**: Use `.replace()` to prevent format string injection
- **Internal service calls**: Use `X-Internal-Key` header when calling between services
- **Background execution**: Workflow runs and AI tasks execute in FastAPI `BackgroundTasks` with their own `AsyncSessionLocal`
- **DB session safety**: `asyncio.Lock` serializes DB operations during parallel workflow node execution
- **LLM JSON parsing**: Use `safe_parse_json()` from utils which strips markdown fences before parsing
