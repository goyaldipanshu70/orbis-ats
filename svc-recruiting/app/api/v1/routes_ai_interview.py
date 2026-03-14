"""AI Interview endpoints — HR-facing (JWT) + candidate-facing (token-based)."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_employee, require_hiring_access
from app.db.postgres import get_db
from app.services import ai_interview_service as svc

logger = logging.getLogger("svc-recruiting")
router = APIRouter(tags=["AI Interview"])


# ── Request Schemas ──────────────────────────────────────────────────


class InviteRequest(BaseModel):
    candidate_id: int
    jd_id: int
    email: Optional[str] = None
    interview_type: str = "mixed"
    max_questions: int = 10
    time_limit_minutes: int = 30
    include_coding: bool = False
    coding_language: Optional[str] = None


class CandidateMessageRequest(BaseModel):
    message: str
    message_type: str = "answer"


class CodeSubmitRequest(BaseModel):
    code: str
    language: str


class ProctoringEventsRequest(BaseModel):
    events: list


# ── HR-Facing Endpoints (JWT required) ──────────────────────────────


@router.post("/invite")
async def invite_candidate(
    body: InviteRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Create an AI interview session and optionally send invite email."""
    try:
        session = await svc.create_interview_session(
            db=db,
            candidate_id=body.candidate_id,
            jd_id=body.jd_id,
            created_by=user["sub"],
            interview_type=body.interview_type,
            max_questions=body.max_questions,
            time_limit_minutes=body.time_limit_minutes,
            include_coding=body.include_coding,
            coding_language=body.coding_language,
        )

        if body.email:
            await svc.send_interview_invite(db, session.id, body.email)

        # Auto-move candidate to ai_interview stage (non-fatal if already there)
        try:
            from app.services.candidate_service import move_candidate_stage
            await move_candidate_stage(db, body.candidate_id, "ai_interview", changed_by=f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or str(user["sub"]))
        except Exception:
            pass

        from app.core.config import settings
        return {
            "session_id": session.id,
            "token": session.token,
            "invite_url": f"{settings.FRONTEND_URL}/ai-interview/{session.token}",
            "status": session.status,
            "expires_at": session.expires_at.isoformat(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions/{jd_id}")
async def list_sessions(
    jd_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """List all AI interview sessions for a job."""
    return await svc.get_sessions_for_job(db, jd_id)


@router.get("/candidate/{candidate_id}/sessions")
async def list_candidate_sessions(
    candidate_id: int,
    jd_id: Optional[int] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """List AI interview sessions for a candidate, optionally scoped to a job."""
    return await svc.get_sessions_for_candidate(db, candidate_id, jd_id=jd_id)


@router.get("/results/{session_id}")
async def get_results(
    session_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed results for an AI interview session."""
    result = await svc.get_session_results(db, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.delete("/{session_id}")
async def cancel_session(
    session_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a pending AI interview session."""
    success = await svc.cancel_session(db, session_id)
    if not success:
        raise HTTPException(status_code=400, detail="Session not found or not in pending state")
    return {"status": "cancelled"}


# ── Candidate-Facing Endpoints (token-based, no JWT) ────────────────


@router.get("/room/{token}")
async def get_room_info(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Get interview session info for the candidate lobby."""
    session = await svc.get_session_by_token(db, token)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid interview link")
    if session.status == "expired":
        raise HTTPException(status_code=410, detail="This interview link has expired")
    if session.status == "cancelled":
        raise HTTPException(status_code=410, detail="This interview has been cancelled")

    jd_ctx = session.jd_context or {}
    return {
        "job_title": jd_ctx.get("job_title", "Open Position"),
        "company": jd_ctx.get("company_name", ""),
        "interview_type": session.interview_type,
        "time_limit_minutes": session.time_limit_minutes,
        "max_questions": session.max_questions,
        "include_coding": session.include_coding,
        "coding_language": session.coding_language,
        "status": session.status,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
    }


@router.post("/room/{token}/start")
async def start_interview(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Start the AI interview — returns opening message and first question."""
    try:
        result = await svc.start_interview(db, token)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/room/{token}/message")
async def send_message(
    token: str,
    body: CandidateMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send a candidate answer and get the AI interviewer's response."""
    try:
        result = await svc.process_candidate_message(
            db=db,
            token=token,
            message=body.message,
            message_type=body.message_type,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/room/{token}/code")
async def submit_code(
    token: str,
    body: CodeSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit a code solution for evaluation."""
    try:
        result = await svc.process_code_submission(
            db=db,
            token=token,
            code=body.code,
            language=body.language,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/room/{token}/proctor")
async def submit_proctoring(
    token: str,
    body: ProctoringEventsRequest,
    db: AsyncSession = Depends(get_db),
):
    """Batch submit proctoring events."""
    try:
        count = await svc.save_proctoring_events(db, token, body.events)
        return {"saved": count}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/room/{token}/end")
async def end_interview(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """End the interview and trigger final evaluation."""
    try:
        result = await svc.end_interview(db, token)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
