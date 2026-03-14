import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)

from datetime import datetime
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from sqlalchemy import update, text
from app.db.postgres import init_db, AsyncSessionLocal
from app.db.models import WorkflowRun
from app.api.v1 import routes_workflow, routes_execution, routes_custom_nodes
from app.core.config import settings

logger = logging.getLogger("svc-workflows")

MAX_REQUEST_BODY = 2 * 1024 * 1024  # 2 MB


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("svc-workflows started")
    yield
    # Graceful shutdown: mark orphaned running/pending runs as failed
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                update(WorkflowRun)
                .where(WorkflowRun.status.in_(["pending", "running"]))
                .values(
                    status="failed",
                    error_message="Service shutdown — run interrupted",
                    completed_at=datetime.utcnow(),
                )
                .execution_options(synchronize_session=False)
            )
            await db.commit()
            if result.rowcount:
                logger.warning("Marked %d orphaned runs as failed during shutdown", result.rowcount)
    except Exception as e:
        logger.error("Failed to clean up orphaned runs: %s", e)
    logger.info("svc-workflows shutting down")


app = FastAPI(
    title="Workflow Service",
    description="AI Workflow Builder — visual DAG execution engine for talent sourcing pipelines",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

# CORS — restrict to known frontend origin
allowed_origins = [
    settings.FRONTEND_URL,
    "http://localhost:80",
    "http://localhost:5173",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """Reject oversized request bodies."""
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_BODY:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={"detail": "Request body too large"},
                )
        except (ValueError, TypeError):
            pass
    return await call_next(request)


app.include_router(routes_custom_nodes.router, prefix="/api/workflows/custom-nodes", tags=["Custom Nodes"])
app.include_router(routes_workflow.router, prefix="/api/workflows", tags=["Workflows"])
app.include_router(routes_execution.router, prefix="/api/workflows", tags=["Execution"])


@app.get("/")
async def root():
    return {"message": "Workflow Service is running"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "svc-workflows"}


if __name__ == "__main__":
    import os
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8015")))
