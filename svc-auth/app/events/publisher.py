import json
import logging
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

TOPICS = {
    "USER_PASSWORD_RESET": "admin_notifications/user_password_reset",
    "USER_CREATED": "admin_notifications/user_created",
    "USER_UPDATED": "admin_notifications/user_updated",
    "USER_DELETED": "admin_notifications/user_deleted",
    "SETTINGS_UPDATED": "system/settings_updated",
}


async def publish_event(topic_key: str, payload: dict):
    """Publish an event to Redis pub/sub."""
    topic = TOPICS.get(topic_key)
    if not topic:
        raise ValueError(f"Unknown topic key: {topic_key}")

    try:
        r = aioredis.from_url(settings.REDIS_URL)
        await r.publish(topic, json.dumps(payload))
        await r.aclose()
        logger.info(f"Event published: {topic} -> {json.dumps(payload)}")
    except Exception as e:
        logger.warning(
            f"Failed to publish event to Redis: {e}. "
            f"Event: {topic} -> {json.dumps(payload)}"
        )
