from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import asyncio
from app.api.v1 import routes_auth, routes_profile, routes_otp
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.logging_config import setup_logging
from app.db.postgres import init_db, AsyncSessionLocal
from app.db.seeder import seed_admin_user
import os

logger = setup_logging("svc-auth")

_cleanup_task = None


async def _otp_cleanup_loop():
    """Background task: clean up expired OTPs and pending signups every 5 min."""
    from app.services.otp_service import cleanup_expired_otps
    while True:
        try:
            await asyncio.sleep(300)
            async with AsyncSessionLocal() as db:
                await cleanup_expired_otps(db)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("OTP cleanup error: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _cleanup_task
    await init_db()
    async with AsyncSessionLocal() as db:
        try:
            await seed_admin_user(db)
        except Exception as e:
            logger.warning("Failed to seed admin user: %s", e)
    _cleanup_task = asyncio.create_task(_otp_cleanup_loop())
    yield
    _cleanup_task.cancel()
    try:
        await _cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Auth Service",
    description="Authentication, user registration, and Google OAuth",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET_KEY", "dev-session-secret")
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_auth.router, prefix="/api/auth")
app.include_router(routes_otp.router, prefix="/api/auth")
app.include_router(routes_profile.router, prefix="/api/auth")


@app.get("/")
async def root():
    return {"message": "Auth Service is running"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "svc-auth"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
