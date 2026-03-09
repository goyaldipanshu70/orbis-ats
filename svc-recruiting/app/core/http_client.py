from typing import Optional

import httpx

_ai_client: Optional[httpx.AsyncClient] = None


def get_ai_client() -> httpx.AsyncClient:
    """Return the shared httpx.AsyncClient for AI service calls."""
    if _ai_client is None:
        raise RuntimeError("HTTP client not initialized — call init_http_client() first")
    return _ai_client


async def init_http_client():
    global _ai_client
    _ai_client = httpx.AsyncClient(
        timeout=httpx.Timeout(timeout=300, connect=10),
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    )


async def close_http_client():
    global _ai_client
    if _ai_client:
        await _ai_client.aclose()
        _ai_client = None
