from app.core.config import settings

# Route registry: URL prefix → backend service URL
# Order matters — longer prefixes are checked first
ROUTE_TABLE: list[tuple[str, str]] = [
    ("/api/auth", settings.AUTH_URL),
    ("/api/job", settings.RECRUITING_URL),
    ("/api/candidates", settings.RECRUITING_URL),
    ("/api/interview", settings.RECRUITING_URL),
    ("/api/dashboard", settings.RECRUITING_URL),
    ("/api/hiring-agent", settings.RECRUITING_URL),
    ("/api/talent-pool", settings.RECRUITING_URL),
    ("/api/profiles", settings.RECRUITING_URL),
    ("/api/careers", settings.RECRUITING_URL),
    ("/api/applications", settings.RECRUITING_URL),
    ("/api/offers", settings.RECRUITING_URL),
    ("/api/ai-jobs", settings.RECRUITING_URL),
    ("/api/orchestrator", settings.ORCHESTRATOR_URL),
    ("/api/interviewers", settings.RECRUITING_URL),
    ("/api/referrals", settings.RECRUITING_URL),
    ("/api/job-boards", settings.RECRUITING_URL),
    ("/api/outreach", settings.RECRUITING_URL),
    ("/api/ai-tools", settings.RECRUITING_URL),
    ("/api/scorecard", settings.RECRUITING_URL),
    ("/api/export", settings.RECRUITING_URL),
    ("/api/compliance", settings.RECRUITING_URL),
    ("/api/pipeline-config", settings.RECRUITING_URL),
    ("/api/approvals", settings.RECRUITING_URL),
    ("/api/events", settings.RECRUITING_URL),
    ("/api/ai-interview", settings.RECRUITING_URL),
    ("/api/linkedin", settings.RECRUITING_URL),
    ("/api/job-requests", settings.RECRUITING_URL),
    ("/api/jd-templates", settings.RECRUITING_URL),
    ("/api/portals", settings.RECRUITING_URL),
    ("/api/leads", settings.RECRUITING_URL),
    ("/api/inbox-capture", settings.RECRUITING_URL),
    ("/api/notifications", settings.RECRUITING_URL),
    ("/api/ai-cache", settings.RECRUITING_URL),
    ("/api/workflows", settings.WORKFLOWS_URL),
    ("/api/mqtt", settings.MQTT_URL),
    ("/api/admin", settings.ADMIN_URL),
    ("/api/settings", settings.ADMIN_URL),
    ("/files/", settings.RECRUITING_URL),
]


def resolve_backend(path: str) -> str | None:
    """Return the backend base URL for a given request path, or None if no match."""
    for prefix, backend_url in ROUTE_TABLE:
        if path.startswith(prefix):
            return backend_url
    return None
