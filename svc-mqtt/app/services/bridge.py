"""Redis Pub/Sub -> MQTT bridge.

Subscribes to Redis channels published by svc-recruiting's event_bus
and forwards them to MQTT topics for WebSocket-connected browser clients.

Redis channels:
  events:user:{id}  -> MQTT: intesa/user/{id}/events
  events:broadcast   -> MQTT: intesa/broadcast/events
"""
import asyncio
import json
import logging
import re

import redis.asyncio as aioredis
from aiomqtt import Client as MQTTClient

from app.core.config import settings

logger = logging.getLogger("svc-mqtt")

# Pattern to extract user ID from Redis channel name
_USER_CHANNEL_RE = re.compile(r"^events:user:(\d+)$")


def channel_to_topic(channel: str) -> str:
    """Convert a Redis channel name to an MQTT topic.

    events:user:5      -> intesa/user/5/events
    events:broadcast   -> intesa/broadcast/events
    """
    prefix = settings.MQTT_TOPIC_PREFIX
    m = _USER_CHANNEL_RE.match(channel)
    if m:
        return f"{prefix}/user/{m.group(1)}/events"
    if channel == "events:broadcast":
        return f"{prefix}/broadcast/events"
    # Fallback: generic topic
    return f"{prefix}/misc/{channel.replace(':', '/')}"


async def redis_to_mqtt_bridge():
    """Main bridge loop — subscribe to Redis, republish to MQTT."""
    logger.info(
        "Starting Redis->MQTT bridge  redis=%s  mqtt=%s:%s",
        settings.REDIS_URL,
        settings.MQTT_BROKER_HOST,
        settings.MQTT_BROKER_PORT,
    )

    redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    async with MQTTClient(
        hostname=settings.MQTT_BROKER_HOST,
        port=settings.MQTT_BROKER_PORT,
    ) as mqtt:
        pubsub = redis.pubsub()
        await pubsub.psubscribe("events:user:*", "events:broadcast")
        logger.info("Subscribed to Redis channels, forwarding to MQTT")

        async for message in pubsub.listen():
            if message["type"] not in ("pmessage", "message"):
                continue
            try:
                channel = message.get("channel", "")
                data = message.get("data", "")
                topic = channel_to_topic(channel)
                await mqtt.publish(topic, payload=data, qos=0)
                logger.debug("Forwarded %s -> %s", channel, topic)
            except Exception as e:
                logger.warning("Bridge forward error: %s", e)
