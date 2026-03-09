import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.core.logging_config import setup_logging
from app.core.routes import resolve_backend

logger = setup_logging("svc-gateway")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.client = httpx.AsyncClient(
        timeout=httpx.Timeout(60.0, connect=10.0),
        limits=httpx.Limits(max_connections=200, max_keepalive_connections=40),
        follow_redirects=False,
    )
    # Separate long-timeout client for streaming requests
    app.state.stream_client = httpx.AsyncClient(
        timeout=httpx.Timeout(300.0, connect=10.0),
        limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
        follow_redirects=False,
    )
    yield
    await app.state.client.aclose()
    await app.state.stream_client.aclose()


app = FastAPI(title="API Gateway", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "svc-gateway"}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    full_path = f"/{path}"
    backend_url = resolve_backend(full_path)

    if backend_url is None:
        return Response(content='{"detail":"Route not found"}', status_code=404, media_type="application/json")

    # Build target URL
    target = f"{backend_url}{full_path}"
    if request.url.query:
        target = f"{target}?{request.url.query}"

    # Forward headers (drop hop-by-hop headers so the backend sees clean request)
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)  # let httpx recompute

    # Read raw body (works for JSON, multipart, form data)
    body = await request.body()

    # Detect streaming requests (path ends with /stream)
    is_stream = full_path.rstrip("/").endswith("/stream")

    if is_stream:
        return await _proxy_stream(request, target, headers, body)

    client: httpx.AsyncClient = request.app.state.client

    try:
        resp = await client.request(
            method=request.method,
            url=target,
            headers=headers,
            content=body,
        )
    except httpx.ConnectError:
        logger.warning("Service unavailable: %s %s", request.method, target)
        return Response(
            content='{"detail":"Service unavailable"}',
            status_code=503,
            media_type="application/json",
        )
    except httpx.TimeoutException:
        logger.warning("Service timeout: %s %s", request.method, target)
        return Response(
            content='{"detail":"Service timeout"}',
            status_code=504,
            media_type="application/json",
        )

    # Forward response headers, skip hop-by-hop
    excluded = {"transfer-encoding", "connection", "keep-alive"}
    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded}

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
        media_type=resp.headers.get("content-type"),
    )


async def _proxy_stream(request: Request, target: str, headers: dict, body: bytes):
    """SSE passthrough — stream bytes from the backend to the client."""
    client: httpx.AsyncClient = request.app.state.stream_client

    try:
        req = client.build_request(
            method=request.method,
            url=target,
            headers=headers,
            content=body,
        )
        resp = await client.send(req, stream=True)
    except httpx.ConnectError:
        logger.warning("Stream service unavailable: %s %s", request.method, target)
        return Response(
            content='{"detail":"Service unavailable"}',
            status_code=503,
            media_type="application/json",
        )
    except httpx.TimeoutException:
        logger.warning("Stream service timeout: %s %s", request.method, target)
        return Response(
            content='{"detail":"Service timeout"}',
            status_code=504,
            media_type="application/json",
        )

    if resp.status_code != 200:
        content = await resp.aread()
        await resp.aclose()
        return Response(content=content, status_code=resp.status_code, media_type="application/json")

    async def _forward():
        try:
            async for chunk in resp.aiter_bytes():
                yield chunk
        finally:
            await resp.aclose()

    return StreamingResponse(
        _forward(),
        status_code=200,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
