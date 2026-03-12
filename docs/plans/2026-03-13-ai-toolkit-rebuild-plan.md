# AI Toolkit Full Rebuild — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the standalone AI Toolkit page with 7 contextually embedded AI features across the app, all routed through svc-ai-orchestrator with backend caching.

**Architecture:** New LangGraph workflows in svc-ai-orchestrator for each AI feature. Results cached as JSONB columns on existing svc-recruiting tables. Frontend embeds AI components inline on Job, Candidate, and Interview pages. Old standalone AI Toolkit page deleted.

**Tech Stack:** Python/FastAPI/LangGraph/SQLAlchemy (backend), React/TypeScript/TanStack Query (frontend), PostgreSQL JSONB (caching)

---

## Task 1: Database Schema — Add JSONB Columns to Existing Tables

**Files:**
- Create: `svc-recruiting/alembic/versions/xxxx_add_ai_cache_columns.py`
- Modify: `svc-recruiting/app/db/models.py:12` (JobDescription), `:113` (CandidateJobEntry), `:226` (InterviewSchedule)

**Step 1: Add columns to SQLAlchemy models**

In `svc-recruiting/app/db/models.py`, add to the `JobDescription` class (around line 12):
```python
ai_generated_jd = Column(JSONB, nullable=True)
ai_bias_check = Column(JSONB, nullable=True)
ai_salary_estimate = Column(JSONB, nullable=True)
```

Add to the `CandidateJobEntry` class (around line 113):
```python
ai_fit_summary = Column(JSONB, nullable=True)
ai_ranking_score = Column(JSONB, nullable=True)
ai_skills_gap = Column(JSONB, nullable=True)
```

Add to the `InterviewSchedule` class (around line 226):
```python
ai_suggested_questions = Column(JSONB, nullable=True)
```

**Step 2: Generate and run Alembic migration**

```bash
cd svc-recruiting
alembic revision --autogenerate -m "add AI cache JSONB columns"
alembic upgrade head
```

**Step 3: Verify migration**

```bash
cd svc-recruiting
python -c "from app.db.models import JobDescription, CandidateJobEntry, InterviewSchedule; print('Models OK')"
```

**Step 4: Commit**

```bash
git add svc-recruiting/app/db/models.py svc-recruiting/alembic/versions/
git commit -m "feat(db): add JSONB columns for AI result caching"
```

---

## Task 2: Orchestrator — JD Generation Workflow

**Files:**
- Create: `svc-ai-orchestrator/app/schemas/jd_state.py`
- Create: `svc-ai-orchestrator/app/nodes/jd/generator.py`
- Create: `svc-ai-orchestrator/app/graphs/jd_generation.py`
- Create: `svc-ai-orchestrator/app/routers/jd.py`
- Modify: `svc-ai-orchestrator/main.py:26-31` (register new router)

**Step 1: Create the state schema**

Create `svc-ai-orchestrator/app/schemas/jd_state.py`:
```python
"""State for JD generation workflow."""
from typing import TypedDict, Optional

class JDGenerationState(TypedDict, total=False):
    job_title: str
    department: Optional[str]
    seniority: Optional[str]
    location: Optional[str]
    additional_context: Optional[str]
    generated_jd: Optional[dict]
    error: Optional[str]
    execution_id: str
```

**Step 2: Create the generator node**

Create `svc-ai-orchestrator/app/nodes/jd/generator.py`:
```python
"""Node that generates a structured job description from a title and context."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert HR professional and technical writer. Generate a comprehensive, inclusive job description.

Return ONLY valid JSON with this exact structure:
{
  "summary": "2-3 sentence role overview",
  "responsibilities": ["responsibility 1", "responsibility 2", ...],
  "requirements": ["requirement 1", "requirement 2", ...],
  "qualifications": ["preferred qualification 1", ...],
  "benefits": ["benefit 1", "benefit 2", ...]
}

Guidelines:
- Use gender-neutral language throughout
- Be specific about the role, not generic
- Requirements should be genuinely necessary, not aspirational
- Include 6-10 responsibilities, 5-8 requirements, 3-5 qualifications, 4-6 benefits
"""

@logged_node("jd_generation", "generate_jd")
async def generate_jd(state: dict) -> dict:
    """Generate a structured job description."""
    title = state["job_title"]
    dept = state.get("department", "")
    seniority = state.get("seniority", "")
    location = state.get("location", "")
    context = state.get("additional_context", "")

    user_prompt = f"Generate a job description for: {title}"
    if dept:
        user_prompt += f"\nDepartment: {dept}"
    if seniority:
        user_prompt += f"\nSeniority: {seniority}"
    if location:
        user_prompt += f"\nLocation: {location}"
    if context:
        user_prompt += f"\nAdditional context: {context}"

    llm = get_llm_for_workflow("jd_generation", temperature=0.4)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    response = await llm.ainvoke(messages)

    try:
        content = response.content
        # Try to extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        generated = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Failed to parse JD response: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    return {"generated_jd": generated}
```

**Step 3: Create the graph**

Create `svc-ai-orchestrator/app/graphs/jd_generation.py`:
```python
"""LangGraph workflow for JD generation."""
from langgraph.graph import StateGraph, END
from app.schemas.jd_state import JDGenerationState
from app.nodes.jd.generator import generate_jd

def build_jd_generation_graph():
    graph = StateGraph(JDGenerationState)
    graph.add_node("generate_jd", generate_jd)
    graph.set_entry_point("generate_jd")
    graph.add_edge("generate_jd", END)
    return graph.compile()
```

**Step 4: Create the router**

Create `svc-ai-orchestrator/app/routers/jd.py`:
```python
"""JD generation and bias check endpoints."""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.auth import get_current_user
from app.graphs.jd_generation import build_jd_generation_graph
from app.shared.graph_logging import create_execution_log

logger = logging.getLogger(__name__)
router = APIRouter()

class JDGenerateRequest(BaseModel):
    job_title: str
    department: Optional[str] = None
    seniority: Optional[str] = None
    location: Optional[str] = None
    additional_context: Optional[str] = None

class JDGenerateResponse(BaseModel):
    summary: str
    responsibilities: list[str]
    requirements: list[str]
    qualifications: list[str]
    benefits: list[str]
    generated_at: str
    execution_id: Optional[str] = None

@router.post("/generate", response_model=JDGenerateResponse)
async def generate_jd_endpoint(
    req: JDGenerateRequest,
    user=Depends(get_current_user),
):
    """Generate a job description from a title and optional context."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    graph = build_jd_generation_graph()
    result = await graph.ainvoke({
        "job_title": req.job_title,
        "department": req.department,
        "seniority": req.seniority,
        "location": req.location,
        "additional_context": req.additional_context,
    })

    if result.get("error"):
        raise HTTPException(500, result["error"])

    jd = result["generated_jd"]
    return JDGenerateResponse(
        summary=jd.get("summary", ""),
        responsibilities=jd.get("responsibilities", []),
        requirements=jd.get("requirements", []),
        qualifications=jd.get("qualifications", []),
        benefits=jd.get("benefits", []),
        generated_at=datetime.now(timezone.utc).isoformat(),
        execution_id=result.get("execution_id"),
    )
```

**Step 5: Register the router**

In `svc-ai-orchestrator/main.py`, add after line 31:
```python
from app.routers import jd
app.include_router(jd.router, prefix="/api/orchestrator/jd", tags=["JD Generation"])
```

**Step 6: Test manually**

```bash
cd svc-ai-orchestrator
uvicorn main:app --port 8014 --reload &
curl -X POST http://localhost:8014/api/orchestrator/jd/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"job_title": "Senior Software Engineer", "department": "Engineering"}'
```

**Step 7: Commit**

```bash
git add svc-ai-orchestrator/app/schemas/jd_state.py \
       svc-ai-orchestrator/app/nodes/jd/ \
       svc-ai-orchestrator/app/graphs/jd_generation.py \
       svc-ai-orchestrator/app/routers/jd.py \
       svc-ai-orchestrator/main.py
git commit -m "feat(orchestrator): add JD generation workflow"
```

---

## Task 3: Orchestrator — JD Bias Check Workflow

**Files:**
- Modify: `svc-ai-orchestrator/app/schemas/jd_state.py`
- Create: `svc-ai-orchestrator/app/nodes/jd/bias_checker.py`
- Create: `svc-ai-orchestrator/app/graphs/jd_bias_check.py`
- Modify: `svc-ai-orchestrator/app/routers/jd.py`

**Step 1: Add bias check state to jd_state.py**

```python
class JDBiasCheckState(TypedDict, total=False):
    text: str
    score: Optional[int]
    flags: Optional[list]
    error: Optional[str]
    execution_id: str
```

**Step 2: Create the bias checker node**

Create `svc-ai-orchestrator/app/nodes/jd/bias_checker.py`:
```python
"""Node that analyzes job description text for biased language."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert in inclusive language and DEI in hiring. Analyze the job description for biased language.

Check for:
- Gendered language (e.g., "rockstar", "ninja", "he/his", "manpower")
- Age bias (e.g., "young and energetic", "digital native", "recent graduate")
- Ability bias (e.g., "must be able to stand", unnecessary physical requirements)
- Exclusionary language (e.g., "native English speaker", "culture fit")
- Unnecessarily aggressive tone (e.g., "crush it", "war room", "killer instinct")

Return ONLY valid JSON:
{
  "score": 85,
  "flags": [
    {
      "phrase": "the exact phrase found",
      "type": "gendered|age|ability|exclusionary|aggressive",
      "suggestion": "suggested replacement phrase",
      "start": 0,
      "end": 10
    }
  ]
}

Score: 100 = perfectly inclusive, 0 = heavily biased. Deduct ~5 points per flag.
If no issues found, return {"score": 100, "flags": []}.
"""

@logged_node("jd_bias_check", "analyze_bias")
async def analyze_bias(state: dict) -> dict:
    """Analyze text for biased language."""
    text = state["text"]
    if not text or len(text.strip()) < 20:
        return {"score": 100, "flags": []}

    llm = get_llm_for_workflow("jd_bias_check", temperature=0.1)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyze this job description:\n\n{text}"},
    ]
    response = await llm.ainvoke(messages)

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        result = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Failed to parse bias check response: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    return {
        "score": result.get("score", 100),
        "flags": result.get("flags", []),
    }
```

**Step 3: Create the graph**

Create `svc-ai-orchestrator/app/graphs/jd_bias_check.py`:
```python
"""LangGraph workflow for JD bias detection."""
from langgraph.graph import StateGraph, END
from app.schemas.jd_state import JDBiasCheckState
from app.nodes.jd.bias_checker import analyze_bias

def build_jd_bias_check_graph():
    graph = StateGraph(JDBiasCheckState)
    graph.add_node("analyze_bias", analyze_bias)
    graph.set_entry_point("analyze_bias")
    graph.add_edge("analyze_bias", END)
    return graph.compile()
```

**Step 4: Add endpoint to jd.py router**

Add to `svc-ai-orchestrator/app/routers/jd.py`:
```python
from app.graphs.jd_bias_check import build_jd_bias_check_graph

class BiasCheckRequest(BaseModel):
    text: str

class BiasFlag(BaseModel):
    phrase: str
    type: str
    suggestion: str
    start: int = 0
    end: int = 0

class BiasCheckResponse(BaseModel):
    score: int
    flags: list[BiasFlag]
    checked_at: str

@router.post("/bias-check", response_model=BiasCheckResponse)
async def bias_check_endpoint(
    req: BiasCheckRequest,
    user=Depends(get_current_user),
):
    """Check job description text for biased language."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    graph = build_jd_bias_check_graph()
    result = await graph.ainvoke({"text": req.text})

    if result.get("error"):
        raise HTTPException(500, result["error"])

    return BiasCheckResponse(
        score=result.get("score", 100),
        flags=[BiasFlag(**f) for f in result.get("flags", [])],
        checked_at=datetime.now(timezone.utc).isoformat(),
    )
```

**Step 5: Commit**

```bash
git add svc-ai-orchestrator/app/schemas/jd_state.py \
       svc-ai-orchestrator/app/nodes/jd/bias_checker.py \
       svc-ai-orchestrator/app/graphs/jd_bias_check.py \
       svc-ai-orchestrator/app/routers/jd.py
git commit -m "feat(orchestrator): add JD bias check workflow"
```

---

## Task 4: Orchestrator — Candidate Fit Summary Workflow

**Files:**
- Create: `svc-ai-orchestrator/app/schemas/candidate_state.py`
- Create: `svc-ai-orchestrator/app/nodes/candidate/context_gatherer.py`
- Create: `svc-ai-orchestrator/app/nodes/candidate/fit_analyzer.py`
- Create: `svc-ai-orchestrator/app/graphs/candidate_fit.py`
- Create: `svc-ai-orchestrator/app/routers/candidate.py`
- Modify: `svc-ai-orchestrator/main.py`

**Step 1: Create candidate state schema**

Create `svc-ai-orchestrator/app/schemas/candidate_state.py`:
```python
"""State schemas for candidate AI workflows."""
from typing import TypedDict, Optional

class CandidateFitState(TypedDict, total=False):
    candidate_id: int
    jd_id: int
    # Gathered context
    job_context: Optional[dict]
    candidate_context: Optional[dict]
    resume_analysis: Optional[dict]
    interview_scores: Optional[dict]
    screening_data: Optional[dict]
    # Output
    fit_summary: Optional[dict]
    error: Optional[str]
    execution_id: str

class CandidateRankingState(TypedDict, total=False):
    jd_id: int
    # Gathered context
    job_context: Optional[dict]
    candidates: Optional[list]
    # Output
    rankings: Optional[list]
    error: Optional[str]
    execution_id: str

class SkillsGapState(TypedDict, total=False):
    candidate_id: int
    jd_id: int
    required_skills: Optional[list]
    candidate_skills: Optional[list]
    # Output
    skills_gap: Optional[dict]
    error: Optional[str]
    execution_id: str
```

**Step 2: Create context gatherer node**

Create `svc-ai-orchestrator/app/nodes/candidate/context_gatherer.py`:

This node queries the recruiting DB to gather all relevant data for a candidate-job pair. Follow the existing pattern in `svc-ai-orchestrator/app/tools/hiring_tools.py` for DB access via `_models_cache()`.

```python
"""Gather candidate and job context from recruiting DB."""
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


async def gather_candidate_context(db: AsyncSession, candidate_id: int, jd_id: int) -> dict:
    """Fetch all relevant data for a candidate-job pair from recruiting DB."""
    from app.tools.hiring_tools import _models_cache
    m = _models_cache()

    CandidateJobEntry = m["CandidateJobEntry"]
    CandidateProfile = m["CandidateProfile"]
    JobDescription = m["JobDescription"]
    InterviewEvaluation = m["InterviewEvaluation"]
    InterviewerFeedback = m["InterviewerFeedback"]
    InterviewSchedule = m["InterviewSchedule"]
    ScreeningQuestion = m["ScreeningQuestion"]
    ScreeningResponse = m["ScreeningResponse"]

    # Candidate entry + profile
    entry_result = await db.execute(
        select(CandidateJobEntry).where(
            CandidateJobEntry.id == candidate_id,
            CandidateJobEntry.jd_id == jd_id,
        )
    )
    entry = entry_result.scalar_one_or_none()
    if not entry:
        return {"error": f"Candidate {candidate_id} not found for job {jd_id}"}

    profile = None
    if entry.profile_id:
        profile_result = await db.execute(
            select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
        )
        profile = profile_result.scalar_one_or_none()

    # Job description
    jd_result = await db.execute(select(JobDescription).where(JobDescription.id == jd_id))
    jd = jd_result.scalar_one_or_none()
    if not jd:
        return {"error": f"Job {jd_id} not found"}

    ai_result = jd.ai_result if isinstance(jd.ai_result, dict) else {}

    # Interview evaluations — filtered by jd_id
    eval_result = await db.execute(
        select(InterviewEvaluation).where(
            InterviewEvaluation.candidate_id == candidate_id,
            InterviewEvaluation.jd_id == jd_id,
        )
    )
    evaluations = eval_result.scalars().all()

    # Interviewer feedback — filtered by job's interview schedules
    schedule_result = await db.execute(
        select(InterviewSchedule.id).where(
            InterviewSchedule.candidate_id == candidate_id,
            InterviewSchedule.jd_id == jd_id,
        )
    )
    schedule_ids = [s.id for s in schedule_result.scalars().all()]
    feedback_list = []
    if schedule_ids:
        fb_result = await db.execute(
            select(InterviewerFeedback).where(
                InterviewerFeedback.schedule_id.in_(schedule_ids)
            )
        )
        feedback_list = fb_result.scalars().all()

    # Screening — filtered by this job's questions
    sq_result = await db.execute(
        select(ScreeningQuestion).where(ScreeningQuestion.jd_id == jd_id)
    )
    questions = sq_result.scalars().all()
    question_ids = [q.id for q in questions]

    responses = []
    if question_ids:
        sr_result = await db.execute(
            select(ScreeningResponse).where(
                ScreeningResponse.candidate_id == candidate_id,
                ScreeningResponse.question_id.in_(question_ids),
            )
        )
        responses = sr_result.scalars().all()

    return {
        "job_context": {
            "title": ai_result.get("job_title", "Unknown"),
            "rubric": ai_result.get("extracted_rubric", {}),
            "core_skills": ai_result.get("extracted_rubric", {}).get("core_skills", []),
            "preferred_skills": ai_result.get("extracted_rubric", {}).get("preferred_skills", []),
        },
        "candidate_context": {
            "name": profile.full_name if profile else "Unknown",
            "email": profile.email if profile else "",
        },
        "resume_analysis": entry.ai_resume_analysis if isinstance(entry.ai_resume_analysis, dict) else {},
        "interview_scores": {
            "evaluations": [
                {
                    "score": e.ai_interview_result.get("score_breakdown", {}) if isinstance(e.ai_interview_result, dict) else {},
                    "recommendation": e.ai_interview_result.get("recommendation", "") if isinstance(e.ai_interview_result, dict) else "",
                }
                for e in evaluations
            ],
            "feedback": [
                {"rating": f.rating, "notes": f.notes or ""}
                for f in feedback_list
            ],
        },
        "screening_data": {
            "questions": [{"id": q.id, "question": q.question, "type": q.question_type} for q in questions],
            "responses": [{"question_id": r.question_id, "response": r.response} for r in responses],
        },
    }
```

**Step 3: Create fit analyzer node**

Create `svc-ai-orchestrator/app/nodes/candidate/fit_analyzer.py`:
```python
"""Node that generates a candidate fit summary using LLM."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior recruiter analyzing a candidate's fit for a specific job.

Given the job requirements, candidate resume analysis, interview results, and screening responses, provide a structured assessment.

Return ONLY valid JSON:
{
  "rating": "Strong|Good|Moderate|Weak",
  "strengths": [
    {"point": "specific strength", "evidence": "evidence from their resume/interviews"}
  ],
  "concerns": ["specific concern 1", "specific concern 2"],
  "recommendation": "2-3 sentence recommendation for the hiring team"
}

Be specific and cite evidence. Max 5 strengths, 3 concerns.
"""

@logged_node("candidate_fit", "analyze_fit")
async def analyze_fit(state: dict) -> dict:
    """Generate candidate fit summary."""
    job = state.get("job_context", {})
    resume = state.get("resume_analysis", {})
    interviews = state.get("interview_scores", {})
    screening = state.get("screening_data", {})
    candidate = state.get("candidate_context", {})

    if not resume:
        return {"error": "No resume analysis available for this candidate"}

    user_prompt = f"""Analyze this candidate's fit:

**Job:** {job.get('title', 'Unknown')}
**Core Skills Required:** {', '.join(job.get('core_skills', []))}
**Preferred Skills:** {', '.join(job.get('preferred_skills', []))}

**Candidate:** {candidate.get('name', 'Unknown')}
**Resume Highlights:** {json.dumps(resume.get('highlighted_skills', []))}
**Resume Score:** {resume.get('category_scores', {}).get('total_score', 'N/A')}
**Resume Summary:** {resume.get('metadata', {}).get('summary', 'N/A')}

**Interview Evaluations:** {json.dumps(interviews.get('evaluations', [])[:3])}
**Interviewer Feedback:** {json.dumps(interviews.get('feedback', [])[:5])}

**Screening:** {len(screening.get('responses', []))} of {len(screening.get('questions', []))} questions answered
"""

    llm = get_llm_for_workflow("candidate_fit", temperature=0.2)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    response = await llm.ainvoke(messages)

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        summary = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Failed to parse fit summary: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    return {"fit_summary": summary}
```

**Step 4: Create the graph**

Create `svc-ai-orchestrator/app/graphs/candidate_fit.py`:
```python
"""LangGraph workflow for candidate fit summary."""
from langgraph.graph import StateGraph, END
from app.schemas.candidate_state import CandidateFitState
from app.nodes.candidate.fit_analyzer import analyze_fit

def build_candidate_fit_graph():
    graph = StateGraph(CandidateFitState)
    graph.add_node("analyze_fit", analyze_fit)
    graph.set_entry_point("analyze_fit")
    graph.add_edge("analyze_fit", END)
    return graph.compile()
```

**Step 5: Create the candidate router**

Create `svc-ai-orchestrator/app/routers/candidate.py`:
```python
"""Candidate AI endpoints — fit summary, ranking, skills gap."""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.auth import get_current_user
from app.db.postgres import get_recruiting_db
from app.graphs.candidate_fit import build_candidate_fit_graph
from app.nodes.candidate.context_gatherer import gather_candidate_context

logger = logging.getLogger(__name__)
router = APIRouter()

class FitSummaryRequest(BaseModel):
    candidate_id: int
    jd_id: int

class StrengthItem(BaseModel):
    point: str
    evidence: str

class FitSummaryResponse(BaseModel):
    rating: str
    strengths: list[StrengthItem]
    concerns: list[str]
    recommendation: str
    generated_at: str

@router.post("/fit-summary", response_model=FitSummaryResponse)
async def fit_summary_endpoint(
    req: FitSummaryRequest,
    user=Depends(get_current_user),
):
    """Generate a candidate fit summary for a specific job."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    async for db in get_recruiting_db():
        context = await gather_candidate_context(db, req.candidate_id, req.jd_id)

    if context.get("error"):
        raise HTTPException(404, context["error"])

    graph = build_candidate_fit_graph()
    result = await graph.ainvoke(context)

    if result.get("error"):
        raise HTTPException(500, result["error"])

    summary = result["fit_summary"]
    return FitSummaryResponse(
        rating=summary.get("rating", "Moderate"),
        strengths=[StrengthItem(**s) for s in summary.get("strengths", [])],
        concerns=summary.get("concerns", []),
        recommendation=summary.get("recommendation", ""),
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
```

**Step 6: Register router**

In `svc-ai-orchestrator/main.py`, add:
```python
from app.routers import candidate
app.include_router(candidate.router, prefix="/api/orchestrator/candidate", tags=["Candidate AI"])
```

**Step 7: Commit**

```bash
git add svc-ai-orchestrator/app/schemas/candidate_state.py \
       svc-ai-orchestrator/app/nodes/candidate/ \
       svc-ai-orchestrator/app/graphs/candidate_fit.py \
       svc-ai-orchestrator/app/routers/candidate.py \
       svc-ai-orchestrator/main.py
git commit -m "feat(orchestrator): add candidate fit summary workflow"
```

---

## Task 5: Orchestrator — Candidate Ranking Workflow

**Files:**
- Create: `svc-ai-orchestrator/app/nodes/candidate/ranker.py`
- Create: `svc-ai-orchestrator/app/graphs/candidate_ranking.py`
- Modify: `svc-ai-orchestrator/app/routers/candidate.py`

**Step 1: Create the ranker node**

Create `svc-ai-orchestrator/app/nodes/candidate/ranker.py`:

This node computes ranking scores for all candidates in a job. It fixes the audit bugs:
- Interview scores filtered by `jd_id`
- Screening responses filtered by job's questions only
- Uses LLM to assess screening response quality (not just completion rate)

```python
"""Node that ranks candidates for a job using composite scoring."""
import json
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


async def compute_rankings(db: AsyncSession, jd_id: int) -> list[dict]:
    """Compute ranking scores for all candidates in a job."""
    from app.tools.hiring_tools import _models_cache
    m = _models_cache()

    CandidateJobEntry = m["CandidateJobEntry"]
    CandidateProfile = m["CandidateProfile"]
    JobDescription = m["JobDescription"]
    InterviewEvaluation = m["InterviewEvaluation"]
    InterviewerFeedback = m["InterviewerFeedback"]
    InterviewSchedule = m["InterviewSchedule"]
    ScreeningQuestion = m["ScreeningQuestion"]
    ScreeningResponse = m["ScreeningResponse"]

    # Get job info
    jd_result = await db.execute(select(JobDescription).where(JobDescription.id == jd_id))
    jd = jd_result.scalar_one_or_none()
    if not jd:
        return []

    # Get all active candidates for this job
    entries_result = await db.execute(
        select(CandidateJobEntry).where(
            CandidateJobEntry.jd_id == jd_id,
            CandidateJobEntry.deleted_at.is_(None),
        )
    )
    entries = entries_result.scalars().all()
    if not entries:
        return []

    # Get screening questions for THIS job
    sq_result = await db.execute(
        select(ScreeningQuestion).where(ScreeningQuestion.jd_id == jd_id)
    )
    job_questions = sq_result.scalars().all()
    question_ids = [q.id for q in job_questions]
    total_questions = len(job_questions)

    rankings = []
    for entry in entries:
        # Profile
        profile = None
        if entry.profile_id:
            p_result = await db.execute(
                select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
            )
            profile = p_result.scalar_one_or_none()

        # Resume score
        resume_score = 0.0
        ai = entry.ai_resume_analysis if isinstance(entry.ai_resume_analysis, dict) else {}
        total = ai.get("category_scores", {}).get("total_score", 0)
        if isinstance(total, dict):
            resume_score = min(float(total.get("obtained_score", 0)), 100.0)
        elif total:
            resume_score = min(float(total), 100.0)

        # Interview score — FIXED: filter by jd_id
        interview_score = 0.0
        eval_result = await db.execute(
            select(InterviewEvaluation).where(
                InterviewEvaluation.candidate_id == entry.id,
                InterviewEvaluation.jd_id == jd_id,
            )
        )
        evals = eval_result.scalars().all()
        if evals:
            scores = []
            for ev in evals:
                air = ev.ai_interview_result if isinstance(ev.ai_interview_result, dict) else {}
                ts = air.get("score_breakdown", {}).get("total_score", 0)
                if isinstance(ts, dict):
                    scores.append(min(float(ts.get("obtained_score", 0)), 100.0))
                elif ts:
                    scores.append(min(float(ts), 100.0))
            if scores:
                interview_score = sum(scores) / len(scores)

        # Feedback score — FIXED: filter by job's schedules
        feedback_score = 0.0
        sched_result = await db.execute(
            select(InterviewSchedule.id).where(
                InterviewSchedule.candidate_id == entry.id,
                InterviewSchedule.jd_id == jd_id,
            )
        )
        sched_ids = [s.id for s in sched_result.scalars().all()]
        if sched_ids:
            fb_result = await db.execute(
                select(func.avg(InterviewerFeedback.rating)).where(
                    InterviewerFeedback.schedule_id.in_(sched_ids)
                )
            )
            avg_rating = fb_result.scalar()
            if avg_rating:
                feedback_score = float(avg_rating) * 20  # 1-5 -> 20-100

        # Screening score — FIXED: filter by job's questions, quality not just completion
        screening_score = 0.0
        if question_ids:
            sr_result = await db.execute(
                select(ScreeningResponse).where(
                    ScreeningResponse.candidate_id == entry.id,
                    ScreeningResponse.question_id.in_(question_ids),
                )
            )
            responses = sr_result.scalars().all()
            if responses and total_questions > 0:
                # Completion component (50% of screening score)
                completion = (len(responses) / total_questions) * 100
                # Quality component (50%) — word count heuristic for now, LLM scoring in screening scorer
                quality_scores = []
                for r in responses:
                    resp_text = r.response or ""
                    words = len(resp_text.split())
                    if words >= 50:
                        quality_scores.append(100)
                    elif words >= 20:
                        quality_scores.append(70)
                    elif words >= 5:
                        quality_scores.append(40)
                    else:
                        quality_scores.append(10)
                avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
                screening_score = (completion * 0.5) + (avg_quality * 0.5)

        # Composite: resume 40%, interview 30%, feedback 20%, screening 10%
        composite = (
            resume_score * 0.4 +
            interview_score * 0.3 +
            feedback_score * 0.2 +
            screening_score * 0.1
        )

        rankings.append({
            "candidate_id": entry.id,
            "candidate_name": profile.full_name if profile else "Unknown",
            "composite": round(composite, 1),
            "breakdown": {
                "resume": round(resume_score, 1),
                "interview": round(interview_score, 1),
                "feedback": round(feedback_score, 1),
                "screening": round(screening_score, 1),
            },
            "weights": {"resume": 0.4, "interview": 0.3, "feedback": 0.2, "screening": 0.1},
        })

    # Sort by composite descending
    rankings.sort(key=lambda x: x["composite"], reverse=True)

    # Assign ranks
    for i, r in enumerate(rankings):
        r["rank"] = i + 1

    return rankings
```

**Step 2: Create the graph**

Create `svc-ai-orchestrator/app/graphs/candidate_ranking.py`:
```python
"""LangGraph workflow for candidate ranking."""
from langgraph.graph import StateGraph, END
from app.schemas.candidate_state import CandidateRankingState
from app.shared.graph_logging import logged_node

@logged_node("candidate_ranking", "compute_rankings")
async def compute_rankings_node(state: dict) -> dict:
    """Wrapper node that calls compute_rankings with DB session."""
    from app.db.postgres import get_recruiting_db
    from app.nodes.candidate.ranker import compute_rankings
    async for db in get_recruiting_db():
        rankings = await compute_rankings(db, state["jd_id"])
    return {"rankings": rankings}

def build_candidate_ranking_graph():
    graph = StateGraph(CandidateRankingState)
    graph.add_node("compute_rankings", compute_rankings_node)
    graph.set_entry_point("compute_rankings")
    graph.add_edge("compute_rankings", END)
    return graph.compile()
```

**Step 3: Add ranking endpoint to candidate router**

Add to `svc-ai-orchestrator/app/routers/candidate.py`:
```python
from app.graphs.candidate_ranking import build_candidate_ranking_graph

class RankRequest(BaseModel):
    jd_id: int

class RankingItem(BaseModel):
    candidate_id: int
    candidate_name: str
    rank: int
    composite: float
    breakdown: dict
    weights: dict

class RankResponse(BaseModel):
    rankings: list[RankingItem]
    ranked_at: str

@router.post("/rank", response_model=RankResponse)
async def rank_candidates_endpoint(
    req: RankRequest,
    user=Depends(get_current_user),
):
    """Rank all candidates for a job."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    graph = build_candidate_ranking_graph()
    result = await graph.ainvoke({"jd_id": req.jd_id})

    if result.get("error"):
        raise HTTPException(500, result["error"])

    return RankResponse(
        rankings=[RankingItem(**r) for r in result.get("rankings", [])],
        ranked_at=datetime.now(timezone.utc).isoformat(),
    )
```

**Step 4: Commit**

```bash
git add svc-ai-orchestrator/app/nodes/candidate/ranker.py \
       svc-ai-orchestrator/app/graphs/candidate_ranking.py \
       svc-ai-orchestrator/app/routers/candidate.py
git commit -m "feat(orchestrator): add candidate ranking workflow with scoping fixes"
```

---

## Task 6: Orchestrator — Semantic Skills Gap Workflow

**Files:**
- Create: `svc-ai-orchestrator/app/nodes/candidate/skills_gap.py`
- Create: `svc-ai-orchestrator/app/graphs/skills_gap.py`
- Modify: `svc-ai-orchestrator/app/routers/candidate.py`

**Step 1: Create the skills gap node**

Create `svc-ai-orchestrator/app/nodes/candidate/skills_gap.py`:
```python
"""Node that performs semantic skill matching using LLM."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a technical recruiter expert at matching candidate skills to job requirements.

Given a list of REQUIRED skills (from the job) and CANDIDATE skills (from their resume), determine which required skills the candidate has — even if phrased differently.

For example:
- "project management" matches "program leadership" (confidence: 0.85)
- "Linux" matches "Ubuntu" (confidence: 0.90)
- "React" matches "React.js" (confidence: 1.0)
- "machine learning" does NOT match "data entry" (no match)

Return ONLY valid JSON:
{
  "matched": [
    {"required_skill": "React", "candidate_skill": "React.js", "confidence": 1.0},
    {"required_skill": "project management", "candidate_skill": "program leadership", "confidence": 0.85}
  ],
  "missing": ["skill not found in candidate"],
  "bonus": ["candidate skill not in requirements but valuable"]
}

Only match with confidence >= 0.6. Be accurate — do not force matches.
"""

@logged_node("skills_gap", "semantic_match")
async def semantic_match(state: dict) -> dict:
    """Perform semantic skill matching."""
    required = state.get("required_skills", [])
    candidate = state.get("candidate_skills", [])

    if not required:
        return {"skills_gap": {"match_pct": 0, "matched": [], "missing": [], "bonus": candidate}}

    if not candidate:
        return {"skills_gap": {"match_pct": 0, "matched": [], "missing": required, "bonus": []}}

    llm = get_llm_for_workflow("skills_gap", temperature=0.1)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Required skills: {json.dumps(required)}\nCandidate skills: {json.dumps(candidate)}"},
    ]
    response = await llm.ainvoke(messages)

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        result = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Failed to parse skills gap response: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    matched = result.get("matched", [])
    missing = result.get("missing", [])
    bonus = result.get("bonus", [])
    match_pct = round((len(matched) / len(required)) * 100) if required else 0

    return {
        "skills_gap": {
            "match_pct": match_pct,
            "matched": matched,
            "missing": missing,
            "bonus": bonus,
        }
    }
```

**Step 2: Create the graph**

Create `svc-ai-orchestrator/app/graphs/skills_gap.py`:
```python
"""LangGraph workflow for semantic skills gap analysis."""
from langgraph.graph import StateGraph, END
from app.schemas.candidate_state import SkillsGapState
from app.nodes.candidate.skills_gap import semantic_match

def build_skills_gap_graph():
    graph = StateGraph(SkillsGapState)
    graph.add_node("semantic_match", semantic_match)
    graph.set_entry_point("semantic_match")
    graph.add_edge("semantic_match", END)
    return graph.compile()
```

**Step 3: Add endpoint to candidate router**

Add to `svc-ai-orchestrator/app/routers/candidate.py`:
```python
from app.graphs.skills_gap import build_skills_gap_graph

class SkillsGapRequest(BaseModel):
    candidate_id: int
    jd_id: int

class MatchedSkill(BaseModel):
    required_skill: str
    candidate_skill: str
    confidence: float

class SkillsGapResponse(BaseModel):
    match_pct: int
    matched: list[MatchedSkill]
    missing: list[str]
    bonus: list[str]
    analyzed_at: str

@router.post("/skills-gap", response_model=SkillsGapResponse)
async def skills_gap_endpoint(
    req: SkillsGapRequest,
    user=Depends(get_current_user),
):
    """Analyze skills gap between candidate and job requirements."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    # Gather skills from recruiting DB
    async for db in get_recruiting_db():
        context = await gather_candidate_context(db, req.candidate_id, req.jd_id)

    if context.get("error"):
        raise HTTPException(404, context["error"])

    job = context.get("job_context", {})
    resume = context.get("resume_analysis", {})

    required_skills = job.get("core_skills", []) + job.get("preferred_skills", [])
    candidate_skills = (
        resume.get("highlighted_skills", []) +
        resume.get("metadata", {}).get("skills", [])
    )

    graph = build_skills_gap_graph()
    result = await graph.ainvoke({
        "candidate_id": req.candidate_id,
        "jd_id": req.jd_id,
        "required_skills": required_skills,
        "candidate_skills": candidate_skills,
    })

    if result.get("error"):
        raise HTTPException(500, result["error"])

    gap = result["skills_gap"]
    return SkillsGapResponse(
        match_pct=gap["match_pct"],
        matched=[MatchedSkill(**m) for m in gap["matched"]],
        missing=gap["missing"],
        bonus=gap["bonus"],
        analyzed_at=datetime.now(timezone.utc).isoformat(),
    )
```

**Step 4: Commit**

```bash
git add svc-ai-orchestrator/app/nodes/candidate/skills_gap.py \
       svc-ai-orchestrator/app/graphs/skills_gap.py \
       svc-ai-orchestrator/app/routers/candidate.py
git commit -m "feat(orchestrator): add semantic skills gap analysis workflow"
```

---

## Task 7: Orchestrator — Interview Questions Workflow

**Files:**
- Create: `svc-ai-orchestrator/app/schemas/interview_state.py`
- Create: `svc-ai-orchestrator/app/nodes/interview/question_generator.py`
- Create: `svc-ai-orchestrator/app/graphs/interview_questions.py`
- Modify: `svc-ai-orchestrator/app/routers/interview.py` (existing file — add new endpoint)

**Step 1: Create interview state**

Create `svc-ai-orchestrator/app/schemas/interview_state.py`:
```python
"""State for interview AI workflows."""
from typing import TypedDict, Optional

class InterviewQuestionsState(TypedDict, total=False):
    candidate_id: int
    jd_id: int
    interview_type: Optional[str]  # technical, behavioral, culture, general
    job_context: Optional[dict]
    candidate_context: Optional[dict]
    skills_gap: Optional[list]
    questions: Optional[list]
    error: Optional[str]
    execution_id: str
```

**Step 2: Create question generator node**

Create `svc-ai-orchestrator/app/nodes/interview/question_generator.py`:
```python
"""Node that generates tailored interview questions."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert interviewer. Generate targeted interview questions for evaluating a candidate.

Consider:
- The job requirements and role level
- The candidate's background and experience gaps
- The interview type (technical, behavioral, culture, general)

Return ONLY valid JSON — an array of questions:
[
  {
    "question": "the interview question",
    "type": "technical|behavioral|situational|culture",
    "rationale": "why this question is relevant for this candidate"
  }
]

Generate 8-12 questions. Mix types appropriately based on the interview_type focus.
For technical interviews: 60% technical, 20% situational, 20% behavioral.
For behavioral interviews: 60% behavioral, 20% situational, 20% culture.
For culture interviews: 50% culture, 30% behavioral, 20% situational.
For general: equal mix.
"""

@logged_node("interview_questions", "generate_questions")
async def generate_questions(state: dict) -> dict:
    """Generate interview questions tailored to candidate and job."""
    job = state.get("job_context", {})
    candidate = state.get("candidate_context", {})
    skills_gap = state.get("skills_gap", [])
    interview_type = state.get("interview_type", "general")

    user_prompt = f"""Generate interview questions:

**Job:** {job.get('title', 'Unknown')}
**Key Skills:** {', '.join(job.get('core_skills', [])[:10])}
**Interview Type:** {interview_type}

**Candidate:** {candidate.get('name', 'Unknown')}
**Skills Gaps:** {', '.join(skills_gap[:5]) if skills_gap else 'None identified'}
**Experience Summary:** {candidate.get('summary', 'Not available')}
"""

    llm = get_llm_for_workflow("interview_questions", temperature=0.5)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    response = await llm.ainvoke(messages)

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        questions = json.loads(content.strip())
        if not isinstance(questions, list):
            questions = questions.get("questions", [])
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Failed to parse questions response: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    return {"questions": questions}
```

**Step 3: Create the graph**

Create `svc-ai-orchestrator/app/graphs/interview_questions.py`:
```python
"""LangGraph workflow for interview question generation."""
from langgraph.graph import StateGraph, END
from app.schemas.interview_state import InterviewQuestionsState
from app.nodes.interview.question_generator import generate_questions

def build_interview_questions_graph():
    graph = StateGraph(InterviewQuestionsState)
    graph.add_node("generate_questions", generate_questions)
    graph.set_entry_point("generate_questions")
    graph.add_edge("generate_questions", END)
    return graph.compile()
```

**Step 4: Add endpoint to existing interview router**

Modify `svc-ai-orchestrator/app/routers/interview.py` — add a new endpoint alongside the existing evaluation endpoint:

```python
# Add these imports and endpoint to the existing interview.py router
from app.graphs.interview_questions import build_interview_questions_graph
from app.nodes.candidate.context_gatherer import gather_candidate_context
from app.db.postgres import get_recruiting_db

class InterviewQuestionsRequest(BaseModel):
    candidate_id: int
    jd_id: int
    interview_type: Optional[str] = "general"

class QuestionItem(BaseModel):
    question: str
    type: str
    rationale: str

class InterviewQuestionsResponse(BaseModel):
    questions: list[QuestionItem]
    generated_at: str

@router.post("/questions", response_model=InterviewQuestionsResponse)
async def generate_interview_questions_endpoint(
    req: InterviewQuestionsRequest,
    user=Depends(get_current_user),
):
    """Generate tailored interview questions for a candidate-job pair."""
    role = user.get("role")
    if role not in ("admin", "hr", "hiring_manager", "interviewer"):
        raise HTTPException(403, "Insufficient permissions")

    async for db in get_recruiting_db():
        context = await gather_candidate_context(db, req.candidate_id, req.jd_id)

    if context.get("error"):
        raise HTTPException(404, context["error"])

    job = context.get("job_context", {})
    resume = context.get("resume_analysis", {})
    candidate = context.get("candidate_context", {})
    candidate["summary"] = resume.get("metadata", {}).get("summary", "")

    # Get missing skills for targeted questions
    skills_gap = []
    required = job.get("core_skills", [])
    candidate_skills = resume.get("highlighted_skills", [])
    if required and candidate_skills:
        req_lower = {s.lower() for s in required}
        cand_lower = {s.lower() for s in candidate_skills}
        skills_gap = [s for s in required if s.lower() not in cand_lower]

    graph = build_interview_questions_graph()
    result = await graph.ainvoke({
        "candidate_id": req.candidate_id,
        "jd_id": req.jd_id,
        "interview_type": req.interview_type,
        "job_context": job,
        "candidate_context": candidate,
        "skills_gap": skills_gap,
    })

    if result.get("error"):
        raise HTTPException(500, result["error"])

    return InterviewQuestionsResponse(
        questions=[QuestionItem(**q) for q in result.get("questions", [])],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
```

**Step 5: Commit**

```bash
git add svc-ai-orchestrator/app/schemas/interview_state.py \
       svc-ai-orchestrator/app/nodes/interview/question_generator.py \
       svc-ai-orchestrator/app/graphs/interview_questions.py \
       svc-ai-orchestrator/app/routers/interview.py
git commit -m "feat(orchestrator): add interview questions generation workflow"
```

---

## Task 8: Orchestrator — Screening Scorer Workflow

**Files:**
- Create: `svc-ai-orchestrator/app/schemas/screening_state.py`
- Create: `svc-ai-orchestrator/app/nodes/screening/scorer.py`
- Create: `svc-ai-orchestrator/app/graphs/screening_scoring.py`
- Create: `svc-ai-orchestrator/app/routers/screening.py`
- Modify: `svc-ai-orchestrator/main.py`

**Step 1: Create state + node + graph + router**

Follow the same pattern as Tasks 2-7. The screening scorer:
- Takes `candidate_id` and `jd_id`
- Fetches screening questions (filtered by `jd_id`) and responses (filtered by question IDs)
- Sends each question-response pair to LLM for quality scoring (1-5 stars + reasoning)
- Returns per-question scores and an overall quality score

The LLM prompt for scoring each response:
```
Rate this screening response on a 1-5 scale:
Question: {question}
Expected answer type: {question_type}
Candidate response: {response}

Return JSON: {"score": 4, "reasoning": "Clear, specific answer demonstrating relevant experience"}
```

**Step 2: Register router in main.py**

```python
from app.routers import screening
app.include_router(screening.router, prefix="/api/orchestrator/screening", tags=["Screening AI"])
```

**Step 3: Commit**

```bash
git add svc-ai-orchestrator/app/schemas/screening_state.py \
       svc-ai-orchestrator/app/nodes/screening/ \
       svc-ai-orchestrator/app/graphs/screening_scoring.py \
       svc-ai-orchestrator/app/routers/screening.py \
       svc-ai-orchestrator/main.py
git commit -m "feat(orchestrator): add screening scorer workflow"
```

---

## Task 9: Orchestrator — Salary Estimation Workflow

**Files:**
- Create: `svc-ai-orchestrator/app/schemas/salary_state.py`
- Create: `svc-ai-orchestrator/app/nodes/salary/estimator.py`
- Create: `svc-ai-orchestrator/app/graphs/salary_estimate.py`
- Create: `svc-ai-orchestrator/app/routers/salary.py`
- Modify: `svc-ai-orchestrator/main.py`

**Step 1: Create the estimator node**

The salary estimator uses LLM with a structured prompt:
```
Estimate salary ranges for this role. Return JSON:
{
  "currency": "USD",
  "p25": 85000,
  "p50": 105000,
  "p75": 130000,
  "confidence": "medium",
  "disclaimer": "These are AI-estimated ranges based on general market data. Actual salaries vary by company, location, and candidate."
}
```

**Step 2: Register router**

```python
from app.routers import salary
app.include_router(salary.router, prefix="/api/orchestrator/salary", tags=["Salary AI"])
```

**Step 3: Commit**

```bash
git add svc-ai-orchestrator/app/schemas/salary_state.py \
       svc-ai-orchestrator/app/nodes/salary/ \
       svc-ai-orchestrator/app/graphs/salary_estimate.py \
       svc-ai-orchestrator/app/routers/salary.py \
       svc-ai-orchestrator/main.py
git commit -m "feat(orchestrator): add salary estimation workflow"
```

---

## Task 10: Recruiting API — Cache Read/Write Endpoints

**Files:**
- Create: `svc-recruiting/app/api/v1/routes_ai_cache.py`
- Modify: `svc-recruiting/main.py`

**Step 1: Create cache endpoints**

Create `svc-recruiting/app/api/v1/routes_ai_cache.py`:

Lightweight endpoints to read/write the JSONB cache columns:
```python
"""Endpoints for reading/writing AI result caches on existing tables."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.db.session import get_db
from app.core.auth import require_hiring_access
from app.db.models import JobDescription, CandidateJobEntry, InterviewSchedule

router = APIRouter()

# GET /api/ai-cache/job/{jd_id}/bias-check — read cached bias check
# PUT /api/ai-cache/job/{jd_id}/bias-check — write cached bias check
# GET /api/ai-cache/job/{jd_id}/salary — read cached salary estimate
# PUT /api/ai-cache/job/{jd_id}/salary — write cached salary estimate
# GET /api/ai-cache/job/{jd_id}/generated-jd — read cached generated JD
# PUT /api/ai-cache/job/{jd_id}/generated-jd — write cached generated JD
# GET /api/ai-cache/candidate/{entry_id}/fit-summary — read cached fit summary
# PUT /api/ai-cache/candidate/{entry_id}/fit-summary — write cached fit summary
# GET /api/ai-cache/candidate/{entry_id}/ranking — read cached ranking score
# PUT /api/ai-cache/candidate/{entry_id}/ranking — write cached ranking score
# GET /api/ai-cache/candidate/{entry_id}/skills-gap — read cached skills gap
# PUT /api/ai-cache/candidate/{entry_id}/skills-gap — write cached skills gap
# GET /api/ai-cache/schedule/{schedule_id}/questions — read cached questions
# PUT /api/ai-cache/schedule/{schedule_id}/questions — write cached questions

# Each GET returns the JSONB column value or null
# Each PUT accepts a JSON body and writes it to the column
```

Pattern for each endpoint pair:
```python
@router.get("/job/{jd_id}/bias-check")
async def get_bias_check(jd_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    result = await db.execute(select(JobDescription.ai_bias_check).where(JobDescription.id == jd_id))
    data = result.scalar_one_or_none()
    return data or {}

@router.put("/job/{jd_id}/bias-check")
async def set_bias_check(jd_id: int, body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    await db.execute(update(JobDescription).where(JobDescription.id == jd_id).values(ai_bias_check=body))
    await db.commit()
    return {"ok": True}
```

**Step 2: Register in main.py and gateway**

In `svc-recruiting/main.py`:
```python
from app.api.v1 import routes_ai_cache
app.include_router(routes_ai_cache.router, prefix="/api/ai-cache", tags=["AI Cache"])
```

Gateway already routes `/api/ai-cache` -> svc-recruiting if the prefix `/api/` catches it. If not, add to `svc-gateway/app/core/routes.py`:
```python
("/api/ai-cache", settings.RECRUITING_URL),
```

**Step 3: Commit**

```bash
git add svc-recruiting/app/api/v1/routes_ai_cache.py \
       svc-recruiting/main.py \
       svc-gateway/app/core/routes.py
git commit -m "feat(recruiting): add AI cache read/write endpoints"
```

---

## Task 11: Frontend — Remove Old AI Toolkit

**Files:**
- Delete: `ui/src/pages/AIToolkit.tsx`
- Modify: `ui/src/App.tsx:132` (remove /ai-toolkit route)
- Modify: `ui/src/components/layout/TopNavbar.tsx:72` (remove AI Toolkit nav item)
- Modify: `ui/src/utils/api.ts:1702-1724` (remove old AI toolkit methods)
- Modify: `ui/src/types/api.ts` (remove old AI toolkit types)

**Step 1: Remove the route from App.tsx**

Delete the line:
```tsx
<Route path="/ai-toolkit" element={<HRRoute><Suspense fallback={null}><AIToolkit /></Suspense></HRRoute>} />
```

And remove the lazy import for AIToolkit.

**Step 2: Remove from TopNavbar.tsx**

Remove line 72:
```tsx
{ icon: Brain, label: 'AI Toolkit', path: '/ai-toolkit', description: 'AI screening & scoring', hrOnly: true },
```

**Step 3: Delete AIToolkit.tsx**

```bash
rm ui/src/pages/AIToolkit.tsx
```

**Step 4: Remove old API methods from api.ts**

Remove `rankCandidates`, `generateInterviewQuestions`, `getSalaryIntelligence`, `getSkillsGap`, `scoreScreening` (lines 1702-1724).

**Step 5: Add new API methods to api.ts**

```typescript
// AI Orchestrator endpoints
async generateJD(data: { job_title: string; department?: string; seniority?: string; location?: string; additional_context?: string }) {
  return this.request('/api/orchestrator/jd/generate', { method: 'POST', body: JSON.stringify(data) });
}

async checkJDBias(data: { text: string }) {
  return this.request('/api/orchestrator/jd/bias-check', { method: 'POST', body: JSON.stringify(data) });
}

async getCandidateFitSummary(data: { candidate_id: number; jd_id: number }) {
  return this.request('/api/orchestrator/candidate/fit-summary', { method: 'POST', body: JSON.stringify(data) });
}

async rankCandidates(data: { jd_id: number }) {
  return this.request('/api/orchestrator/candidate/rank', { method: 'POST', body: JSON.stringify(data) });
}

async getSkillsGap(data: { candidate_id: number; jd_id: number }) {
  return this.request('/api/orchestrator/candidate/skills-gap', { method: 'POST', body: JSON.stringify(data) });
}

async generateInterviewQuestions(data: { candidate_id: number; jd_id: number; interview_type?: string }) {
  return this.request('/api/orchestrator/interview/questions', { method: 'POST', body: JSON.stringify(data) });
}

async scoreScreening(data: { candidate_id: number; jd_id: number }) {
  return this.request('/api/orchestrator/screening/score', { method: 'POST', body: JSON.stringify(data) });
}

async estimateSalary(data: { job_title: string; location?: string; country?: string; seniority?: string }) {
  return this.request('/api/orchestrator/salary/estimate', { method: 'POST', body: JSON.stringify(data) });
}

// AI Cache read endpoints
async getAICache(entity: string, id: number, field: string) {
  return this.request(`/api/ai-cache/${entity}/${id}/${field}`);
}

async setAICache(entity: string, id: number, field: string, data: any) {
  return this.request(`/api/ai-cache/${entity}/${id}/${field}`, { method: 'PUT', body: JSON.stringify(data) });
}
```

**Step 6: Commit**

```bash
git add -u ui/src/
git commit -m "feat(ui): remove standalone AI Toolkit, add new orchestrator API methods"
```

---

## Task 12: Frontend — JD Generator + Bias Checker Components

**Files:**
- Create: `ui/src/components/ai/JDGeneratorButton.tsx`
- Create: `ui/src/components/ai/JDBiasChecker.tsx`
- Modify: `ui/src/pages/CreateJob.tsx` (embed components)

**Step 1: Create JDGeneratorButton**

A button that, when clicked, calls the orchestrator JD generation endpoint and populates the JD editor.

Uses `useMutation` from TanStack Query. Shows loading spinner during generation. On success, calls a callback to set the editor content.

**Step 2: Create JDBiasChecker**

Receives the current JD text. On trigger (save/blur/button), calls the bias check endpoint. Renders flagged phrases as highlighted spans with tooltips. Each tooltip shows the bias type and suggested replacement with a one-click accept button.

**Step 3: Embed in CreateJob.tsx**

Add `<JDGeneratorButton />` above the JD text editor and `<JDBiasChecker />` below or overlaid on it.

**Step 4: Commit**

```bash
git add ui/src/components/ai/ ui/src/pages/CreateJob.tsx
git commit -m "feat(ui): add JD generator and bias checker components"
```

---

## Task 13: Frontend — Salary Insights Component

**Files:**
- Create: `ui/src/components/ai/SalaryInsightsCard.tsx`
- Modify: `ui/src/pages/CreateJob.tsx` (embed component)

**Step 1: Create SalaryInsightsCard**

A card component that auto-triggers when job title and location are set. Shows p25/p50/p75 salary range as a visual bar chart or range indicator. Prominent "AI-estimated" disclaimer. Country selector dropdown. Refresh button.

Uses React Query: `queryKey: ['ai-salary', jobTitle, location, country]`.

**Step 2: Embed in CreateJob.tsx**

Place next to the salary range input fields.

**Step 3: Commit**

```bash
git add ui/src/components/ai/SalaryInsightsCard.tsx ui/src/pages/CreateJob.tsx
git commit -m "feat(ui): add salary insights card on job creation page"
```

---

## Task 14: Frontend — Candidate Fit Summary Component

**Files:**
- Create: `ui/src/components/ai/AIFitSummaryCard.tsx`
- Modify: `ui/src/pages/CandidateDetail.tsx` (embed component)

**Step 1: Create AIFitSummaryCard**

Card with:
- Rating badge (Strong=green, Good=blue, Moderate=yellow, Weak=red)
- Strengths list — each with evidence citation in muted text
- Concerns list
- Recommendation paragraph
- "Refresh" button (mutation to re-generate)
- "Updated X ago" timestamp
- Loading skeleton while generating
- Empty state when no resume analysis exists

Props: `candidateId: number, jdId: number`

**Step 2: Embed in CandidateDetail.tsx**

Place as the first card in the candidate detail view, above existing sections.

**Step 3: Commit**

```bash
git add ui/src/components/ai/AIFitSummaryCard.tsx ui/src/pages/CandidateDetail.tsx
git commit -m "feat(ui): add AI fit summary card on candidate detail page"
```

---

## Task 15: Frontend — Candidate Ranking Components

**Files:**
- Create: `ui/src/components/ai/CandidateRankBadge.tsx`
- Create: `ui/src/components/ai/RankBreakdownPopover.tsx`
- Create: `ui/src/components/ai/RankCandidatesButton.tsx`
- Modify: `ui/src/pages/JobDetail.tsx` (embed components in pipeline view)

**Step 1: Create CandidateRankBadge**

Small circular badge showing composite score (0-100) with color coding (green >70, yellow 40-70, red <40). On click, opens `RankBreakdownPopover`.

**Step 2: Create RankBreakdownPopover**

Popover showing 4 sub-score bars:
- Resume (40% weight)
- Interview (30%)
- Feedback (20%)
- Screening (10%)

Each bar shows the score value and a progress indicator.

**Step 3: Create RankCandidatesButton**

Button in job detail header. Calls the ranking endpoint as a mutation. Shows loading indicator. On success, invalidates all candidate ranking queries for that job.

**Step 4: Embed in pipeline view**

Add `<CandidateRankBadge />` to each candidate card in the pipeline columns. Add `<RankCandidatesButton />` to the job detail header.

**Step 5: Commit**

```bash
git add ui/src/components/ai/ ui/src/pages/JobDetail.tsx
git commit -m "feat(ui): add candidate ranking badges and controls on pipeline view"
```

---

## Task 16: Frontend — Semantic Skills Gap Component

**Files:**
- Create: `ui/src/components/ai/SemanticSkillsGap.tsx`
- Modify: `ui/src/pages/CandidateDetail.tsx` (replace existing skills section)
- Modify: `ui/src/components/SkillsGapMatrix.tsx` (deprecate or keep as fallback)

**Step 1: Create SemanticSkillsGap**

Replaces the current `SkillsGapMatrix`. Layout:
- Circular progress ring showing overall match %
- Three columns: Matched (green, with confidence bar per skill), Missing (red), Bonus (blue)
- Each matched skill shows `required_skill -> candidate_skill (85%)` format
- "Refresh" button
- Falls back to `SkillsGapMatrix` if no AI analysis available

**Step 2: Embed in CandidateDetail.tsx**

Replace or augment the existing skills gap section.

**Step 3: Commit**

```bash
git add ui/src/components/ai/SemanticSkillsGap.tsx ui/src/pages/CandidateDetail.tsx
git commit -m "feat(ui): add semantic skills gap component on candidate detail"
```

---

## Task 17: Frontend — AI Screening Scores Component

**Files:**
- Create: `ui/src/components/ai/AIScreeningScores.tsx`
- Modify: `ui/src/pages/CandidateDetail.tsx` (embed in screening tab)

**Step 1: Create AIScreeningScores**

Displayed on the screening responses tab of candidate detail:
- Overall quality score at top (average of all per-question scores)
- Per-question card: question text, candidate response, AI score (1-5 stars), AI reasoning
- "Score Responses" button to trigger scoring
- Loading state per question while scoring

**Step 2: Embed in screening tab**

**Step 3: Commit**

```bash
git add ui/src/components/ai/AIScreeningScores.tsx ui/src/pages/CandidateDetail.tsx
git commit -m "feat(ui): add AI screening scores on candidate detail"
```

---

## Task 18: Frontend — AI Interview Questions Component

**Files:**
- Create: `ui/src/components/ai/AISuggestedQuestions.tsx`
- Modify: `ui/src/components/pipeline/InterviewScheduleModal.tsx` (embed component)

**Step 1: Create AISuggestedQuestions**

Panel component:
- Auto-generates when candidate + job + interview type are known
- List of questions with type badge (technical/behavioral/situational/culture) and rationale in muted text
- Copy individual question button (clipboard icon)
- "Copy All" button
- Collapsible with "AI Suggested Questions" header
- Loading skeleton while generating

**Step 2: Embed in InterviewScheduleModal**

Add `<AISuggestedQuestions />` as a panel below the scheduling form fields.

**Step 3: Commit**

```bash
git add ui/src/components/ai/AISuggestedQuestions.tsx \
       ui/src/components/pipeline/InterviewScheduleModal.tsx
git commit -m "feat(ui): add AI suggested questions in interview scheduling"
```

---

## Task 19: Integration Testing & Cleanup

**Step 1: Verify all orchestrator endpoints**

Start all services and test each endpoint:
```bash
# svc-ai-orchestrator on 8014
# svc-recruiting on 8002
# svc-gateway on 8000
# UI on 8085

# Test each endpoint via gateway
curl -X POST http://localhost:8000/api/orchestrator/jd/generate -H "Authorization: Bearer <token>" -d '{"job_title":"..."}'
curl -X POST http://localhost:8000/api/orchestrator/jd/bias-check -H "Authorization: Bearer <token>" -d '{"text":"..."}'
curl -X POST http://localhost:8000/api/orchestrator/candidate/fit-summary -H "Authorization: Bearer <token>" -d '{"candidate_id":1,"jd_id":1}'
curl -X POST http://localhost:8000/api/orchestrator/candidate/rank -H "Authorization: Bearer <token>" -d '{"jd_id":1}'
curl -X POST http://localhost:8000/api/orchestrator/candidate/skills-gap -H "Authorization: Bearer <token>" -d '{"candidate_id":1,"jd_id":1}'
curl -X POST http://localhost:8000/api/orchestrator/interview/questions -H "Authorization: Bearer <token>" -d '{"candidate_id":1,"jd_id":1}'
curl -X POST http://localhost:8000/api/orchestrator/screening/score -H "Authorization: Bearer <token>" -d '{"candidate_id":1,"jd_id":1}'
curl -X POST http://localhost:8000/api/orchestrator/salary/estimate -H "Authorization: Bearer <token>" -d '{"job_title":"Senior Software Engineer"}'
```

**Step 2: TypeScript + Vite build**

```bash
cd ui && npx tsc --noEmit && npx vite build
```

**Step 3: Manual UI walkthrough**

- Create a job -> verify JD Generator and Bias Checker work
- View job pipeline -> verify Rank Candidates button and score badges
- Open candidate detail -> verify Fit Summary, Skills Gap, Screening Scores
- Schedule interview -> verify AI Suggested Questions
- Set salary on job -> verify Salary Insights card

**Step 4: Remove old backend AI tools**

Once all new features are verified:
- Delete `svc-recruiting/app/services/ai_ranking_service.py`
- Delete `svc-recruiting/app/api/v1/routes_ai_tools.py`
- Remove router registration from `svc-recruiting/main.py`

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete AI toolkit rebuild — contextual AI features across app"
```
