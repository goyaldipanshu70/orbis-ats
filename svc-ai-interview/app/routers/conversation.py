"""Endpoints for live AI interview conversation."""
import json
import traceback

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional

from app.services.conversation_service import (
    generate_question_plan,
    generate_interviewer_response,
    generate_interviewer_response_stream,
    generate_final_evaluation,
    evaluate_code_submission,
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


class EvaluateRequest(BaseModel):
    transcript: list
    parsed_jd: dict
    parsed_resume: dict
    questions_plan: dict
    proctoring_summary: dict = Field(default_factory=dict)


class CodeEvalRequest(BaseModel):
    code: str
    language: str
    problem_description: str
    expected_approach: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────────────


@router.post("/plan")
async def create_question_plan(payload: PlanRequest):
    """Generate a question plan from JD + resume context."""
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


@router.post("/respond")
async def interviewer_respond(payload: RespondRequest):
    """Process candidate answer and return next AI interviewer message.

    If stream=true, returns SSE stream. Otherwise returns JSON.
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
                # Send full response at end
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


@router.post("/evaluate")
async def evaluate_interview(payload: EvaluateRequest):
    """Generate final evaluation from the full interview transcript."""
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
