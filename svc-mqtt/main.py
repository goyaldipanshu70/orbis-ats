"""svc-mqtt — Redis-to-MQTT bridge service.

Bridges Redis Pub/Sub events from svc-recruiting to MQTT topics
that browser clients consume via WebSocket (port 9001 on Mosquitto).
"""
import asyncio
import logging

from fastapi import FastAPI

from app.services.bridge import redis_to_mqtt_bridge

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("svc-mqtt")

app = FastAPI(title="svc-mqtt", version="1.0.0")

_bridge_task: asyncio.Task | None = None


@app.on_event("startup")
async def startup():
    global _bridge_task
    _bridge_task = asyncio.create_task(_run_bridge())
    logger.info("svc-mqtt started on port 8020")


async def _run_bridge():
    """Run the bridge with reconnection logic."""
    while True:
        try:
            await redis_to_mqtt_bridge()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Bridge crashed, restarting in 5s: %s", e)
            await asyncio.sleep(5)


@app.on_event("shutdown")
async def shutdown():
    global _bridge_task
    if _bridge_task:
        _bridge_task.cancel()
        try:
            await _bridge_task
        except asyncio.CancelledError:
            pass
    logger.info("svc-mqtt stopped")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "svc-mqtt"}
