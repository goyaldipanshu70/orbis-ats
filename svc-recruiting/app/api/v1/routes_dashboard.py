from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user
from app.services.dashboard_service import get_dashboard_statistics_fixed
from app.core.cache import cache_get, cache_set

router = APIRouter()


@router.get("/stats")
async def dashboard_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        cache_key = f"dashboard_stats_{user['sub']}"
        cached = cache_get(cache_key)
        if cached:
            return cached
        stats = await get_dashboard_statistics_fixed(db, user["sub"], user.get("role", "recruiter"))
        cache_set(cache_key, stats, ttl=60)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard statistics: {e}")
