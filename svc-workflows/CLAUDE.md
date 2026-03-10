# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the service (default port 8015)
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8015 --reload

# Install dependencies
pip install -r requirements.txt

# Type/syntax check all Python files
python3 -m py_compile main.py && find app -name '*.py' -exec python3 -m py_compile {} +

# Import check (expected: langchain_anthropic errors are OK — runtime dependency)
python3 -c "
import importlib, pkgutil, sys; sys.path.insert(0, '.')
for _, mod, _ in pkgutil.walk_packages(['app'], 'app.'):
    try: importlib.import_module(mod)
    except Exception as e: print(f'{mod}: {e}')
"

# Frontend TypeScript check (from ui/ directory)
cd ../ui && npx tsc --noEmit --pretty
```

No test suite exists yet. No linter configuration is set up.

## Architecture

**svc-workflows** is a FastAPI microservice that provides a visual DAG (Directed Acyclic Graph) execution engine for talent sourcing pipelines in the Orbis ATS platform. It runs on port 8015 and is routed through svc-gateway at `/api/workflows`.

### Layer Structure

```
API Routes (routes_workflow.py, routes_execution.py)
    ↓
Services (workflow_service.py, execution_engine.py)
    ↓
Nodes (19 pluggable node types in app/nodes/)
    ↓
Database (async SQLAlchemy + PostgreSQL)
```

### DAG Execution Engine (`app/services/execution_engine.py`)

The core of the service. Workflows are JSON definitions with `nodes` and `edges` arrays.

1. **Validation** — checks node types exist, detects cycles via DFS
2. **Topological sort** — Kahn's algorithm produces batches of independent nodes
3. **Parallel execution** — each batch runs via `asyncio.gather`, nodes within a batch execute concurrently
4. **DB safety** — `asyncio.Lock` serializes all DB operations during parallel node execution
5. **Lead persistence** — only leaf nodes (no outgoing edges) persist leads to `scraped_leads` table to avoid duplicates
6. **Output storage** — `run.output_data` and `node_run.output_data` store metadata summaries (not full lead arrays) to keep DB manageable

### Node Registry Pattern (`app/nodes/__init__.py`)

All 19 node types register in `NODE_REGISTRY` dict. Each node extends `BaseNode` with:
- `node_type`, `category`, `display_name`, `description`, `config_schema` (class-level)
- `async execute(input_data) -> dict` — receives upstream outputs keyed by source node ID
- `_collect_leads(input_data)` — helper that gathers leads from all upstream nodes with null safety

Categories: `trigger` (2), `search` (6), `ai` (3), `processing` (4), `action` (3).

### Auth & RBAC (`app/core/security.py`)

JWT-only validation (no DB lookup). Two guards:
- `require_employee` — blocks candidates; used on read/run endpoints
- `require_hr_or_admin` — used on create/update/delete endpoints

### LLM Provider (`app/core/llm_provider.py`)

LangChain abstraction supporting OpenAI, Anthropic, and Google. AI nodes call `get_llm()` and use `safe_parse_json()` from `app/utils/retry.py` to handle LLM JSON output with markdown fence stripping.

### Key DB Models (`app/db/models.py`)

- `Workflow` — definition stored as JSON, soft-deleted via `deleted_at`
- `WorkflowRun` — execution instance with status tracking
- `WorkflowNodeRun` — per-node execution record
- `ScrapedLead` — candidate data discovered by workflows

### Frontend Integration

The React frontend (in `../ui/src/pages/Workflow*.tsx`) uses React Flow (`@xyflow/react`) for the visual DAG builder. Types are in `../ui/src/types/workflow.ts`. Key nullable fields: `started_at`, `completed_at`, `execution_time_ms`, `input_data`, `output_data`, `node_runs`, `skills` on ScrapedLead.

## Patterns & Conventions

- **Null-safe score handling**: Always use `(x.get("score") or 0)` not `x.get("score", 0)` — the key may exist with value `None` from LLM output
- **SSRF prevention**: All user-provided URLs pass through `is_safe_url()` in `app/utils/retry.py` before fetching
- **No `.format()` on user templates**: Use `.replace()` for string templating to prevent format string injection
- **Background execution**: Workflow runs execute in FastAPI `BackgroundTasks` with their own DB session (`AsyncSessionLocal`)
- **Graceful shutdown**: `main.py` lifespan marks orphaned running/pending runs as failed on shutdown
- **Internal service calls**: Use `X-Internal-Key` header when calling svc-recruiting endpoints

## Configuration (`app/core/config.py`)

Key execution limits: `MAX_CONCURRENT_RUNS=5`, `NODE_TIMEOUT_SECONDS=120`, `MAX_WORKFLOW_NODES=50`, `MAX_LEADS_PER_NODE=500`. All configurable via environment variables.
