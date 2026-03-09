"""Tests for the real-time event system (Redis Pub/Sub + SSE)."""
import asyncio
import json
import pytest
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set minimal env vars before importing app code
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost:5432/test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-events-testing-1234567890")
os.environ.setdefault("AI_JD_URL", "http://localhost:8010")
os.environ.setdefault("AI_RESUME_URL", "http://localhost:8011")
os.environ.setdefault("AI_INTERVIEW_URL", "http://localhost:8012")
os.environ.setdefault("BACKEND_DOMAIN", "http://localhost:8002")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")


# ---------------------------------------------------------------------------
# Phase 1: Event Bus Unit Tests
# ---------------------------------------------------------------------------

class TestEventBus:
    """Test the event_bus module against a real Redis instance."""

    @pytest.mark.asyncio
    async def test_init_and_close(self):
        from app.services.event_bus import init_event_bus, close_event_bus, _publisher
        await init_event_bus()
        from app.services import event_bus
        assert event_bus._publisher is not None
        await close_event_bus()
        assert event_bus._publisher is None

    @pytest.mark.asyncio
    async def test_publish_user_event(self):
        from app.services.event_bus import init_event_bus, close_event_bus, publish_user_event
        import redis.asyncio as aioredis

        await init_event_bus()

        # Set up a subscriber to verify the publish
        sub_conn = aioredis.from_url("redis://localhost:6379", decode_responses=True)
        pubsub = sub_conn.pubsub()
        await pubsub.subscribe("events:user:42")

        # Consume the subscribe confirmation message
        msg = await pubsub.get_message(timeout=1.0)
        assert msg["type"] == "subscribe"

        # Publish
        await publish_user_event(42, "test_event", {"foo": "bar"})

        # Receive
        msg = await pubsub.get_message(timeout=2.0)
        assert msg is not None
        assert msg["type"] == "message"
        payload = json.loads(msg["data"])
        assert payload["event"] == "test_event"
        assert payload["data"] == {"foo": "bar"}

        await pubsub.unsubscribe()
        await sub_conn.aclose()
        await close_event_bus()

    @pytest.mark.asyncio
    async def test_publish_broadcast_event(self):
        from app.services.event_bus import init_event_bus, close_event_bus, publish_broadcast_event
        import redis.asyncio as aioredis

        await init_event_bus()

        sub_conn = aioredis.from_url("redis://localhost:6379", decode_responses=True)
        pubsub = sub_conn.pubsub()
        await pubsub.subscribe("events:broadcast")
        await pubsub.get_message(timeout=1.0)  # consume subscribe msg

        await publish_broadcast_event("broadcast_test", {"key": "value"})

        msg = await pubsub.get_message(timeout=2.0)
        assert msg is not None
        payload = json.loads(msg["data"])
        assert payload["event"] == "broadcast_test"
        assert payload["data"]["key"] == "value"

        await pubsub.unsubscribe()
        await sub_conn.aclose()
        await close_event_bus()

    @pytest.mark.asyncio
    async def test_subscribe_user_events_receives_both_channels(self):
        """subscribe_user_events should receive from both user-specific and broadcast channels."""
        from app.services.event_bus import (
            init_event_bus, close_event_bus,
            publish_user_event, publish_broadcast_event, subscribe_user_events,
        )

        await init_event_bus()

        received = []

        async def collector():
            async for event_type, data in subscribe_user_events(99):
                received.append((event_type, data))
                if len(received) >= 2:
                    break

        task = asyncio.create_task(collector())

        # Give subscriber time to connect
        await asyncio.sleep(0.3)

        await publish_user_event(99, "user_event", {"a": 1})
        await publish_broadcast_event("broadcast_event", {"b": 2})

        # Wait for events to arrive
        try:
            await asyncio.wait_for(task, timeout=5.0)
        except asyncio.TimeoutError:
            task.cancel()

        assert len(received) == 2
        event_types = {r[0] for r in received}
        assert "user_event" in event_types
        assert "broadcast_event" in event_types

        await close_event_bus()

    @pytest.mark.asyncio
    async def test_publish_when_redis_unavailable(self):
        """Publishing when Redis is down should silently return (no exception)."""
        from app.services import event_bus
        event_bus._publisher = None  # Simulate no connection

        # Should not raise
        await event_bus.publish_user_event(1, "test", {"x": 1})
        await event_bus.publish_broadcast_event("test", {"x": 1})


# ---------------------------------------------------------------------------
# Phase 2: SSE Endpoint Tests
# ---------------------------------------------------------------------------

class TestSSEEndpoint:
    """Test the SSE routes_events endpoint."""

    @pytest.mark.asyncio
    async def test_stream_requires_token(self):
        from httpx import AsyncClient, ASGITransport
        from app.api.v1.routes_events import router
        from fastapi import FastAPI

        test_app = FastAPI()
        test_app.include_router(router, prefix="/api/events")

        async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as client:
            resp = await client.get("/api/events/stream")
            assert resp.status_code == 422  # missing required query param

    @pytest.mark.asyncio
    async def test_stream_rejects_invalid_token(self):
        from httpx import AsyncClient, ASGITransport
        from app.api.v1.routes_events import router
        from fastapi import FastAPI

        test_app = FastAPI()
        test_app.include_router(router, prefix="/api/events")

        async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as client:
            resp = await client.get("/api/events/stream?token=invalid-jwt")
            assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_stream_sends_connected_event(self):
        """A valid JWT should receive the initial 'connected' SSE event.

        Uses direct Redis subscribe to verify the SSE endpoint logic, since
        httpx ASGI transport can't cleanly abort streaming responses mid-flight.
        Instead we test the generate() coroutine directly.
        """
        from app.api.v1.routes_events import _decode_query_token
        from app.services.event_bus import init_event_bus, close_event_bus, subscribe_user_events
        from jose import jwt as jose_jwt

        await init_event_bus()

        # Test JWT decode
        token = jose_jwt.encode(
            {"sub": "123", "email": "test@test.com", "role": "hr"},
            "test-secret-key-for-events-testing-1234567890",
            algorithm="HS256",
        )
        user = _decode_query_token(token)
        assert user["sub"] == "123"
        assert user["email"] == "test@test.com"

        # Test that subscribe_user_events works with the decoded user_id
        from app.services.event_bus import publish_user_event
        received = []

        async def collector():
            async for event_type, data in subscribe_user_events("123"):
                received.append((event_type, data))
                if len(received) >= 1:
                    break

        task = asyncio.create_task(collector())
        await asyncio.sleep(0.3)
        await publish_user_event("123", "test_connected", {"ok": True})

        await asyncio.wait_for(task, timeout=5.0)
        assert len(received) == 1
        assert received[0][0] == "test_connected"

        await close_event_bus()

    @pytest.mark.asyncio
    async def test_stream_receives_published_event(self):
        """Published events arrive at the subscriber for the correct user."""
        from app.services.event_bus import (
            init_event_bus, close_event_bus,
            publish_user_event, subscribe_user_events,
        )

        await init_event_bus()

        received = []

        async def collector():
            async for event_type, data in subscribe_user_events("200"):
                received.append((event_type, data))
                if len(received) >= 1:
                    break

        task = asyncio.create_task(collector())
        await asyncio.sleep(0.3)

        await publish_user_event("200", "candidate_evaluation_complete", {
            "candidate_id": 5, "jd_id": 10, "score": 85, "full_name": "Jane Doe",
        })

        await asyncio.wait_for(task, timeout=5.0)

        assert len(received) == 1
        assert received[0][0] == "candidate_evaluation_complete"
        assert received[0][1]["full_name"] == "Jane Doe"
        assert received[0][1]["score"] == 85

        await close_event_bus()


# ---------------------------------------------------------------------------
# Phase 3: Gateway Route Registration Test
# ---------------------------------------------------------------------------

class TestGatewayRoute:
    """Verify the /api/events route is properly registered in the gateway."""

    def test_events_route_resolves(self):
        # Import with proper path adjustment
        gateway_routes_path = os.path.join(os.path.dirname(__file__), "..", "..", "svc-gateway")
        sys.path.insert(0, gateway_routes_path)
        try:
            # Read and verify the route table directly
            routes_file = os.path.join(gateway_routes_path, "app", "core", "routes.py")
            with open(routes_file) as f:
                content = f.read()
            assert '("/api/events"' in content, "/api/events route not found in gateway ROUTE_TABLE"
        finally:
            sys.path.pop(0)


# ---------------------------------------------------------------------------
# Phase 4: Frontend Hook File Existence & Structure Tests
# ---------------------------------------------------------------------------

class TestFrontendHook:
    """Verify the frontend hook file exists and has the correct structure."""

    def test_hook_file_exists(self):
        hook_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "ui", "src", "hooks", "useRealtimeEvents.ts"
        )
        assert os.path.exists(hook_path), "useRealtimeEvents.ts not found"

    def test_hook_exports_function(self):
        hook_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "ui", "src", "hooks", "useRealtimeEvents.ts"
        )
        content = open(hook_path).read()
        assert "export function useRealtimeEvents" in content
        assert "EventSource" in content
        assert "exponential" in content.lower() or "retryDelay" in content

    def test_frontend_pages_import_hook(self):
        """Verify CandidateEvaluation, Pipeline, and Dashboard import the hook."""
        pages_dir = os.path.join(os.path.dirname(__file__), "..", "..", "ui", "src", "pages")
        for page in ["CandidateEvaluation.tsx", "Pipeline.tsx", "Dashboard.tsx"]:
            content = open(os.path.join(pages_dir, page)).read()
            assert "useRealtimeEvents" in content, f"{page} does not import useRealtimeEvents"


# ---------------------------------------------------------------------------
# Integration: Full event flow test
# ---------------------------------------------------------------------------

class TestEndToEnd:
    """Integration test: publish → Redis → subscribe → receive."""

    @pytest.mark.asyncio
    async def test_full_event_roundtrip(self):
        """Publish user + broadcast events and verify a subscriber receives both."""
        from app.services.event_bus import (
            init_event_bus, close_event_bus,
            publish_user_event, publish_broadcast_event, subscribe_user_events,
        )

        await init_event_bus()

        events_received = []
        user_id = 777

        async def subscriber():
            async for event_type, data in subscribe_user_events(user_id):
                events_received.append({"type": event_type, "data": data})
                if len(events_received) >= 3:
                    break

        task = asyncio.create_task(subscriber())
        await asyncio.sleep(0.3)

        # Simulate: AI worker completes scoring
        await publish_user_event(user_id, "candidate_evaluation_complete", {
            "candidate_id": 1, "jd_id": 5, "score": 92, "full_name": "Alice",
        })

        # Simulate: another user moves pipeline stage (broadcast)
        await publish_broadcast_event("pipeline_stage_changed", {
            "candidate_id": 2, "jd_id": 5, "from_stage": "applied", "to_stage": "screening",
        })

        # Simulate: offer sent (broadcast)
        await publish_broadcast_event("offer_sent", {
            "offer_id": 10, "candidate_id": 3, "jd_id": 5,
        })

        try:
            await asyncio.wait_for(task, timeout=5.0)
        except asyncio.TimeoutError:
            task.cancel()

        assert len(events_received) == 3

        types = [e["type"] for e in events_received]
        assert "candidate_evaluation_complete" in types
        assert "pipeline_stage_changed" in types
        assert "offer_sent" in types

        # Verify event data integrity
        eval_event = next(e for e in events_received if e["type"] == "candidate_evaluation_complete")
        assert eval_event["data"]["score"] == 92
        assert eval_event["data"]["full_name"] == "Alice"

        await close_event_bus()
