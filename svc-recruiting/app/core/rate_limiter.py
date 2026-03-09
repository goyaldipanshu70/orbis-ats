"""Simple in-memory rate limiter middleware."""
import time
from collections import defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Config
RATE_LIMIT = 100  # requests per window
WINDOW_SECONDS = 60

# Protected paths (AI-heavy endpoints)
RATE_LIMITED_PATHS = {
    "/api/applications/parse-resume",
    "/api/candidates/upload",
    "/api/candidates/upload-multiple",
}

_requests: dict[str, list[float]] = defaultdict(list)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only rate-limit specific paths
        path = request.url.path
        if not any(path.startswith(p) for p in RATE_LIMITED_PATHS):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window_start = now - WINDOW_SECONDS

        # Clean old entries
        _requests[client_ip] = [t for t in _requests[client_ip] if t > window_start]

        if len(_requests[client_ip]) >= RATE_LIMIT:
            return Response(
                content='{"detail": "Too many requests. Please try again later."}',
                status_code=429,
                media_type="application/json",
            )

        _requests[client_ip].append(now)
        return await call_next(request)
