"""SSE endpoint for real-time events via Redis Pub/Sub."""
import asyncio
import json
import logging

from fastapi import APIRouter, Query, Request, HTTPException, status
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt

from app.core.config import settings
from app.services.event_bus import subscribe_user_events

logger = logging.getLogger("svc-recruiting")
router = APIRouter()

HEARTBEAT_INTERVAL = 30  # seconds


def _decode_query_token(token: str) -> dict:
    """Decode JWT from query param (EventSource can't send headers)."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


@router.get("/stream")
async def event_stream(request: Request, token: str = Query(...)):
    """SSE endpoint — streams real-time events to the authenticated user."""
    user = _decode_query_token(token)
    user_id = user["sub"]

    async def generate():
        queue: asyncio.Queue[str] = asyncio.Queue()

        # Task that reads from Redis and pushes to queue
        async def redis_reader():
            try:
                async for event_type, data in subscribe_user_events(user_id):
                    sse = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
                    await queue.put(sse)
            except asyncio.CancelledError:
                pass

        # Task that pushes heartbeats
        async def heartbeat():
            try:
                while True:
                    await asyncio.sleep(HEARTBEAT_INTERVAL)
                    await queue.put(": heartbeat\n\n")
            except asyncio.CancelledError:
                pass

        reader_task = asyncio.create_task(redis_reader())
        heartbeat_task = asyncio.create_task(heartbeat())

        try:
            # Send initial connected event
            yield f"event: connected\ndata: {json.dumps({'user_id': user_id})}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield msg
                except asyncio.TimeoutError:
                    continue
        finally:
            reader_task.cancel()
            heartbeat_task.cancel()
            await asyncio.gather(reader_task, heartbeat_task, return_exceptions=True)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
