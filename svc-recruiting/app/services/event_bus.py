"""Redis Pub/Sub event bus for real-time SSE delivery."""
import asyncio
import json
import logging
from typing import AsyncGenerator, Optional, Union

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger("svc-recruiting")

_publisher: Optional[aioredis.Redis] = None


async def init_event_bus():
    """Create the shared Redis publisher connection."""
    global _publisher
    try:
        _publisher = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await _publisher.ping()
        logger.info("Event bus connected to Redis at %s", settings.REDIS_URL)
    except Exception as e:
        logger.warning("Event bus: Redis unavailable (%s) — events will be silently dropped", e)
        _publisher = None


async def close_event_bus():
    """Close the shared publisher connection."""
    global _publisher
    if _publisher:
        await _publisher.aclose()
        _publisher = None
        logger.info("Event bus closed")


_PUBLISH_TIMEOUT = 2.0  # seconds — never block a request longer than this


async def publish_user_event(user_id: Union[int, str], event_type: str, data: dict):
    """Publish an event to a user-specific channel."""
    if not _publisher:
        return
    try:
        payload = json.dumps({"event": event_type, "data": data})
        await asyncio.wait_for(_publisher.publish(f"events:user:{user_id}", payload), timeout=_PUBLISH_TIMEOUT)
    except Exception as e:
        logger.warning("Event bus publish failed: %s", e)


async def publish_broadcast_event(event_type: str, data: dict):
    """Publish an event to the broadcast channel (all connected HR users)."""
    if not _publisher:
        return
    try:
        payload = json.dumps({"event": event_type, "data": data})
        await asyncio.wait_for(_publisher.publish("events:broadcast", payload), timeout=_PUBLISH_TIMEOUT)
    except Exception as e:
        logger.warning("Event bus broadcast failed: %s", e)


async def subscribe_user_events(user_id: Union[int, str]) -> AsyncGenerator[tuple, None]:
    """Subscribe to user-specific + broadcast channels. Yields (event_type, data) tuples.

    Each caller gets its own Redis connection (required by Redis pub/sub).
    """
    sub_conn: Optional[aioredis.Redis] = None
    try:
        sub_conn = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = sub_conn.pubsub()
        await pubsub.subscribe(f"events:user:{user_id}", "events:broadcast")

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                parsed = json.loads(message["data"])
                yield parsed["event"], parsed["data"]
            except (json.JSONDecodeError, KeyError):
                continue
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.warning("Event bus subscription error: %s", e)
    finally:
        if sub_conn:
            try:
                await sub_conn.aclose()
            except Exception:
                pass
