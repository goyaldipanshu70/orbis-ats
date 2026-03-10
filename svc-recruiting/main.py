from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.v1 import (
    routes_job, routes_candidate, routes_interview, routes_dashboard,
    routes_internal, routes_hiring_agent, routes_talent_pool, routes_careers,
    routes_applications, routes_screening, routes_interview_schedule,
    routes_offer, routes_analytics, routes_ai_jobs, routes_profile,
    routes_interviewer, routes_referral, routes_job_board, routes_outreach,
    routes_ai_tools, routes_scorecard, routes_export, routes_compliance,
    routes_pipeline_config, routes_approval, routes_events,
    routes_ai_interview, routes_linkedin, routes_documents,
    routes_cost, routes_job_request, routes_jd_template, routes_portal, routes_leads,
    routes_inbox_capture, routes_notifications,
)
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.postgres import init_db
from app.core.http_client import init_http_client, close_http_client

logger = setup_logging("svc-recruiting")
from app.services.ai_worker import start_worker, stop_worker
from app.services.notification_service import start_notification_worker, stop_notification_worker
from app.services.pending_email_service import start_pending_email_worker, stop_pending_email_worker
from app.services.event_bus import init_event_bus, close_event_bus
from app.core.rate_limiter import RateLimitMiddleware
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_http_client()
    await init_event_bus()
    await start_worker()
    await start_notification_worker()
    await start_pending_email_worker()
    # Pre-warm dashboard cache so first request is fast
    try:
        from app.db.postgres import AsyncSessionLocal
        from app.services.dashboard_service import get_dashboard_statistics_fixed
        async with AsyncSessionLocal() as db:
            await get_dashboard_statistics_fixed(db, user_id="system", user_role="admin")
        logger.info("Dashboard cache pre-warmed")
    except Exception as e:
        logger.warning(f"Dashboard pre-warm failed (non-fatal): {e}")
    yield
    await stop_worker()
    await stop_notification_worker()
    await stop_pending_email_worker()
    await close_event_bus()
    await close_http_client()


app = FastAPI(
    title="Recruiting Service",
    description="Job descriptions, candidates, interviews, and dashboard statistics",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.UPLOAD_BASE, exist_ok=True)
app.mount("/files", StaticFiles(directory=settings.UPLOAD_BASE), name="files")

app.include_router(routes_job.router, prefix="/api/job")
app.include_router(routes_candidate.router, prefix="/api/candidates")
app.include_router(routes_interview.router, prefix="/api/interview")
app.include_router(routes_dashboard.router, prefix="/api/dashboard")
app.include_router(routes_internal.router)
app.include_router(routes_hiring_agent.router, prefix="/api/hiring-agent")
app.include_router(routes_talent_pool.router, prefix="/api/talent-pool")
app.include_router(routes_careers.router, prefix="/api/careers")
app.include_router(routes_applications.router, prefix="/api/applications")
app.include_router(routes_screening.router, prefix="/api")
app.include_router(routes_interview_schedule.router, prefix="/api/interview")
app.include_router(routes_offer.job_offers_router, prefix="/api/job")
app.include_router(routes_offer.offers_router, prefix="/api/offers")
app.include_router(routes_analytics.router, prefix="/api/dashboard")
app.include_router(routes_ai_jobs.router, prefix="/api/ai-jobs")
app.include_router(routes_profile.router, prefix="/api/profiles")
app.include_router(routes_interviewer.router, prefix="/api/interviewers", tags=["Interviewers"])
app.include_router(routes_referral.router, prefix="/api/referrals", tags=["Referrals"])
app.include_router(routes_job_board.router, prefix="/api/job-boards", tags=["Job Boards"])
app.include_router(routes_outreach.router, prefix="/api/outreach", tags=["Outreach"])
app.include_router(routes_ai_tools.router, prefix="/api/ai-tools", tags=["AI Tools"])
app.include_router(routes_scorecard.router, prefix="/api/scorecard", tags=["Scorecard"])
app.include_router(routes_export.router, prefix="/api/export", tags=["Export"])
app.include_router(routes_compliance.router, prefix="/api/compliance", tags=["Compliance"])
app.include_router(routes_pipeline_config.router, prefix="/api/pipeline-config", tags=["Pipeline Config"])
app.include_router(routes_approval.router, prefix="/api/approvals", tags=["Approvals"])
app.include_router(routes_events.router, prefix="/api/events", tags=["Events"])
app.include_router(routes_ai_interview.router, prefix="/api/ai-interview", tags=["AI Interview"])
app.include_router(routes_linkedin.router, prefix="/api/linkedin", tags=["LinkedIn"])
app.include_router(routes_documents.router, prefix="/api/candidates", tags=["Documents"])
app.include_router(routes_cost.router, prefix="/api/job", tags=["Costs"])
app.include_router(routes_job_request.router, prefix="/api/job-requests", tags=["Job Requests"])
app.include_router(routes_jd_template.router, prefix="/api/jd-templates", tags=["JD Templates"])
app.include_router(routes_portal.router, prefix="/api/portals", tags=["Portals"])
app.include_router(routes_leads.router, prefix="/api/leads", tags=["Leads"])
app.include_router(routes_inbox_capture.router, prefix="/api/inbox-capture", tags=["Inbox Capture"])
app.include_router(routes_notifications.router, prefix="/api/notifications", tags=["Notifications"])


@app.get("/")
async def root():
    return {"message": "Recruiting Service is running"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "svc-recruiting"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
