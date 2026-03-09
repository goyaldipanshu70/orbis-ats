"""Simple in-memory TTL cache for dashboard responses."""
import time
from typing import Any, Optional

_cache: dict[str, tuple[Any, float]] = {}
DEFAULT_TTL = 60  # seconds


def cache_get(key: str) -> Optional[Any]:
    """Get a cached value. Returns None if expired or missing."""
    if key not in _cache:
        return None
    value, expires_at = _cache[key]
    if time.time() > expires_at:
        del _cache[key]
        return None
    return value


def cache_set(key: str, value: Any, ttl: int = DEFAULT_TTL):
    """Cache a value with TTL in seconds."""
    _cache[key] = (value, time.time() + ttl)


def cache_invalidate(key: str):
    """Remove a specific cache entry."""
    _cache.pop(key, None)


def cache_clear():
    """Clear the entire cache."""
    _cache.clear()
