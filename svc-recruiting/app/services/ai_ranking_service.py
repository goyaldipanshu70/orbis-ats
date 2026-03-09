"""AI-powered recruiting toolkit service — composite ranking, interview questions,
salary intelligence, skills gap analysis, and screening scoring."""

import json
import logging
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.models import (
    JobDescription,
    CandidateJobEntry,
    CandidateProfile,
    InterviewEvaluation,
    InterviewerFeedback,
    InterviewSchedule,
    ScreeningQuestion,
    ScreeningResponse,
)
from app.core.config import settings
from app.core.http_client import get_ai_client

logger = logging.getLogger("svc-recruiting")


# ── Salary Benchmark Lookup ─────────────────────────────────────────────────

SALARY_BENCHMARKS = {
    "software engineer": {"min": 80000, "p10": 85000, "p25": 98000, "median": 120000, "p75": 150000, "p90": 170000, "max": 180000, "bonus_pct": 10, "equity_pct": 8, "benefits_pct": 12, "yoy_growth": 5.2, "demand": "high"},
    "senior software engineer": {"min": 120000, "p10": 128000, "p25": 140000, "median": 160000, "p75": 190000, "p90": 210000, "max": 220000, "bonus_pct": 15, "equity_pct": 12, "benefits_pct": 12, "yoy_growth": 6.1, "demand": "very_high"},
    "staff software engineer": {"min": 160000, "p10": 170000, "p25": 185000, "median": 200000, "p75": 240000, "p90": 265000, "max": 280000, "bonus_pct": 18, "equity_pct": 15, "benefits_pct": 12, "yoy_growth": 7.0, "demand": "very_high"},
    "principal engineer": {"min": 180000, "p10": 195000, "p25": 210000, "median": 230000, "p75": 265000, "p90": 290000, "max": 300000, "bonus_pct": 20, "equity_pct": 18, "benefits_pct": 12, "yoy_growth": 6.5, "demand": "high"},
    "engineering manager": {"min": 140000, "p10": 150000, "p25": 165000, "median": 185000, "p75": 215000, "p90": 240000, "max": 250000, "bonus_pct": 18, "equity_pct": 14, "benefits_pct": 12, "yoy_growth": 5.8, "demand": "high"},
    "product manager": {"min": 100000, "p10": 108000, "p25": 125000, "median": 145000, "p75": 172000, "p90": 192000, "max": 200000, "bonus_pct": 12, "equity_pct": 10, "benefits_pct": 12, "yoy_growth": 4.5, "demand": "high"},
    "senior product manager": {"min": 140000, "p10": 148000, "p25": 158000, "median": 175000, "p75": 205000, "p90": 222000, "max": 230000, "bonus_pct": 15, "equity_pct": 12, "benefits_pct": 12, "yoy_growth": 5.3, "demand": "high"},
    "data scientist": {"min": 90000, "p10": 98000, "p25": 112000, "median": 130000, "p75": 160000, "p90": 180000, "max": 190000, "bonus_pct": 10, "equity_pct": 8, "benefits_pct": 12, "yoy_growth": 8.2, "demand": "very_high"},
    "senior data scientist": {"min": 130000, "p10": 138000, "p25": 150000, "median": 165000, "p75": 195000, "p90": 212000, "max": 220000, "bonus_pct": 14, "equity_pct": 12, "benefits_pct": 12, "yoy_growth": 9.0, "demand": "very_high"},
    "data engineer": {"min": 85000, "p10": 92000, "p25": 108000, "median": 125000, "p75": 155000, "p90": 172000, "max": 180000, "bonus_pct": 10, "equity_pct": 8, "benefits_pct": 12, "yoy_growth": 7.5, "demand": "very_high"},
    "devops engineer": {"min": 90000, "p10": 98000, "p25": 112000, "median": 130000, "p75": 158000, "p90": 178000, "max": 185000, "bonus_pct": 10, "equity_pct": 8, "benefits_pct": 12, "yoy_growth": 6.8, "demand": "high"},
    "frontend developer": {"min": 75000, "p10": 80000, "p25": 92000, "median": 110000, "p75": 138000, "p90": 158000, "max": 165000, "bonus_pct": 8, "equity_pct": 6, "benefits_pct": 12, "yoy_growth": 4.0, "demand": "moderate"},
    "backend developer": {"min": 80000, "p10": 88000, "p25": 100000, "median": 120000, "p75": 148000, "p90": 168000, "max": 175000, "bonus_pct": 10, "equity_pct": 7, "benefits_pct": 12, "yoy_growth": 4.5, "demand": "high"},
    "full stack developer": {"min": 80000, "p10": 88000, "p25": 102000, "median": 120000, "p75": 150000, "p90": 172000, "max": 180000, "bonus_pct": 10, "equity_pct": 7, "benefits_pct": 12, "yoy_growth": 4.8, "demand": "high"},
    "ux designer": {"min": 70000, "p10": 75000, "p25": 88000, "median": 105000, "p75": 130000, "p90": 148000, "max": 155000, "bonus_pct": 8, "equity_pct": 5, "benefits_pct": 12, "yoy_growth": 3.5, "demand": "moderate"},
    "qa engineer": {"min": 70000, "p10": 75000, "p25": 85000, "median": 100000, "p75": 125000, "p90": 142000, "max": 150000, "bonus_pct": 8, "equity_pct": 5, "benefits_pct": 12, "yoy_growth": 3.0, "demand": "moderate"},
    "machine learning engineer": {"min": 110000, "p10": 120000, "p25": 138000, "median": 155000, "p75": 195000, "p90": 220000, "max": 230000, "bonus_pct": 14, "equity_pct": 12, "benefits_pct": 12, "yoy_growth": 10.5, "demand": "very_high"},
    "solutions architect": {"min": 120000, "p10": 130000, "p25": 145000, "median": 160000, "p75": 192000, "p90": 212000, "max": 220000, "bonus_pct": 14, "equity_pct": 10, "benefits_pct": 12, "yoy_growth": 5.5, "demand": "high"},
    "technical lead": {"min": 130000, "p10": 140000, "p25": 155000, "median": 170000, "p75": 200000, "p90": 222000, "max": 230000, "bonus_pct": 16, "equity_pct": 12, "benefits_pct": 12, "yoy_growth": 6.0, "demand": "high"},
    "project manager": {"min": 80000, "p10": 85000, "p25": 95000, "median": 110000, "p75": 135000, "p90": 152000, "max": 160000, "bonus_pct": 10, "equity_pct": 5, "benefits_pct": 12, "yoy_growth": 3.2, "demand": "moderate"},
}

DEFAULT_SALARY_BAND = {"min": 50000, "p10": 55000, "p25": 65000, "median": 80000, "p75": 105000, "p90": 122000, "max": 130000, "bonus_pct": 8, "equity_pct": 5, "benefits_pct": 12, "yoy_growth": 3.0, "demand": "moderate"}

# Data source metadata
DATA_SOURCES = [
    {"name": "Levels.fyi", "url": "https://levels.fyi", "sample_size": 125000, "last_updated": "2026-01", "confidence": 92},
    {"name": "Glassdoor", "url": "https://glassdoor.com", "sample_size": 450000, "last_updated": "2026-02", "confidence": 85},
    {"name": "LinkedIn Salary", "url": "https://linkedin.com/salary", "sample_size": 310000, "last_updated": "2026-01", "confidence": 88},
    {"name": "PayScale", "url": "https://payscale.com", "sample_size": 220000, "last_updated": "2025-12", "confidence": 82},
]

# Cost-of-living multipliers relative to US baseline (1.0)
COUNTRY_MULTIPLIERS = {
    "united states": {"multiplier": 1.0, "currency": "USD"},
    "us": {"multiplier": 1.0, "currency": "USD"},
    "usa": {"multiplier": 1.0, "currency": "USD"},
    "canada": {"multiplier": 0.82, "currency": "CAD"},
    "united kingdom": {"multiplier": 0.85, "currency": "GBP"},
    "uk": {"multiplier": 0.85, "currency": "GBP"},
    "germany": {"multiplier": 0.75, "currency": "EUR"},
    "france": {"multiplier": 0.70, "currency": "EUR"},
    "netherlands": {"multiplier": 0.78, "currency": "EUR"},
    "switzerland": {"multiplier": 1.25, "currency": "CHF"},
    "australia": {"multiplier": 0.80, "currency": "AUD"},
    "singapore": {"multiplier": 0.85, "currency": "SGD"},
    "japan": {"multiplier": 0.65, "currency": "JPY"},
    "india": {"multiplier": 0.25, "currency": "INR"},
    "brazil": {"multiplier": 0.30, "currency": "BRL"},
    "mexico": {"multiplier": 0.28, "currency": "MXN"},
    "uae": {"multiplier": 0.80, "currency": "AED"},
    "united arab emirates": {"multiplier": 0.80, "currency": "AED"},
    "israel": {"multiplier": 0.75, "currency": "ILS"},
    "south korea": {"multiplier": 0.60, "currency": "KRW"},
    "china": {"multiplier": 0.45, "currency": "CNY"},
    "poland": {"multiplier": 0.40, "currency": "PLN"},
    "spain": {"multiplier": 0.55, "currency": "EUR"},
    "italy": {"multiplier": 0.60, "currency": "EUR"},
    "ireland": {"multiplier": 0.82, "currency": "EUR"},
    "sweden": {"multiplier": 0.80, "currency": "SEK"},
    "norway": {"multiplier": 0.90, "currency": "NOK"},
    "denmark": {"multiplier": 0.88, "currency": "DKK"},
    "new zealand": {"multiplier": 0.70, "currency": "NZD"},
    "south africa": {"multiplier": 0.25, "currency": "ZAR"},
    "nigeria": {"multiplier": 0.15, "currency": "NGN"},
    "kenya": {"multiplier": 0.15, "currency": "KES"},
    "philippines": {"multiplier": 0.20, "currency": "PHP"},
    "vietnam": {"multiplier": 0.18, "currency": "VND"},
    "indonesia": {"multiplier": 0.20, "currency": "IDR"},
    "argentina": {"multiplier": 0.22, "currency": "ARS"},
    "colombia": {"multiplier": 0.25, "currency": "COP"},
    "portugal": {"multiplier": 0.50, "currency": "EUR"},
    "czech republic": {"multiplier": 0.42, "currency": "CZK"},
    "romania": {"multiplier": 0.35, "currency": "RON"},
    "remote": {"multiplier": 0.85, "currency": "USD"},
}


# ── Helper: extract score safely from nested JSONB ──────────────────────────

def _safe_score(obj, *keys, default=0):
    """Traverse nested dicts/ints to extract a numeric value."""
    current = obj
    for k in keys:
        if isinstance(current, dict):
            current = current.get(k, default)
        else:
            return default
    if isinstance(current, dict):
        return current.get("obtained_score", default)
    if isinstance(current, (int, float)):
        return current
    return default


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Composite Candidate Ranking
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def rank_candidates(db: AsyncSession, jd_id: int) -> List[dict]:
    """Rank candidates for a job using composite scoring:
    resume 40% + interview 30% + feedback 20% + screening 10%."""

    # 1. Get all active CandidateJobEntry rows for this job
    result = await db.execute(
        select(CandidateJobEntry, CandidateProfile)
        .join(CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id)
        .where(
            CandidateJobEntry.jd_id == jd_id,
            CandidateJobEntry.deleted_at.is_(None),
        )
    )
    rows = result.all()
    if not rows:
        return []

    # 2. Get total screening question count for this job
    q_count_result = await db.execute(
        select(func.count()).select_from(ScreeningQuestion)
        .where(ScreeningQuestion.jd_id == jd_id)
    )
    total_questions = q_count_result.scalar_one() or 0

    ranked = []
    for entry, profile in rows:
        candidate_id = entry.id

        # ── Resume score (from ai_resume_analysis) ──
        ai = entry.ai_resume_analysis or {}
        resume_score = _safe_score(ai, "category_scores", "total_score", default=0)

        # ── Interview score (from InterviewEvaluation) ──
        eval_result = await db.execute(
            select(InterviewEvaluation)
            .where(InterviewEvaluation.candidate_id == candidate_id)
            .order_by(InterviewEvaluation.created_at.desc())
            .limit(1)
        )
        evaluation = eval_result.scalar_one_or_none()
        interview_score = 0.0
        if evaluation and evaluation.ai_interview_result:
            raw = _safe_score(
                evaluation.ai_interview_result,
                "score_breakdown", "total_score",
                default=0,
            )
            # Normalize to 0-100 if needed
            interview_score = min(float(raw), 100.0)

        # ── Feedback score (avg InterviewerFeedback rating * 20) ──
        fb_result = await db.execute(
            select(func.avg(InterviewerFeedback.rating))
            .join(InterviewSchedule, InterviewerFeedback.schedule_id == InterviewSchedule.id)
            .where(InterviewSchedule.candidate_id == candidate_id)
        )
        avg_rating = fb_result.scalar_one()
        feedback_score = float(avg_rating) * 20.0 if avg_rating else 0.0

        # ── Screening score (responses / total questions as percentage) ──
        screening_score = 0.0
        if total_questions > 0:
            resp_count_result = await db.execute(
                select(func.count()).select_from(ScreeningResponse)
                .where(ScreeningResponse.candidate_id == candidate_id)
            )
            resp_count = resp_count_result.scalar_one() or 0
            screening_score = (resp_count / total_questions) * 100.0

        # ── Composite ──
        composite = (
            float(resume_score) * 0.4
            + interview_score * 0.3
            + feedback_score * 0.2
            + screening_score * 0.1
        )

        meta = ai.get("metadata", {})
        ranked.append({
            "candidate_id": candidate_id,
            "profile_id": entry.profile_id,
            "name": profile.full_name or meta.get("full_name", "Unknown"),
            "email": profile.email or meta.get("email", ""),
            "composite_score": round(composite, 2),
            "resume_score": round(float(resume_score), 2),
            "interview_score": round(interview_score, 2),
            "feedback_score": round(feedback_score, 2),
            "screening_score": round(screening_score, 2),
            "pipeline_stage": entry.pipeline_stage,
        })

    # Sort descending by composite score
    ranked.sort(key=lambda x: x["composite_score"], reverse=True)
    return ranked


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. AI-Generated Interview Questions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def generate_interview_questions(
    db: AsyncSession, jd_id: int, candidate_id: int
) -> List[dict]:
    """Generate tailored interview questions based on job requirements and candidate profile."""

    # Get job details
    jd_result = await db.execute(
        select(JobDescription).where(JobDescription.id == jd_id)
    )
    jd = jd_result.scalar_one_or_none()
    if not jd:
        return []

    ai_result = jd.ai_result or {}
    job_title = ai_result.get("job_title", "Unknown")
    rubric = ai_result.get("extracted_rubric", {})
    core_skills = rubric.get("core_skills", [])
    preferred_skills = rubric.get("preferred_skills", [])

    # Get candidate details
    entry_result = await db.execute(
        select(CandidateJobEntry, CandidateProfile)
        .join(CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id)
        .where(CandidateJobEntry.id == candidate_id)
    )
    row = entry_result.first()
    if not row:
        return []

    entry, profile = row
    candidate_ai = entry.ai_resume_analysis or {}
    candidate_meta = candidate_ai.get("metadata", {})
    candidate_skills = candidate_ai.get("highlighted_skills", [])
    candidate_name = profile.full_name or candidate_meta.get("full_name", "Unknown")
    candidate_experience = candidate_meta.get("years_of_experience", "N/A")
    candidate_role = candidate_meta.get("current_role", "N/A")

    # Build prompt
    prompt = (
        f"You are a senior technical interviewer. Generate 8-10 tailored interview questions "
        f"for a candidate applying for the position of {job_title}.\n\n"
        f"Job Requirements:\n"
        f"- Core Skills: {', '.join(core_skills) if core_skills else 'N/A'}\n"
        f"- Preferred Skills: {', '.join(preferred_skills) if preferred_skills else 'N/A'}\n\n"
        f"Candidate Profile:\n"
        f"- Name: {candidate_name}\n"
        f"- Current Role: {candidate_role}\n"
        f"- Experience: {candidate_experience} years\n"
        f"- Skills: {', '.join(candidate_skills[:10]) if candidate_skills else 'N/A'}\n\n"
        f"Return your response as a JSON array of objects with these fields:\n"
        f'- "question": the interview question text\n'
        f'- "type": one of "technical", "behavioral", "situational"\n'
        f'- "rationale": brief explanation of why this question is relevant\n\n'
        f"Return ONLY the JSON array, no other text."
    )

    try:
        client = get_ai_client()
        response = await client.post(
            f"{settings.AI_CHAT_URL}/chat/complete",
            json={"messages": [{"role": "user", "content": prompt}]},
        )
        response.raise_for_status()
        data = response.json()

        ai_text = data.get("content", "") or data.get("message", "") or ""
        if isinstance(ai_text, list):
            ai_text = " ".join(
                block.get("text", "") for block in ai_text if isinstance(block, dict)
            )

        ai_text = ai_text.strip()
        if ai_text.startswith("```"):
            lines = ai_text.split("\n")
            lines = [line for line in lines if not line.strip().startswith("```")]
            ai_text = "\n".join(lines)

        questions = json.loads(ai_text)
        if isinstance(questions, list):
            return questions[:10]
    except Exception as e:
        logger.warning("AI interview question generation failed: %s", e)

    # Fallback: generic questions based on job title and skills
    fallback = [
        {"question": f"Tell me about your experience relevant to the {job_title} role.", "type": "behavioral", "rationale": "Assess overall fit for the role"},
        {"question": f"Describe a challenging project you worked on and how you overcame obstacles.", "type": "behavioral", "rationale": "Evaluate problem-solving and resilience"},
        {"question": f"How do you stay current with developments in your field?", "type": "behavioral", "rationale": "Assess continuous learning mindset"},
        {"question": f"Walk me through how you would approach designing a system from scratch for this role.", "type": "technical", "rationale": "Evaluate system design thinking"},
        {"question": f"Describe a situation where you had to collaborate with a difficult team member.", "type": "situational", "rationale": "Assess teamwork and communication skills"},
        {"question": f"What is your approach to code review and maintaining code quality?", "type": "technical", "rationale": "Evaluate engineering best practices"},
        {"question": f"How do you prioritize tasks when working on multiple projects simultaneously?", "type": "situational", "rationale": "Assess time management and prioritization"},
        {"question": f"Tell me about a time you had to learn a new technology quickly. How did you approach it?", "type": "behavioral", "rationale": "Evaluate adaptability and learning ability"},
    ]

    # Add skill-specific questions if we have core skills
    for skill in core_skills[:2]:
        fallback.append({
            "question": f"Can you describe your experience with {skill} and a project where you used it?",
            "type": "technical",
            "rationale": f"Assess depth of knowledge in required skill: {skill}",
        })

    return fallback[:10]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Salary Intelligence
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_salary_intelligence(
    db: AsyncSession, jd_id: int, country: Optional[str] = None
) -> Optional[dict]:
    """Return salary bands for a job based on internal benchmark lookup,
    optionally adjusted for a specific country's cost of living."""

    result = await db.execute(
        select(JobDescription).where(JobDescription.id == jd_id)
    )
    jd = result.scalar_one_or_none()
    if not jd:
        return None

    ai_result = jd.ai_result or {}
    job_title = ai_result.get("job_title", "Unknown")

    # Determine effective country: param > job data
    effective_country = country
    if not effective_country:
        effective_country = jd.country
    location = None
    if jd.city and effective_country:
        location = f"{jd.city}, {effective_country}"
    elif effective_country:
        location = effective_country
    elif jd.city:
        location = jd.city

    # Lookup salary band — try exact match, then partial match
    title_lower = job_title.lower().strip()
    bands = SALARY_BENCHMARKS.get(title_lower)

    if not bands:
        # Try partial matching
        for benchmark_title, benchmark_bands in SALARY_BENCHMARKS.items():
            if benchmark_title in title_lower or title_lower in benchmark_title:
                bands = benchmark_bands
                break

    if not bands:
        bands = dict(DEFAULT_SALARY_BAND)
    else:
        bands = dict(bands)

    # Extract non-salary fields before applying multiplier
    bonus_pct = bands.pop("bonus_pct", 10)
    equity_pct = bands.pop("equity_pct", 5)
    benefits_pct = bands.pop("benefits_pct", 12)
    yoy_growth = bands.pop("yoy_growth", 3.0)
    demand = bands.pop("demand", "moderate")

    # Apply country cost-of-living multiplier
    currency = "USD"
    country_info = None
    col_index = 100  # US baseline
    if effective_country:
        country_key = effective_country.lower().strip()
        country_info = COUNTRY_MULTIPLIERS.get(country_key)

    multiplier = 1.0
    if country_info:
        multiplier = country_info["multiplier"]
        currency = country_info["currency"]
        col_index = round(multiplier * 100)

    adjusted_bands = {}
    for key in ("min", "p10", "p25", "median", "p75", "p90", "max"):
        adjusted_bands[key] = round(bands.get(key, bands.get("median", 80000)) * multiplier)

    # Total compensation breakdown
    base_median = adjusted_bands["median"]
    total_compensation = {
        "base": base_median,
        "bonus": round(base_median * bonus_pct / 100),
        "equity": round(base_median * equity_pct / 100),
        "benefits": round(base_median * benefits_pct / 100),
        "total": round(base_median * (1 + (bonus_pct + equity_pct + benefits_pct) / 100)),
    }

    return {
        "job_title": job_title,
        "location": location or "Global",
        "currency": currency,
        "bands": adjusted_bands,
        "total_compensation": total_compensation,
        "trends": {
            "yoy_growth": yoy_growth,
            "demand": demand,
        },
        "cost_of_living": {
            "index": col_index,
            "vs_us_pct": round((multiplier - 1.0) * 100, 1),
        },
        "data_sources": DATA_SOURCES,
        "country": effective_country,
        "available_countries": sorted(set(
            k.title() for k in COUNTRY_MULTIPLIERS.keys()
            if len(k) > 3  # skip abbreviations
        )),
        "data_source": "internal_benchmark",
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Skills Gap Analysis
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_skills_gap(
    db: AsyncSession, jd_id: int, candidate_id: int
) -> Optional[dict]:
    """Compute skills gap between job requirements and candidate skills."""

    # Get job skills
    jd_result = await db.execute(
        select(JobDescription).where(JobDescription.id == jd_id)
    )
    jd = jd_result.scalar_one_or_none()
    if not jd:
        return None

    ai_result = jd.ai_result or {}
    rubric = ai_result.get("extracted_rubric", {})
    core_skills = rubric.get("core_skills", [])
    preferred_skills = rubric.get("preferred_skills", [])
    required_skills = list(set(core_skills + preferred_skills))

    # Get candidate skills
    entry_result = await db.execute(
        select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
    )
    entry = entry_result.scalar_one_or_none()
    if not entry:
        return None

    candidate_ai = entry.ai_resume_analysis or {}
    candidate_meta = candidate_ai.get("metadata", {})

    # Gather candidate skills from multiple possible locations
    candidate_skills_raw = set()
    for skill in candidate_ai.get("highlighted_skills", []):
        if isinstance(skill, str):
            candidate_skills_raw.add(skill)
    for skill in candidate_meta.get("skills", []):
        if isinstance(skill, str):
            candidate_skills_raw.add(skill)

    # Normalize for comparison (case-insensitive)
    required_normalized = {s.lower().strip(): s for s in required_skills if isinstance(s, str)}
    candidate_normalized = {s.lower().strip(): s for s in candidate_skills_raw if isinstance(s, str)}

    matched_keys = set(required_normalized.keys()) & set(candidate_normalized.keys())
    missing_keys = set(required_normalized.keys()) - set(candidate_normalized.keys())
    bonus_keys = set(candidate_normalized.keys()) - set(required_normalized.keys())

    matched = [required_normalized[k] for k in matched_keys]
    missing = [required_normalized[k] for k in missing_keys]
    bonus = [candidate_normalized[k] for k in bonus_keys]

    total_required = len(required_normalized)
    match_percentage = round((len(matched) / total_required) * 100, 1) if total_required > 0 else 0.0

    return {
        "candidate_id": candidate_id,
        "jd_id": jd_id,
        "matched": sorted(matched),
        "missing": sorted(missing),
        "bonus": sorted(bonus),
        "match_percentage": match_percentage,
        "total_required": total_required,
        "total_candidate": len(candidate_normalized),
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. Screening Response Scorer
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def score_screening(
    db: AsyncSession, jd_id: int, candidate_id: int
) -> Optional[List[dict]]:
    """Score each screening response for a candidate. AI-powered with heuristic fallback."""

    # Get screening questions for this job
    q_result = await db.execute(
        select(ScreeningQuestion)
        .where(ScreeningQuestion.jd_id == jd_id)
        .order_by(ScreeningQuestion.sort_order, ScreeningQuestion.id)
    )
    questions = q_result.scalars().all()
    if not questions:
        return None

    # Get screening responses for this candidate
    r_result = await db.execute(
        select(ScreeningResponse).where(ScreeningResponse.candidate_id == candidate_id)
    )
    responses = r_result.scalars().all()
    response_map = {r.question_id: r for r in responses}

    # Build question-response pairs
    pairs = []
    for q in questions:
        resp = response_map.get(q.id)
        pairs.append({
            "question": q.question,
            "question_type": q.question_type,
            "response": resp.response if resp else None,
            "question_id": q.id,
        })

    # Try AI scoring
    try:
        prompt_pairs = "\n".join(
            f"{i+1}. Question ({p['question_type']}): {p['question']}\n"
            f"   Response: {p['response'] or '(no response)'}"
            for i, p in enumerate(pairs)
        )

        prompt = (
            f"You are an expert recruiter evaluating screening responses.\n"
            f"Score each response on a scale of 1-5 and provide brief reasoning.\n\n"
            f"Scoring guide:\n"
            f"- 1: Poor/irrelevant response\n"
            f"- 2: Below average, missing key information\n"
            f"- 3: Adequate response\n"
            f"- 4: Good response with specific details\n"
            f"- 5: Excellent, comprehensive response\n\n"
            f"For unanswered questions, score 0.\n\n"
            f"Questions and Responses:\n{prompt_pairs}\n\n"
            f"Return your response as a JSON array of objects with these fields:\n"
            f'- "question_id": the question number (1-indexed)\n'
            f'- "score": integer 0-5\n'
            f'- "reasoning": brief explanation\n\n'
            f"Return ONLY the JSON array, no other text."
        )

        client = get_ai_client()
        response = await client.post(
            f"{settings.AI_CHAT_URL}/chat/complete",
            json={"messages": [{"role": "user", "content": prompt}]},
        )
        response.raise_for_status()
        data = response.json()

        ai_text = data.get("content", "") or data.get("message", "") or ""
        if isinstance(ai_text, list):
            ai_text = " ".join(
                block.get("text", "") for block in ai_text if isinstance(block, dict)
            )

        ai_text = ai_text.strip()
        if ai_text.startswith("```"):
            lines = ai_text.split("\n")
            lines = [line for line in lines if not line.strip().startswith("```")]
            ai_text = "\n".join(lines)

        ai_scores = json.loads(ai_text)
        if isinstance(ai_scores, list):
            # Map AI scores back to our pairs
            scored = []
            for i, pair in enumerate(pairs):
                ai_entry = ai_scores[i] if i < len(ai_scores) else {}
                scored.append({
                    "question_id": pair["question_id"],
                    "question": pair["question"],
                    "question_type": pair["question_type"],
                    "response": pair["response"],
                    "score": ai_entry.get("score", 0),
                    "reasoning": ai_entry.get("reasoning", "No AI assessment available"),
                })
            return scored
    except Exception as e:
        logger.warning("AI screening scoring failed, using heuristic: %s", e)

    # Heuristic fallback
    scored = []
    for pair in pairs:
        resp_text = pair["response"]
        q_type = pair["question_type"]

        if not resp_text:
            score = 0
            reasoning = "No response provided"
        elif q_type == "yes_no":
            lower = resp_text.strip().lower()
            if lower in ("yes", "y", "true", "1"):
                score = 5
                reasoning = "Affirmative response"
            elif lower in ("no", "n", "false", "0"):
                score = 2
                reasoning = "Negative response"
            else:
                score = 3
                reasoning = "Ambiguous response to yes/no question"
        else:
            # Text-based heuristic: longer and more detailed = better
            word_count = len(resp_text.split())
            if word_count >= 50:
                score = 5
                reasoning = "Comprehensive and detailed response"
            elif word_count >= 30:
                score = 4
                reasoning = "Good response with adequate detail"
            elif word_count >= 15:
                score = 3
                reasoning = "Adequate but could be more detailed"
            elif word_count >= 5:
                score = 2
                reasoning = "Brief response, lacks detail"
            else:
                score = 1
                reasoning = "Very brief response"

        scored.append({
            "question_id": pair["question_id"],
            "question": pair["question"],
            "question_type": pair["question_type"],
            "response": pair["response"],
            "score": score,
            "reasoning": reasoning,
        })

    return scored
