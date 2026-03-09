from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.v1 import routes_admin, routes_settings, routes_audit, routes_templates, routes_announcements, routes_onboarding
from app.core.logging_config import setup_logging
from app.db.postgres import init_db

logger = setup_logging("svc-admin")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Admin Service",
    description="User management, audit logs, and offer templates",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_admin.router, prefix="/api/admin")
app.include_router(routes_audit.router, prefix="/api/admin")
app.include_router(routes_templates.router, prefix="/api/admin/templates")
app.include_router(routes_announcements.router, prefix="/api/admin/announcements")
app.include_router(routes_onboarding.router, prefix="/api/admin/onboarding")
app.include_router(routes_settings.router, prefix="/api/settings")


@app.get("/")
async def root():
    return {"message": "Admin Service is running"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "svc-admin"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
