from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.postgres import init_db
from app.api.v1 import routes_workflow, routes_execution

import logging

logger = logging.getLogger("svc-workflows")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("svc-workflows started")
    yield
    logger.info("svc-workflows shutting down")


app = FastAPI(
    title="Workflow Service",
    description="AI Workflow Builder — visual DAG execution engine for talent sourcing pipelines",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_workflow.router, prefix="/api/workflows", tags=["Workflows"])
app.include_router(routes_execution.router, prefix="/api/workflows", tags=["Execution"])


@app.get("/")
async def root():
    return {"message": "Workflow Service is running"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "svc-workflows"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8015)
