from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.postgres import init_db
from app.core.http_client import init_clients, close_clients
from app.routers import agent, resume, interview, rag, executions, leads


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_clients()
    yield
    await close_clients()


app = FastAPI(title="AI Orchestrator", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent.router, prefix="/api/orchestrator/agent", tags=["Hiring Agent"])
app.include_router(resume.router, prefix="/api/orchestrator/resume", tags=["Resume Scoring"])
app.include_router(interview.router, prefix="/api/orchestrator/interview", tags=["Interview Eval"])
app.include_router(rag.router, prefix="/api/orchestrator/rag", tags=["RAG"])
app.include_router(executions.router, prefix="/api/orchestrator/executions", tags=["Executions"])
app.include_router(leads.router, prefix="/api/orchestrator/leads", tags=["Lead Generation"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-orchestrator"}
