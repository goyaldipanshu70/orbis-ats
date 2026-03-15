"""Business logic for AI interview sessions — creation, orchestration, evaluation."""
import asyncio
import json
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.http_client import get_ai_client
from app.db.models import (
    AIInterviewSession,
    AIInterviewMessage,
    AIInterviewProctoringEvent,
    CandidateJobEntry,
    CandidateProfile,
    JobDescription,
    JobApplication,
)

logger = logging.getLogger("svc-recruiting")


def _generate_token() -> str:
    return secrets.token_urlsafe(48)[:64]


async def create_interview_session(
    db: AsyncSession,
    candidate_id: int,
    jd_id: int,
    created_by: str,
    interview_type: str = "mixed",
    max_questions: int = 10,
    time_limit_minutes: int = 30,
    include_coding: bool = False,
    coding_language: Optional[str] = None,
    application_id: Optional[int] = None,
) -> AIInterviewSession:
    """Create a new AI interview session with JD/resume context snapshots."""
    # Load JD context
    job = (await db.execute(
        select(JobDescription).where(JobDescription.id == jd_id)
    )).scalar_one_or_none()
    if not job:
        raise ValueError("Job not found")

    # Load candidate + profile for resume context
    entry = (await db.execute(
        select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
    )).scalar_one_or_none()
    if not entry:
        raise ValueError("Candidate not found")

    profile = (await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
    )).scalar_one_or_none()

    jd_context = job.ai_result or {}
    # Flatten nested skills to top-level for AI interviewer compatibility
    if isinstance(jd_context, dict):
        rubric = jd_context.get("extracted_rubric", {})
        if rubric and not jd_context.get("required_skills"):
            jd_context["required_skills"] = (
                rubric.get("core_skills", []) +
                rubric.get("preferred_skills", [])
            )
            jd_context["soft_skills"] = rubric.get("soft_skills", [])

    resume_context = entry.ai_resume_analysis or {}
    if profile and profile.parsed_metadata:
        resume_context["profile_metadata"] = profile.parsed_metadata

    session = AIInterviewSession(
        token=_generate_token(),
        candidate_id=candidate_id,
        jd_id=jd_id,
        application_id=application_id,
        interview_type=interview_type,
        max_questions=max_questions,
        time_limit_minutes=time_limit_minutes,
        include_coding=include_coding,
        coding_language=coding_language,
        status="pending",
        jd_context=jd_context,
        resume_context=resume_context,
        created_by=created_by,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def send_interview_invite(
    db: AsyncSession,
    session_id: int,
    email: str,
) -> AIInterviewSession:
    """Mark invite as sent and email the candidate."""
    session = (await db.execute(
        select(AIInterviewSession).where(AIInterviewSession.id == session_id)
    )).scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    session.invite_email = email
    session.invite_sent_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)

    # Look up actual candidate name
    entry = (await db.execute(
        select(CandidateJobEntry).where(CandidateJobEntry.id == session.candidate_id)
    )).scalar_one_or_none()
    candidate_name = entry.full_name if entry and getattr(entry, 'full_name', None) else None
    if not candidate_name:
        # Fallback: try profile
        if entry and entry.profile_id:
            profile = (await db.execute(
                select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
            )).scalar_one_or_none()
            candidate_name = profile.full_name if profile else None
    candidate_name = candidate_name or email.split("@")[0]

    # Fire-and-forget email
    async def _send():
        try:
            from app.services.email_notification_service import send_ai_interview_invite
            jd_ctx = session.jd_context or {}
            job_title = jd_ctx.get("job_title", "Open Position")
            invite_link = f"{settings.FRONTEND_URL}/ai-interview/{session.token}"
            await send_ai_interview_invite(
                email=email,
                candidate_name=candidate_name,
                job_title=job_title,
                interview_link=invite_link,
                expires_at=session.expires_at,
            )
        except Exception as e:
            logger.error("Failed to send AI interview invite: %s", e)

    asyncio.create_task(_send())
    return session


async def get_session_by_token(db: AsyncSession, token: str) -> Optional[AIInterviewSession]:
    """Look up a session by its URL token."""
    return (await db.execute(
        select(AIInterviewSession).where(AIInterviewSession.token == token)
    )).scalar_one_or_none()


async def start_interview(db: AsyncSession, token: str) -> dict:
    """Validate token, generate multi-round interview plan, return opening message."""
    session = await get_session_by_token(db, token)
    if not session:
        raise ValueError("Invalid interview token")
    if session.status == "completed":
        raise ValueError("This interview has already been completed")
    if session.status == "cancelled":
        raise ValueError("This interview has been cancelled")
    if session.expires_at < datetime.utcnow():
        session.status = "expired"
        await db.commit()
        raise ValueError("This interview link has expired")

    # Call svc-ai-interview to generate multi-round plan
    client = get_ai_client()
    resp = await client.post(
        f"{settings.AI_INTERVIEW_URL}/conversation/plan/multi-round",
        json={
            "parsed_jd": session.jd_context or {},
            "parsed_resume": session.resume_context or {},
            "interview_type": session.interview_type,
            "include_coding": session.include_coding,
            "coding_language": session.coding_language,
            "max_questions": session.max_questions,
        },
        timeout=60,
    )
    if resp.status_code != 200:
        # Fallback to legacy plan endpoint
        resp = await client.post(
            f"{settings.AI_INTERVIEW_URL}/conversation/plan",
            json={
                "parsed_jd": session.jd_context or {},
                "parsed_resume": session.resume_context or {},
                "interview_type": session.interview_type,
                "include_coding": session.include_coding,
                "coding_language": session.coding_language,
                "max_questions": session.max_questions,
            },
            timeout=60,
        )
        if resp.status_code != 200:
            raise ValueError(f"AI service error: {resp.text}")

    result = resp.json()

    # Extract plan and interview state (multi-round format)
    plan = result.get("plan", result)
    interview_state = result.get("interview_state", {
        "current_round": 1,
        "current_round_type": "screening",
        "round_question_number": 1,
        "questions_asked": [],
        "topics_covered": [],
        "difficulty_level": "medium",
        "candidate_strengths": [],
        "candidate_weaknesses": [],
        "follow_up_count": 0,
        "round_scores": {},
    })

    # Update session with multi-round data
    session.status = "in_progress"
    session.started_at = datetime.utcnow()
    session.questions_plan = plan
    session.interview_plan = plan
    session.interview_state = interview_state
    session.current_question = 1
    session.transcript = []
    await db.commit()

    # Store opening message
    opening = plan.get("opening_message", "Hello! Welcome to your AI interview. Let's get started.")
    msg = AIInterviewMessage(
        session_id=session.id,
        role="ai",
        content=opening,
        message_type="system",
        sequence=0,
    )
    db.add(msg)

    # Get first question from the plan
    questions = plan.get("questions", [])
    if not questions and plan.get("rounds"):
        # Extract from rounds format
        for rnd in plan["rounds"]:
            for q in rnd.get("questions", []):
                questions.append(q)

    first_q = questions[0]["question"] if questions else "Tell me about yourself."
    first_round_type = None
    if plan.get("rounds"):
        first_round_type = plan["rounds"][0].get("type", "screening")

    first_msg = AIInterviewMessage(
        session_id=session.id,
        role="ai",
        content=first_q,
        message_type="question",
        round_number=1,
        round_type=first_round_type,
        sequence=1,
    )
    db.add(first_msg)
    await db.commit()

    # Build rounds info for frontend
    rounds_info = []
    if plan.get("rounds"):
        for rnd in plan["rounds"]:
            rounds_info.append({
                "round_number": rnd.get("round_number"),
                "type": rnd.get("type"),
                "question_count": len(rnd.get("questions", [])),
            })

    return {
        "opening_message": opening,
        "first_question": first_q,
        "total_questions": len(questions),
        "time_limit_minutes": session.time_limit_minutes,
        "include_coding": session.include_coding,
        "interview_type": session.interview_type,
        "rounds": rounds_info,
        "current_round": 1,
        "current_round_type": first_round_type,
        "seniority_level": plan.get("seniority_level"),
        "key_topics": plan.get("key_topics", []),
    }


async def process_candidate_message(
    db: AsyncSession,
    token: str,
    message: str,
    message_type: str = "answer",
) -> dict:
    """Store candidate message, get AI response, store it, return response."""
    session = await get_session_by_token(db, token)
    if not session or session.status != "in_progress":
        raise ValueError("Interview is not active")

    # Check time limit
    if session.started_at:
        elapsed = (datetime.utcnow() - session.started_at).total_seconds() / 60
        if elapsed > session.time_limit_minutes:
            return await end_interview(db, token)

    # Get current sequence
    max_seq = (await db.execute(
        select(func.max(AIInterviewMessage.sequence))
        .where(AIInterviewMessage.session_id == session.id)
    )).scalar_one() or 0

    # Store candidate message
    candidate_msg = AIInterviewMessage(
        session_id=session.id,
        role="candidate",
        content=message,
        message_type=message_type,
        sequence=max_seq + 1,
    )
    db.add(candidate_msg)
    await db.flush()

    # Build conversation history for AI
    all_msgs = (await db.execute(
        select(AIInterviewMessage)
        .where(AIInterviewMessage.session_id == session.id)
        .order_by(AIInterviewMessage.sequence)
    )).scalars().all()

    conversation_history = []
    for m in all_msgs:
        role = "assistant" if m.role == "ai" else "user"
        conversation_history.append({"role": role, "content": m.content})

    # Truncate conversation history to prevent prompt bloat / timeout
    # Keep last 20 messages (10 Q&A pairs) — older context lives in interview_state
    MAX_HISTORY_MESSAGES = 20
    if len(conversation_history) > MAX_HISTORY_MESSAGES:
        conversation_history = conversation_history[-MAX_HISTORY_MESSAGES:]

    # Determine whether to use adaptive or legacy mode
    use_adaptive = session.interview_plan is not None and session.interview_state is not None
    client = get_ai_client()

    if use_adaptive:
        # Use adaptive multi-round endpoint
        resp = await client.post(
            f"{settings.AI_INTERVIEW_URL}/conversation/respond/adaptive",
            json={
                "conversation_history": conversation_history,
                "current_question": session.current_question,
                "interview_plan": session.interview_plan or {},
                "interview_state": session.interview_state or {},
                "parsed_jd": session.jd_context or {},
                "parsed_resume": session.resume_context or {},
                "interview_type": session.interview_type,
                "max_questions": session.max_questions,
                "stream": False,
            },
            timeout=120,
        )
    else:
        # Legacy mode
        resp = await client.post(
            f"{settings.AI_INTERVIEW_URL}/conversation/respond",
            json={
                "conversation_history": conversation_history,
                "current_question": session.current_question,
                "questions_plan": session.questions_plan or {},
                "parsed_jd": session.jd_context or {},
                "parsed_resume": session.resume_context or {},
                "interview_type": session.interview_type,
                "max_questions": session.max_questions,
                "stream": False,
            },
            timeout=120,
        )

    if resp.status_code != 200:
        raise ValueError(f"AI service error: {resp.text}")

    ai_response = resp.json()
    ai_message = ai_response.get("message", "")
    ai_msg_type = ai_response.get("message_type", "question")
    # Default move_to_next based on message type — follow-ups should NOT advance counter
    default_move = ai_msg_type not in ("follow_up", "follow-up", "clarification")
    move_to_next = ai_response.get("move_to_next", default_move)
    code_prompt = ai_response.get("code_prompt")
    advance_round = ai_response.get("advance_round", False)

    # Update interview state if adaptive mode returned it
    new_interview_state = ai_response.get("interview_state")
    if new_interview_state and use_adaptive:
        session.interview_state = new_interview_state

    # Get current round info for message storage
    current_round_num = None
    current_round_type = None
    if session.interview_state:
        current_round_num = session.interview_state.get("current_round")
        current_round_type = session.interview_state.get("current_round_type")

    # Store AI response
    ai_msg = AIInterviewMessage(
        session_id=session.id,
        role="ai",
        content=ai_message,
        message_type=ai_msg_type,
        round_number=current_round_num,
        round_type=current_round_type,
        sequence=max_seq + 2,
    )
    db.add(ai_msg)

    # Update question counter
    if move_to_next:
        session.current_question = (session.current_question or 0) + 1

    # Update transcript with round info
    transcript = session.transcript or []
    transcript.append({
        "role": "candidate",
        "content": message,
        "timestamp": datetime.utcnow().isoformat(),
        "round": current_round_num,
        "round_type": current_round_type,
    })
    transcript.append({
        "role": "ai",
        "content": ai_message,
        "message_type": ai_msg_type,
        "timestamp": datetime.utcnow().isoformat(),
        "round": current_round_num,
        "round_type": current_round_type,
    })
    session.transcript = transcript

    await db.commit()

    # Check if interview should end
    is_closing = ai_msg_type == "closing"
    is_last_question = (session.current_question or 0) > session.max_questions

    result = {
        "message": ai_message,
        "message_type": ai_msg_type,
        "move_to_next": move_to_next,
        "current_question": session.current_question,
        "is_complete": is_closing or is_last_question,
        "code_prompt": code_prompt,
        "advance_round": advance_round,
        "current_round": current_round_num,
        "current_round_type": current_round_type,
        "difficulty_level": session.interview_state.get("difficulty_level") if session.interview_state else None,
    }

    if is_closing or is_last_question:
        # Auto-end interview
        asyncio.create_task(_async_end_interview(token))

    return result


async def process_code_submission(
    db: AsyncSession,
    token: str,
    code: str,
    language: str,
) -> dict:
    """Evaluate a code submission and store it."""
    session = await get_session_by_token(db, token)
    if not session or session.status != "in_progress":
        raise ValueError("Interview is not active")

    # Find the most recent coding prompt
    questions = (session.questions_plan or {}).get("questions", [])
    current_q = session.current_question or 1
    problem_desc = ""
    expected_approach = ""
    if current_q - 1 < len(questions):
        q = questions[current_q - 1]
        problem_desc = q.get("question", "")
        expected_approach = q.get("expected_approach", "")

    # Call AI to evaluate code
    client = get_ai_client()
    resp = await client.post(
        f"{settings.AI_INTERVIEW_URL}/conversation/eval-code",
        json={
            "code": code,
            "language": language,
            "problem_description": problem_desc,
            "expected_approach": expected_approach,
        },
        timeout=30,
    )
    if resp.status_code != 200:
        raise ValueError(f"AI service error: {resp.text}")

    eval_result = resp.json()

    # Store code submission as message
    max_seq = (await db.execute(
        select(func.max(AIInterviewMessage.sequence))
        .where(AIInterviewMessage.session_id == session.id)
    )).scalar_one() or 0

    code_msg = AIInterviewMessage(
        session_id=session.id,
        role="candidate",
        content=f"[Code submission in {language}]",
        message_type="code_answer",
        code_content=code,
        code_language=language,
        sequence=max_seq + 1,
    )
    db.add(code_msg)

    # Update transcript
    transcript = session.transcript or []
    transcript.append({
        "role": "candidate",
        "content": f"[Code submission in {language}]",
        "code": code,
        "language": language,
        "timestamp": datetime.utcnow().isoformat(),
    })
    session.transcript = transcript
    await db.commit()

    return eval_result


async def save_proctoring_events(
    db: AsyncSession,
    token: str,
    events: list,
) -> int:
    """Batch save proctoring events."""
    session = await get_session_by_token(db, token)
    if not session:
        raise ValueError("Invalid token")

    count = 0
    for evt in events:
        pe = AIInterviewProctoringEvent(
            session_id=session.id,
            event_type=evt.get("event_type", "unknown"),
            timestamp=datetime.fromisoformat(evt["timestamp"]) if isinstance(evt.get("timestamp"), str) else datetime.utcnow(),
            duration_ms=evt.get("duration_ms"),
            extra_data=evt.get("metadata"),
        )
        db.add(pe)
        count += 1
    await db.commit()
    return count


async def calculate_proctoring_score(db: AsyncSession, session_id: int) -> dict:
    """Compute integrity score from proctoring events with detailed cheating flags.
    Returns dict with integrity_score, cheating_flags, and risk_level."""
    events = (await db.execute(
        select(AIInterviewProctoringEvent)
        .where(AIInterviewProctoringEvent.session_id == session_id)
        .order_by(AIInterviewProctoringEvent.timestamp)
    )).scalars().all()

    if not events:
        return {"integrity_score": 100.0, "cheating_flags": [], "risk_level": "low"}

    tab_away_count = sum(1 for e in events if e.event_type in ("tab_away", "window_blur"))
    total_away_ms = sum(e.duration_ms or 0 for e in events if e.event_type == "tab_return")
    copy_paste_count = sum(1 for e in events if e.event_type == "copy_paste")
    multi_face_count = sum(1 for e in events if e.event_type == "multiple_faces")
    long_silence_count = sum(1 for e in events if e.event_type == "long_silence")
    external_device_count = sum(1 for e in events if e.event_type == "external_device")
    code_plagiarism_count = sum(1 for e in events if e.event_type == "code_plagiarism")
    window_resize_count = sum(1 for e in events if e.event_type == "window_resize")

    # Detect suspicious paste patterns (large code blocks)
    large_paste_count = 0
    for e in events:
        if e.event_type == "copy_paste" and isinstance(e.extra_data, dict):
            content_len = e.extra_data.get("content_length", 0)
            if content_len > 200:
                large_paste_count += 1

    # Scoring: start at 100, deduct for issues
    score = 100.0
    score -= min(tab_away_count * 3, 30)          # -3 per tab switch, max -30
    score -= min(total_away_ms / 10000, 20)        # -1 per 10s away, max -20
    score -= min(copy_paste_count * 5, 15)         # -5 per copy/paste, max -15
    score -= min(large_paste_count * 8, 20)        # -8 per large paste (>200 chars), max -20
    score -= min(multi_face_count * 10, 20)        # -10 per multi-face detection, max -20
    score -= min(long_silence_count * 2, 10)       # -2 per long silence, max -10
    score -= min(external_device_count * 8, 15)    # -8 per external device, max -15
    score -= min(code_plagiarism_count * 15, 30)   # -15 per plagiarism flag, max -30
    score -= min(window_resize_count * 1, 5)       # -1 per window resize, max -5

    integrity_score = max(0.0, round(score, 1))

    # Build cheating flags
    cheating_flags = []
    if tab_away_count > 2:
        cheating_flags.append({"type": "tab_switching", "count": tab_away_count, "severity": "medium"})
    if copy_paste_count > 0:
        cheating_flags.append({"type": "copy_paste", "count": copy_paste_count, "severity": "high"})
    if multi_face_count > 0:
        cheating_flags.append({"type": "multiple_faces", "count": multi_face_count, "severity": "high"})
    if long_silence_count > 3:
        cheating_flags.append({"type": "long_silence", "count": long_silence_count, "severity": "low"})
    if external_device_count > 0:
        cheating_flags.append({"type": "external_device", "count": external_device_count, "severity": "high"})
    if code_plagiarism_count > 0:
        cheating_flags.append({"type": "code_plagiarism", "count": code_plagiarism_count, "severity": "critical"})
    if large_paste_count > 0:
        cheating_flags.append({"type": "large_paste", "count": large_paste_count, "severity": "high"})
    if total_away_ms > 60000:
        cheating_flags.append({"type": "extended_absence", "duration_ms": total_away_ms, "severity": "medium"})

    # Determine risk level
    if integrity_score >= 80:
        risk_level = "low"
    elif integrity_score >= 60:
        risk_level = "medium"
    elif integrity_score >= 40:
        risk_level = "high"
    else:
        risk_level = "critical"

    return {
        "integrity_score": integrity_score,
        "cheating_flags": cheating_flags,
        "risk_level": risk_level,
    }


async def end_interview(db: AsyncSession, token: str) -> dict:
    """End the interview and trigger evaluation."""
    session = await get_session_by_token(db, token)
    if not session:
        raise ValueError("Invalid token")
    if session.status == "completed":
        return {"status": "already_completed", "message": "This interview was already completed."}

    session.status = "completed"
    session.completed_at = datetime.utcnow()
    await db.commit()

    # Calculate proctoring score (now returns dict with integrity_score, cheating_flags, risk_level)
    proctor_result = await calculate_proctoring_score(db, session.id)
    proctor_score = proctor_result["integrity_score"]
    session.proctoring_score = proctor_score

    # Call AI for deep evaluation (try new endpoint, fallback to legacy)
    proctoring_summary = {
        "integrity_score": proctor_score,
        "cheating_flags": proctor_result.get("cheating_flags", []),
        "risk_level": proctor_result.get("risk_level", "low"),
    }
    use_deep = session.interview_plan is not None
    try:
        client = get_ai_client()
        if use_deep:
            resp = await client.post(
                f"{settings.AI_INTERVIEW_URL}/conversation/evaluate/deep",
                json={
                    "transcript": session.transcript or [],
                    "parsed_jd": session.jd_context or {},
                    "parsed_resume": session.resume_context or {},
                    "interview_plan": session.interview_plan or {},
                    "interview_state": session.interview_state or {},
                    "proctoring_summary": proctoring_summary,
                },
                timeout=120,
            )
        else:
            resp = await client.post(
                f"{settings.AI_INTERVIEW_URL}/conversation/evaluate",
                json={
                    "transcript": session.transcript or [],
                    "parsed_jd": session.jd_context or {},
                    "parsed_resume": session.resume_context or {},
                    "questions_plan": session.questions_plan or {},
                    "proctoring_summary": proctoring_summary,
                },
                timeout=120,
            )

        if resp.status_code == 200:
            evaluation = resp.json()
            session.evaluation = evaluation

            # Extract overall score
            if "overall_score" in evaluation:
                raw_score = evaluation["overall_score"]
                # Deep eval uses 0-10 scale — normalize to 0-100 for consistent storage
                session.overall_score = round(raw_score * 10) if raw_score <= 10 else raw_score
            else:
                score_breakdown = evaluation.get("score_breakdown", {})
                total = sum(v for v in score_breakdown.values() if isinstance(v, (int, float)))
                session.overall_score = total

            session.ai_recommendation = evaluation.get("hire_recommendation") or evaluation.get("ai_recommendation", "maybe")
        else:
            logger.error("AI evaluation failed: %s", resp.text)

        # Generate recruiter report (fire-and-forget, don't block on failure)
        if resp.status_code == 200 and session.evaluation:
            try:
                report_resp = await client.post(
                    f"{settings.AI_INTERVIEW_URL}/conversation/report",
                    json={
                        "evaluation": session.evaluation,
                        "parsed_jd": session.jd_context or {},
                        "parsed_resume": session.resume_context or {},
                        "transcript": session.transcript or [],
                        "interview_plan": session.interview_plan or session.questions_plan or {},
                        "proctoring_summary": proctoring_summary,
                    },
                    timeout=60,
                )
                if report_resp.status_code == 200:
                    session.recruiter_report = report_resp.json()
            except Exception as report_err:
                logger.warning("Recruiter report generation failed: %s", report_err)
    except Exception as e:
        logger.error("AI evaluation error: %s", e)

    await db.commit()

    # Publish event for real-time pipeline updates
    try:
        from app.services.event_bus import publish_broadcast_event
        await publish_broadcast_event("ai_interview_completed", {
            "session_id": session.id,
            "candidate_id": session.candidate_id,
            "jd_id": session.jd_id,
            "score": session.overall_score,
            "recommendation": session.ai_recommendation,
        })
    except Exception:
        pass

    return {
        "status": "completed",
        "message": "Thank you for completing the interview. Your results will be reviewed by the hiring team.",
    }


async def _async_end_interview(token: str):
    """Fire-and-forget wrapper for end_interview (needs its own session)."""
    # This is called as a background task after the last question
    # In practice, the candidate will call /end explicitly, but this is a safety net
    # Wait a few seconds to let the frontend's explicit /end call arrive first
    await asyncio.sleep(5)
    try:
        from app.db.postgres import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            session = await get_session_by_token(db, token)
            if session and session.status == "in_progress":
                await end_interview(db, token)
    except Exception as e:
        logger.error("_async_end_interview failed for token %s: %s", token, e)


async def get_session_results(db: AsyncSession, session_id: int) -> Optional[dict]:
    """Return full results for an AI interview session."""
    session = (await db.execute(
        select(AIInterviewSession).where(AIInterviewSession.id == session_id)
    )).scalar_one_or_none()
    if not session:
        return None

    # Load messages
    messages = (await db.execute(
        select(AIInterviewMessage)
        .where(AIInterviewMessage.session_id == session_id)
        .order_by(AIInterviewMessage.sequence)
    )).scalars().all()

    # Load proctoring events
    proctor_events = (await db.execute(
        select(AIInterviewProctoringEvent)
        .where(AIInterviewProctoringEvent.session_id == session_id)
        .order_by(AIInterviewProctoringEvent.timestamp)
    )).scalars().all()

    # Calculate detailed cheating analysis
    proctor_analysis = await calculate_proctoring_score(db, session_id)

    return {
        "id": session.id,
        "token": session.token,
        "candidate_id": session.candidate_id,
        "jd_id": session.jd_id,
        "interview_type": session.interview_type,
        "status": session.status,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        "time_limit_minutes": session.time_limit_minutes,
        "max_questions": session.max_questions,
        "include_coding": session.include_coding,
        "overall_score": session.overall_score,
        "proctoring_score": session.proctoring_score,
        "ai_recommendation": session.ai_recommendation,
        "evaluation": session.evaluation,
        "interview_plan": session.interview_plan,
        "interview_state": session.interview_state,
        "recruiter_report": session.recruiter_report,
        "cheating_flags": proctor_analysis.get("cheating_flags", []),
        "risk_level": proctor_analysis.get("risk_level", "low"),
        "transcript": [
            {
                "role": m.role,
                "content": m.content,
                "message_type": m.message_type,
                "code_content": m.code_content,
                "code_language": m.code_language,
                "round_number": m.round_number,
                "round_type": m.round_type,
                "timestamp": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
        "proctoring_events": [
            {
                "event_type": e.event_type,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "duration_ms": e.duration_ms,
            }
            for e in proctor_events
        ],
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "invite_email": session.invite_email,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
    }


async def get_sessions_for_job(
    db: AsyncSession,
    jd_id: int,
) -> list:
    """List all AI interview sessions for a given job."""
    sessions = (await db.execute(
        select(AIInterviewSession)
        .where(AIInterviewSession.jd_id == jd_id)
        .order_by(AIInterviewSession.created_at.desc())
    )).scalars().all()

    # Batch-load candidate profiles
    candidate_ids = {s.candidate_id for s in sessions}
    entry_map = {}
    profile_map = {}
    if candidate_ids:
        entries = (await db.execute(
            select(CandidateJobEntry).where(CandidateJobEntry.id.in_(candidate_ids))
        )).scalars().all()
        entry_map = {e.id: e for e in entries}
        profile_ids = {e.profile_id for e in entries}
        if profile_ids:
            profiles = (await db.execute(
                select(CandidateProfile).where(CandidateProfile.id.in_(profile_ids))
            )).scalars().all()
            profile_map = {p.id: p for p in profiles}

    result = []
    for s in sessions:
        entry = entry_map.get(s.candidate_id)
        profile = profile_map.get(entry.profile_id) if entry else None
        result.append({
            "id": s.id,
            "token": s.token,
            "candidate_id": s.candidate_id,
            "candidate_name": profile.full_name if profile else None,
            "candidate_email": profile.email if profile else s.invite_email,
            "status": s.status,
            "interview_type": s.interview_type,
            "overall_score": s.overall_score,
            "ai_recommendation": s.ai_recommendation,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        })
    return result


async def get_sessions_for_candidate(db: AsyncSession, candidate_id: int, jd_id: Optional[int] = None) -> list:
    """Get AI interview sessions for a candidate, optionally scoped to a job."""
    query = (
        select(AIInterviewSession)
        .where(AIInterviewSession.candidate_id == candidate_id)
    )
    if jd_id is not None:
        query = query.where(AIInterviewSession.jd_id == jd_id)
    sessions = (await db.execute(
        query.order_by(AIInterviewSession.created_at.desc())
    )).scalars().all()

    return [
        {
            "id": s.id,
            "status": s.status,
            "interview_type": s.interview_type,
            "overall_score": s.overall_score,
            "ai_recommendation": s.ai_recommendation,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]


async def cancel_session(db: AsyncSession, session_id: int) -> bool:
    """Cancel a pending AI interview session."""
    result = await db.execute(
        sql_update(AIInterviewSession)
        .where(
            AIInterviewSession.id == session_id,
            AIInterviewSession.status == "pending",
        )
        .values(status="cancelled", updated_at=datetime.utcnow())
    )
    await db.commit()
    return result.rowcount > 0


async def auto_create_interview_for_application(
    db: AsyncSession,
    application_id: int,
) -> Optional[AIInterviewSession]:
    """Auto-create AI interview when job has auto_ai_interview enabled."""
    app = (await db.execute(
        select(JobApplication).where(JobApplication.id == application_id)
    )).scalar_one_or_none()
    if not app or not app.candidate_id:
        return None

    job = (await db.execute(
        select(JobDescription).where(JobDescription.id == app.jd_id)
    )).scalar_one_or_none()
    if not job or not job.auto_ai_interview:
        return None

    session = await create_interview_session(
        db=db,
        candidate_id=app.candidate_id,
        jd_id=app.jd_id,
        created_by="system",
        application_id=application_id,
    )

    # Send invite email
    if app.user_email:
        await send_interview_invite(db, session.id, app.user_email)

    return session


async def create_profiling_session(
    db: AsyncSession,
    user_id: int,
    user_email: str,
    user_name: str,
    resume_url: Optional[str] = None,
) -> AIInterviewSession:
    """Create a candidate-initiated profiling interview (no job required).

    The AI asks about experience, skills, and career goals based on the
    candidate's resume.  Results feed job-match recommendations.
    """
    # Check for existing pending/in-progress profiling session
    existing = (await db.execute(
        select(AIInterviewSession).where(
            AIInterviewSession.user_id == user_id,
            AIInterviewSession.jd_id.is_(None),
            AIInterviewSession.status.in_(["pending", "in_progress"]),
        )
    )).scalar_one_or_none()
    if existing:
        return existing  # reuse instead of creating duplicates

    # Gather resume context from CandidateProfile (if any)
    resume_context: dict = {}
    profile = (await db.execute(
        select(CandidateProfile).where(CandidateProfile.email == user_email)
    )).scalar_one_or_none()
    if profile:
        if profile.parsed_metadata:
            resume_context["profile_metadata"] = profile.parsed_metadata
        if profile.resume_url:
            resume_url = resume_url or profile.resume_url

    if resume_url:
        resume_context["resume_url"] = resume_url

    session = AIInterviewSession(
        token=_generate_token(),
        user_id=user_id,
        candidate_id=None,
        jd_id=None,
        interview_type="profiling",
        max_questions=8,
        time_limit_minutes=20,
        include_coding=False,
        status="pending",
        jd_context={"job_title": "Profile Assessment", "description": "General candidate profiling interview"},
        resume_context=resume_context,
        created_by=str(user_id),
        expires_at=datetime.utcnow() + timedelta(days=30),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_profiling_sessions(db: AsyncSession, user_id: int) -> list:
    """Return all profiling sessions for a candidate user."""
    sessions = (await db.execute(
        select(AIInterviewSession)
        .where(AIInterviewSession.user_id == user_id, AIInterviewSession.jd_id.is_(None))
        .order_by(AIInterviewSession.created_at.desc())
    )).scalars().all()

    return [
        {
            "id": s.id,
            "token": s.token,
            "status": s.status,
            "interview_type": s.interview_type,
            "overall_score": s.overall_score,
            "evaluation": s.evaluation,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]
