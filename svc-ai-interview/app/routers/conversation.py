"""Endpoints for live AI interview conversation.

Supports both legacy (flat question plan) and enhanced (multi-round adaptive) modes.
"""
import json
import traceback

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional

from app.services.conversation_service import (
    generate_question_plan,
    generate_interview_plan,
    generate_interviewer_response,
    generate_interviewer_response_stream,
    generate_adaptive_response,
    generate_adaptive_response_stream,
    generate_final_evaluation,
    generate_deep_evaluation,
    evaluate_code_submission,
    generate_recruiter_report,
    create_initial_interview_state,
)

router = APIRouter()


# ── Request/Response schemas ─────────────────────────────────────────


class PlanRequest(BaseModel):
    parsed_jd: dict
    parsed_resume: dict
    interview_type: str = "mixed"
    include_coding: bool = False
    coding_language: Optional[str] = None
    max_questions: int = 10


class RespondRequest(BaseModel):
    conversation_history: List[Dict[str, str]]
    current_question: int
    questions_plan: dict
    parsed_jd: dict
    parsed_resume: dict
    interview_type: str = "mixed"
    max_questions: int = 10
    stream: bool = False


class AdaptiveRespondRequest(BaseModel):
    conversation_history: List[Dict[str, str]]
    current_question: int
    interview_plan: dict
    interview_state: dict
    parsed_jd: dict
    parsed_resume: dict
    interview_type: str = "mixed"
    max_questions: int = 10
    stream: bool = False


class EvaluateRequest(BaseModel):
    transcript: list
    parsed_jd: dict
    parsed_resume: dict
    questions_plan: dict
    proctoring_summary: dict = Field(default_factory=dict)


class DeepEvaluateRequest(BaseModel):
    transcript: list
    parsed_jd: dict
    parsed_resume: dict
    interview_plan: dict
    interview_state: dict = Field(default_factory=dict)
    proctoring_summary: dict = Field(default_factory=dict)


class CodeEvalRequest(BaseModel):
    code: str
    language: str
    problem_description: str
    expected_approach: Optional[str] = None


class ReportRequest(BaseModel):
    evaluation: dict
    parsed_jd: dict
    parsed_resume: dict
    transcript: list
    interview_plan: dict
    proctoring_summary: dict = Field(default_factory=dict)


# ── Endpoints ────────────────────────────────────────────────────────


@router.post("/plan")
async def create_question_plan(payload: PlanRequest):
    """Generate a question plan from JD + resume context.

    Returns a multi-round plan with flat questions list for backwards compatibility.
    """
    try:
        result = generate_question_plan(
            parsed_jd=payload.parsed_jd,
            parsed_resume=payload.parsed_resume,
            interview_type=payload.interview_type,
            include_coding=payload.include_coding,
            coding_language=payload.coding_language,
            max_questions=payload.max_questions,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/plan/multi-round")
async def create_multi_round_plan(payload: PlanRequest):
    """Generate a multi-round interview plan with structured rounds.

    Returns the full plan including round structure, seniority inference,
    and initial interview state.
    """
    try:
        plan = generate_interview_plan(
            parsed_jd=payload.parsed_jd,
            parsed_resume=payload.parsed_resume,
            interview_type=payload.interview_type,
            include_coding=payload.include_coding,
            coding_language=payload.coding_language,
            max_questions=payload.max_questions,
        )
        initial_state = create_initial_interview_state()
        # Set initial round type from plan
        if plan.get("rounds"):
            initial_state["current_round_type"] = plan["rounds"][0].get("type", "screening")
        return {
            "plan": plan,
            "interview_state": initial_state,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/respond")
async def interviewer_respond(payload: RespondRequest):
    """Process candidate answer and return next AI interviewer message.

    If stream=true, returns SSE stream. Otherwise returns JSON.
    Uses legacy (non-adaptive) mode.
    """
    try:
        if payload.stream:
            stream = generate_interviewer_response_stream(
                conversation_history=payload.conversation_history,
                current_question=payload.current_question,
                questions_plan=payload.questions_plan,
                parsed_jd=payload.parsed_jd,
                parsed_resume=payload.parsed_resume,
                interview_type=payload.interview_type,
                max_questions=payload.max_questions,
            )

            async def event_generator():
                collected = ""
                for chunk in stream:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        collected += delta
                        yield f"data: {json.dumps({'chunk': delta})}\n\n"
                try:
                    parsed = json.loads(collected)
                except json.JSONDecodeError:
                    parsed = {"message": collected, "message_type": "question", "move_to_next": True, "code_prompt": None}
                yield f"data: {json.dumps({'done': True, 'full_response': parsed})}\n\n"

            return StreamingResponse(event_generator(), media_type="text/event-stream")

        result = generate_interviewer_response(
            conversation_history=payload.conversation_history,
            current_question=payload.current_question,
            questions_plan=payload.questions_plan,
            parsed_jd=payload.parsed_jd,
            parsed_resume=payload.parsed_resume,
            interview_type=payload.interview_type,
            max_questions=payload.max_questions,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/respond/adaptive")
async def adaptive_interviewer_respond(payload: AdaptiveRespondRequest):
    """Adaptive interviewer response with state tracking and difficulty adjustment.

    Returns the AI response plus updated interview_state for the next turn.
    """
    try:
        if payload.stream:
            stream = generate_adaptive_response_stream(
                conversation_history=payload.conversation_history,
                current_question=payload.current_question,
                interview_plan=payload.interview_plan,
                interview_state=payload.interview_state,
                parsed_jd=payload.parsed_jd,
                parsed_resume=payload.parsed_resume,
                interview_type=payload.interview_type,
                max_questions=payload.max_questions,
            )

            # Streaming for adaptive mode works the same as legacy
            if isinstance(stream, str):
                # Non-OpenAI fallback
                try:
                    parsed = json.loads(stream)
                except json.JSONDecodeError:
                    parsed = {"message": stream, "message_type": "question", "move_to_next": True}
                return parsed

            async def event_generator():
                collected = ""
                for chunk in stream:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        collected += delta
                        yield f"data: {json.dumps({'chunk': delta})}\n\n"
                try:
                    parsed = json.loads(collected)
                except json.JSONDecodeError:
                    parsed = {"message": collected, "message_type": "question", "move_to_next": True}
                yield f"data: {json.dumps({'done': True, 'full_response': parsed})}\n\n"

            return StreamingResponse(event_generator(), media_type="text/event-stream")

        result = generate_adaptive_response(
            conversation_history=payload.conversation_history,
            current_question=payload.current_question,
            interview_plan=payload.interview_plan,
            interview_state=payload.interview_state,
            parsed_jd=payload.parsed_jd,
            parsed_resume=payload.parsed_resume,
            interview_type=payload.interview_type,
            max_questions=payload.max_questions,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate")
async def evaluate_interview(payload: EvaluateRequest):
    """Generate final evaluation from the full interview transcript (legacy mode)."""
    try:
        result = generate_final_evaluation(
            transcript=payload.transcript,
            parsed_jd=payload.parsed_jd,
            parsed_resume=payload.parsed_resume,
            questions_plan=payload.questions_plan,
            proctoring_summary=payload.proctoring_summary,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate/deep")
async def deep_evaluate_interview(payload: DeepEvaluateRequest):
    """Generate comprehensive multi-dimensional evaluation.

    Uses the enhanced evaluation engine with 10 scoring dimensions,
    round-by-round summaries, and structured hire recommendation.
    """
    try:
        result = generate_deep_evaluation(
            transcript=payload.transcript,
            parsed_jd=payload.parsed_jd,
            parsed_resume=payload.parsed_resume,
            interview_plan=payload.interview_plan,
            interview_state=payload.interview_state,
            proctoring_summary=payload.proctoring_summary,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/eval-code")
async def eval_code(payload: CodeEvalRequest):
    """Evaluate a code submission for a coding challenge."""
    try:
        result = evaluate_code_submission(
            code=payload.code,
            language=payload.language,
            problem_description=payload.problem_description,
            expected_approach=payload.expected_approach,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/report")
async def generate_report(payload: ReportRequest):
    """Generate a structured recruiter-friendly hiring report."""
    try:
        result = generate_recruiter_report(
            evaluation=payload.evaluation,
            parsed_jd=payload.parsed_jd,
            parsed_resume=payload.parsed_resume,
            transcript=payload.transcript,
            interview_plan=payload.interview_plan,
            proctoring_summary=payload.proctoring_summary,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
