import httpx
from app.core.config import settings


async def get_recruiting_stats() -> dict:
    """Fetch job and candidate counts from svc-recruiting internal endpoint."""
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.RECRUITING_INTERNAL_URL}/internal/stats",
            headers={"X-Internal-Key": settings.INTERNAL_API_KEY},
        )
        response.raise_for_status()
        return response.json()
