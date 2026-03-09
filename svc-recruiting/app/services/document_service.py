"""Pipeline document template service — stage rules + candidate document management."""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.models import StageDocumentRule, CandidateDocument

logger = logging.getLogger(__name__)


async def get_stage_rules(db: AsyncSession, stage: Optional[str] = None) -> list[dict]:
    """List all stage-document rules, optionally filtered by stage."""
    q = select(StageDocumentRule).order_by(StageDocumentRule.stage, StageDocumentRule.sort_order)
    if stage:
        q = q.where(StageDocumentRule.stage == stage)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "stage": r.stage,
            "template_id": r.template_id,
            "template_name": r.template_name,
            "template_category": r.template_category,
            "is_required": r.is_required,
            "sort_order": r.sort_order,
            "created_by": r.created_by,
            "created_at": str(r.created_at),
        }
        for r in rows
    ]


async def create_stage_rule(
    db: AsyncSession,
    stage: str,
    template_id: int,
    template_name: str,
    template_category: Optional[str],
    is_required: bool,
    created_by: str,
) -> dict:
    """Create a new stage-document rule."""
    rule = StageDocumentRule(
        stage=stage,
        template_id=template_id,
        template_name=template_name,
        template_category=template_category,
        is_required=is_required,
        created_by=created_by,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {
        "id": rule.id,
        "stage": rule.stage,
        "template_id": rule.template_id,
        "template_name": rule.template_name,
        "template_category": rule.template_category,
        "is_required": rule.is_required,
        "sort_order": rule.sort_order,
        "created_by": rule.created_by,
        "created_at": str(rule.created_at),
    }


async def delete_stage_rule(db: AsyncSession, rule_id: int) -> bool:
    """Delete a stage-document rule."""
    result = await db.execute(select(StageDocumentRule).where(StageDocumentRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        return False
    await db.delete(rule)
    await db.commit()
    return True


async def auto_assign_documents(
    db: AsyncSession,
    candidate_id: int,
    jd_id: int,
    stage: str,
    created_by: str,
) -> int:
    """Auto-assign documents based on stage rules. Returns count of newly assigned docs."""
    rules = await db.execute(
        select(StageDocumentRule).where(StageDocumentRule.stage == stage)
        .order_by(StageDocumentRule.sort_order)
    )
    rules_list = rules.scalars().all()
    if not rules_list:
        return 0

    count = 0
    for rule in rules_list:
        # Use INSERT ... ON CONFLICT DO NOTHING to avoid duplicates
        stmt = pg_insert(CandidateDocument).values(
            candidate_id=candidate_id,
            jd_id=jd_id,
            template_id=rule.template_id,
            template_name=rule.template_name,
            stage=stage,
            status="pending",
        ).on_conflict_do_nothing(constraint="uq_cand_doc")
        result = await db.execute(stmt)
        if result.rowcount > 0:
            count += 1
    await db.commit()
    logger.info(f"Auto-assigned {count} documents for candidate {candidate_id} at stage {stage}")
    return count


async def get_candidate_documents(
    db: AsyncSession,
    candidate_id: int,
    jd_id: Optional[int] = None,
) -> list[dict]:
    """Get all documents assigned to a candidate."""
    q = select(CandidateDocument).where(CandidateDocument.candidate_id == candidate_id)
    if jd_id:
        q = q.where(CandidateDocument.jd_id == jd_id)
    q = q.order_by(CandidateDocument.created_at)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "candidate_id": r.candidate_id,
            "jd_id": r.jd_id,
            "template_id": r.template_id,
            "template_name": r.template_name,
            "stage": r.stage,
            "status": r.status,
            "content": r.content,
            "variables": r.variables,
            "generated_by": r.generated_by,
            "generated_at": str(r.generated_at) if r.generated_at else None,
            "created_at": str(r.created_at),
        }
        for r in rows
    ]


async def update_document_status(
    db: AsyncSession,
    doc_id: int,
    status: str,
    content: Optional[str] = None,
    variables: Optional[dict] = None,
    generated_by: Optional[str] = None,
) -> dict | None:
    """Update a candidate document's status and optionally its content."""
    result = await db.execute(select(CandidateDocument).where(CandidateDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        return None

    doc.status = status
    if content is not None:
        doc.content = content
    if variables is not None:
        doc.variables = variables
    if generated_by:
        doc.generated_by = generated_by
        doc.generated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(doc)
    return {
        "id": doc.id,
        "candidate_id": doc.candidate_id,
        "jd_id": doc.jd_id,
        "template_id": doc.template_id,
        "template_name": doc.template_name,
        "stage": doc.stage,
        "status": doc.status,
        "content": doc.content,
        "variables": doc.variables,
        "generated_by": doc.generated_by,
        "generated_at": str(doc.generated_at) if doc.generated_at else None,
        "created_at": str(doc.created_at),
    }
