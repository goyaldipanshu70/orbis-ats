"""Pipeline document template service — stage rules + candidate document management."""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.config import settings
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


async def auto_assign_and_generate_documents(
    db: AsyncSession,
    candidate_id: int,
    jd_id: int,
    stage: str,
    created_by: str,
    extra_variables: dict | None = None,
) -> list[int]:
    """Auto-assign documents for a stage, then generate them with candidate/job variables.
    Returns list of generated CandidateDocument IDs."""
    # First, assign documents based on stage rules
    await auto_assign_documents(db, candidate_id, jd_id, stage, created_by)

    # Fetch all pending documents for this candidate/job/stage
    result = await db.execute(
        select(CandidateDocument).where(
            CandidateDocument.candidate_id == candidate_id,
            CandidateDocument.jd_id == jd_id,
            CandidateDocument.stage == stage,
            CandidateDocument.status == "pending",
        )
    )
    docs = result.scalars().all()
    if not docs:
        return []

    # Build variables from candidate profile and job data
    variables = await _build_template_variables(db, candidate_id, jd_id)
    if extra_variables:
        variables.update(extra_variables)

    generated_ids = []
    for doc in docs:
        try:
            # Fetch template content from svc-admin
            template_content = await _fetch_template_content(doc.template_id)
            if not template_content:
                continue

            # Render template
            rendered = template_content
            for key, value in variables.items():
                rendered = rendered.replace("{{" + key + "}}", str(value or ""))

            doc.content = rendered
            doc.variables = variables
            doc.status = "generated"
            doc.generated_by = created_by
            doc.generated_at = datetime.utcnow()
            generated_ids.append(doc.id)
        except Exception:
            logger.exception(f"Failed to generate document {doc.id} for candidate {candidate_id}")

    await db.commit()
    logger.info(f"Auto-generated {len(generated_ids)} documents for candidate {candidate_id} at stage {stage}")
    return generated_ids


async def _build_template_variables(db: AsyncSession, candidate_id: int, jd_id: int) -> dict:
    """Build a variables dict from candidate profile and job data."""
    from app.db.models import CandidateJobEntry, CandidateProfile, JobDescription

    # Get candidate info
    entry_result = await db.execute(
        select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
    )
    entry = entry_result.scalar_one_or_none()

    profile = None
    if entry:
        profile_result = await db.execute(
            select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
        )
        profile = profile_result.scalar_one_or_none()

    # Get job info
    jd_result = await db.execute(
        select(JobDescription).where(JobDescription.id == jd_id)
    )
    jd = jd_result.scalar_one_or_none()
    ai = jd.ai_result if jd and isinstance(jd.ai_result, dict) else {}

    return {
        "candidate_name": profile.full_name if profile else "Candidate",
        "email": profile.email if profile else "",
        "phone": profile.phone if profile else "",
        "job_title": ai.get("job_title", "Open Position"),
        "company_name": settings.COMPANY_NAME if hasattr(settings, "COMPANY_NAME") else "Our Company",
        "position_title": ai.get("job_title", ""),
        "date": datetime.utcnow().strftime("%B %d, %Y"),
    }


async def _fetch_template_content(template_id: int) -> str | None:
    """Fetch template content from svc-admin."""
    try:
        from app.core.config import settings
        import httpx
        async with httpx.AsyncClient() as client:
            url = f"{settings.ADMIN_SERVICE_URL}/api/admin/templates/{template_id}"
            resp = await client.get(url, headers={"X-Internal-Key": settings.INTERNAL_KEY}, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("content", "")
    except Exception:
        logger.exception(f"Failed to fetch template {template_id} from svc-admin")
    return None


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
