"""Hiring agent API — AI-powered natural language queries + file upload + SSE streaming + conversation persistence."""
import os
import time
import uuid
import logging
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from pydantic import BaseModel
from typing import Optional

from app.db.postgres import get_db
from app.db.models import AgentConversation, AgentMessage
from app.core.security import get_current_user, require_employee
from app.core.config import settings
from app.services.hiring_agent_service import (
    query_hiring_agent,
    query_hiring_agent_stream,
    execute_confirmed_action,
    cancel_confirmation,
    get_pending_confirmation,
)
from app.utils.file_validation import validate_agent_upload, AGENT_ALLOWED_EXTENSIONS

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Per-user rate limiter ──────────────────────────────────────────────

_agent_requests: dict[str, list[float]] = defaultdict(list)

RATE_LIMITS = {
    "query": (20, 60),    # 20 requests per 60s
    "upload": (10, 60),   # 10 requests per 60s
}


def _check_rate_limit(user_id: str, action: str):
    max_requests, window_seconds = RATE_LIMITS.get(action, (20, 60))
    key = f"{user_id}:{action}"
    now = time.time()
    window_start = now - window_seconds
    _agent_requests[key] = [t for t in _agent_requests[key] if t > window_start]
    if len(_agent_requests[key]) >= max_requests:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {max_requests} requests per {window_seconds}s.",
        )
    _agent_requests[key].append(now)


class AgentQuery(BaseModel):
    query: str
    job_id: Optional[str] = None
    conversation_history: list[dict] = []
    web_search_enabled: bool = False
    file_context: Optional[str] = None


class AgentResponse(BaseModel):
    answer: str
    data: Optional[list | dict] = None
    data_type: Optional[str] = None
    actions: Optional[list[dict]] = None


@router.post("/query")
async def hiring_agent_query(
    payload: AgentQuery,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Process a natural language hiring query using AI with full recruiting context and tool calling."""
    user_id = str(user["sub"])
    _check_rate_limit(user_id, "query")
    user_name = user.get("first_name", "") or user.get("name", "Recruiter")
    user_role = user.get("role", "hr")

    try:
        result = await query_hiring_agent(
            db=db,
            user_id=user_id,
            user_name=user_name,
            query=payload.query,
            conversation_history=payload.conversation_history,
            web_search_enabled=payload.web_search_enabled,
            file_context=payload.file_context,
            job_id=int(payload.job_id) if payload.job_id else None,
            user_role=user_role,
        )
        return AgentResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Hiring agent query failed")
        raise HTTPException(status_code=500, detail=f"AI query failed: {str(e)}")


MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


MAX_EXTRACTED_TEXT_CHARS = 8000


@router.post("/upload")
async def upload_agent_file(
    file: UploadFile = File(...),
    user: dict = Depends(require_employee),
):
    """Upload a file for the hiring agent. Extracts text from PDF/DOCX/TXT."""
    user_id = str(user["sub"])
    _check_rate_limit(user_id, "upload")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Validate real file type via magic bytes
    await validate_agent_upload(file, contents)

    ext = os.path.splitext(file.filename or "")[1].lower()

    # Save file
    upload_dir = os.path.join(settings.UPLOAD_BASE, "agent")
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_name)
    with open(file_path, "wb") as f:
        f.write(contents)

    # Extract text
    extracted_text = None
    try:
        if ext == ".txt":
            extracted_text = contents.decode("utf-8", errors="replace")
        elif ext == ".pdf":
            from PyPDF2 import PdfReader
            import io
            reader = PdfReader(io.BytesIO(contents))
            pages_text = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            extracted_text = "\n\n".join(pages_text) if pages_text else None
        elif ext == ".docx":
            from docx import Document
            import io
            doc = Document(io.BytesIO(contents))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            extracted_text = "\n\n".join(paragraphs) if paragraphs else None
    except Exception as e:
        logger.warning(f"Text extraction failed for {file.filename}: {e}")

    # Truncate extracted text to prevent LLM context blowup
    truncated = False
    char_count = len(extracted_text) if extracted_text else 0
    if extracted_text and len(extracted_text) > MAX_EXTRACTED_TEXT_CHARS:
        extracted_text = extracted_text[:MAX_EXTRACTED_TEXT_CHARS]
        truncated = True

    file_url = f"/files/agent/{safe_name}"
    return {
        "url": file_url,
        "filename": file.filename,
        "extracted_text": extracted_text,
        "char_count": char_count,
        "truncated": truncated,
    }


# ── Confirmation endpoints ─────────────────────────────────────────────


@router.post("/confirm/{token}")
async def confirm_agent_action(
    token: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Confirm and execute a pending destructive action."""
    user_id = str(user["sub"])
    entry = get_pending_confirmation(token, user_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Confirmation token expired or not found")

    result = await execute_confirmed_action(db, token, user_id)
    return {"tool": entry["tool"], "args": entry["args"], "result": result}


@router.post("/cancel/{token}")
async def cancel_agent_action(
    token: str,
    user: dict = Depends(require_employee),
):
    """Cancel a pending destructive action."""
    user_id = str(user["sub"])
    if not cancel_confirmation(token, user_id):
        raise HTTPException(status_code=404, detail="Confirmation token expired or not found")
    return {"cancelled": True}


# ── SSE Streaming endpoint ──────────────────────────────────────────────


class StreamAgentQuery(BaseModel):
    query: str
    job_id: Optional[str] = None
    conversation_history: list[dict] = []
    web_search_enabled: bool = False
    file_context: Optional[str] = None
    conversation_id: Optional[int] = None


@router.post("/query/stream")
async def hiring_agent_query_stream(
    payload: StreamAgentQuery,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """SSE streaming version of the hiring agent query."""
    user_id = str(user["sub"])
    _check_rate_limit(user_id, "query")
    user_name = user.get("first_name", "") or user.get("name", "Recruiter")
    user_role = user.get("role", "hr")

    async def event_generator():
        try:
            async for chunk in query_hiring_agent_stream(
                db=db,
                user_id=user_id,
                user_name=user_name,
                query=payload.query,
                conversation_history=payload.conversation_history,
                web_search_enabled=payload.web_search_enabled,
                file_context=payload.file_context,
                job_id=int(payload.job_id) if payload.job_id else None,
                user_role=user_role,
            ):
                yield chunk
        except Exception as e:
            logger.exception("Hiring agent stream failed")
            import json
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Conversation CRUD endpoints ─────────────────────────────────────────


@router.get("/conversations")
async def list_conversations(
    page: int = 1,
    page_size: int = 20,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """List user's agent conversations."""
    user_id = str(user["sub"])
    offset = (page - 1) * page_size

    total = (await db.execute(
        select(func.count()).select_from(AgentConversation)
        .where(AgentConversation.user_id == user_id)
    )).scalar_one()

    rows = (await db.execute(
        select(AgentConversation)
        .where(AgentConversation.user_id == user_id)
        .order_by(AgentConversation.updated_at.desc())
        .offset(offset).limit(page_size)
    )).scalars().all()

    return {
        "items": [
            {"id": c.id, "title": c.title, "created_at": str(c.created_at), "updated_at": str(c.updated_at)}
            for c in rows
        ],
        "total": total,
    }


class CreateConversation(BaseModel):
    title: Optional[str] = None


@router.post("/conversations")
async def create_conversation(
    payload: CreateConversation,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent conversation."""
    user_id = str(user["sub"])
    convo = AgentConversation(user_id=user_id, title=payload.title)
    db.add(convo)
    await db.commit()
    await db.refresh(convo)
    return {"id": convo.id, "title": convo.title}


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Get all messages for a conversation."""
    user_id = str(user["sub"])
    convo = (await db.execute(
        select(AgentConversation).where(
            AgentConversation.id == conversation_id,
            AgentConversation.user_id == user_id,
        )
    )).scalar_one_or_none()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = (await db.execute(
        select(AgentMessage)
        .where(AgentMessage.conversation_id == conversation_id)
        .order_by(AgentMessage.created_at.asc())
    )).scalars().all()

    return {
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "data": m.data,
                "actions": m.actions,
                "files": m.files,
                "created_at": str(m.created_at),
            }
            for m in msgs
        ]
    }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation and its messages."""
    user_id = str(user["sub"])
    convo = (await db.execute(
        select(AgentConversation).where(
            AgentConversation.id == conversation_id,
            AgentConversation.user_id == user_id,
        )
    )).scalar_one_or_none()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.execute(
        delete(AgentMessage).where(AgentMessage.conversation_id == conversation_id)
    )
    await db.delete(convo)
    await db.commit()
    return {"deleted": True}
