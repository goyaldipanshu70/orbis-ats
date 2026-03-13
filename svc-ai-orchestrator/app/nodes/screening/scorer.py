"""Node that scores screening responses using LLM."""
import json
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SCORE_PROMPT = """Rate this screening response on a 1-5 scale:

Question: {question}
Expected answer type: {question_type}
Candidate response: {response}

Return ONLY valid JSON: {{"score": 4, "reasoning": "Clear, specific answer demonstrating relevant experience"}}

Scale:
5 = Exceptional — detailed, specific, directly relevant
4 = Good — clear and relevant, some detail
3 = Adequate — answers the question but lacks depth
2 = Weak — vague or partially off-topic
1 = Poor — no meaningful answer or completely off-topic
"""


async def score_screening_responses(db: AsyncSession, candidate_id: int, jd_id: int) -> dict:
    """Score all screening responses for a candidate-job pair."""
    from app.tools.hiring_tools import _models_cache
    m = _models_cache()

    ScreeningQuestion = m["ScreeningQuestion"]
    ScreeningResponse = m["ScreeningResponse"]

    # Get questions for this job
    sq_result = await db.execute(
        select(ScreeningQuestion).where(ScreeningQuestion.jd_id == jd_id)
    )
    questions = sq_result.scalars().all()
    if not questions:
        return {"question_scores": [], "overall_score": 0.0}

    question_ids = [q.id for q in questions]

    # Get candidate's responses
    sr_result = await db.execute(
        select(ScreeningResponse).where(
            ScreeningResponse.candidate_id == candidate_id,
            ScreeningResponse.question_id.in_(question_ids),
        )
    )
    responses = sr_result.scalars().all()
    response_map = {r.question_id: r.response for r in responses}

    llm = get_llm_for_workflow("screening_scoring", temperature=0.1)
    question_scores = []

    for q in questions:
        resp_text = response_map.get(q.id, "")
        if not resp_text:
            question_scores.append({
                "question_id": q.id,
                "question": q.question,
                "score": 0,
                "reasoning": "No response provided",
            })
            continue

        prompt = SCORE_PROMPT.format(
            question=q.question,
            question_type=q.question_type or "text",
            response=resp_text,
        )
        messages = [{"role": "user", "content": prompt}]

        try:
            response = await llm.ainvoke(messages)
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            scored = json.loads(content.strip())
            question_scores.append({
                "question_id": q.id,
                "question": q.question,
                "score": min(max(scored.get("score", 3), 1), 5),
                "reasoning": scored.get("reasoning", ""),
            })
        except Exception as e:
            logger.error(f"Failed to score question {q.id}: {e}")
            question_scores.append({
                "question_id": q.id,
                "question": q.question,
                "score": 3,
                "reasoning": "Scoring failed — default score applied",
            })

    # Overall score: average of all scores, scaled to 0-100
    scores_only = [qs["score"] for qs in question_scores if qs["score"] > 0]
    overall = (sum(scores_only) / (len(scores_only) * 5) * 100) if scores_only else 0.0

    return {
        "question_scores": question_scores,
        "overall_score": round(overall, 1),
    }
