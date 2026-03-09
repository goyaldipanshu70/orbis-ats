"""Document template pipeline routes — stage rules + candidate documents."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.db.postgres import get_db
from app.core.security import get_current_user, require_employee
from app.services.document_service import (
    get_stage_rules,
    create_stage_rule,
    delete_stage_rule,
    get_candidate_documents,
    update_document_status,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────

class CreateStageRuleRequest(BaseModel):
    stage: str
    template_id: int
    template_name: str
    template_category: Optional[str] = None
    is_required: bool = True


class UpdateDocStatusRequest(BaseModel):
    status: str
    content: Optional[str] = None
    variables: Optional[dict] = None


class GenerateDocRequest(BaseModel):
    variables: dict = {}


# ── Stage Document Rules ─────────────────────────────────────────────

@router.get("/stage-document-rules")
async def list_stage_rules(
    stage: Optional[str] = None,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """List all stage-document rules, optionally filtered by stage."""
    rules = await get_stage_rules(db, stage=stage)
    # Group by stage for convenience
    grouped: dict[str, list] = {}
    for rule in rules:
        grouped.setdefault(rule["stage"], []).append(rule)
    return {"rules": rules, "by_stage": grouped}


@router.post("/stage-document-rules")
async def create_rule(
    payload: CreateStageRuleRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Create a stage-document rule (admin/HR only)."""
    user_role = user.get("role", "")
    if user_role not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="Only admin/HR can manage stage rules")
    created_by = user.get("first_name", "") or str(user.get("sub", ""))
    rule = await create_stage_rule(
        db,
        stage=payload.stage,
        template_id=payload.template_id,
        template_name=payload.template_name,
        template_category=payload.template_category,
        is_required=payload.is_required,
        created_by=created_by,
    )
    return rule


@router.delete("/stage-document-rules/{rule_id}")
async def remove_rule(
    rule_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Delete a stage-document rule (admin/HR only)."""
    user_role = user.get("role", "")
    if user_role not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="Only admin/HR can manage stage rules")
    deleted = await delete_stage_rule(db, rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"deleted": True}


# ── Candidate Documents ──────────────────────────────────────────────

@router.get("/{candidate_id}/documents")
async def list_candidate_documents(
    candidate_id: int,
    jd_id: Optional[int] = None,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """List documents assigned to a candidate."""
    docs = await get_candidate_documents(db, candidate_id, jd_id=jd_id)
    return {"documents": docs}


@router.put("/{candidate_id}/documents/{doc_id}/status")
async def update_doc_status(
    candidate_id: int,
    doc_id: int,
    payload: UpdateDocStatusRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Update document status (pending -> generated -> sent -> signed)."""
    user_name = user.get("first_name", "") or str(user.get("sub", ""))
    doc = await update_document_status(
        db, doc_id,
        status=payload.status,
        content=payload.content,
        variables=payload.variables,
        generated_by=user_name,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/{candidate_id}/documents/{doc_id}/generate")
async def generate_document(
    candidate_id: int,
    doc_id: int,
    payload: GenerateDocRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Generate a document by rendering the template with provided variables."""
    user_name = user.get("first_name", "") or str(user.get("sub", ""))

    # Fetch the document
    docs = await get_candidate_documents(db, candidate_id)
    target = next((d for d in docs if d["id"] == doc_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Document not found")

    # Try to render via svc-admin template API
    try:
        from app.core.http_client import get_ai_client
        client = get_ai_client()
        resp = await client.post(
            f"http://localhost:8003/api/admin/templates/{target['template_id']}/render",
            json={"variables": payload.variables},
            headers={"Authorization": f"Bearer {user.get('_token', '')}"},
            timeout=10.0,
        )
        if resp.status_code == 200:
            rendered = resp.json()
            content = rendered.get("rendered_content", "")
        else:
            # Fallback: just store variables, no rendered content
            content = f"[Template: {target['template_name']}] Variables: {payload.variables}"
    except Exception as e:
        logger.warning(f"Template render failed, using fallback: {e}")
        content = f"[Template: {target['template_name']}] Variables: {payload.variables}"

    doc = await update_document_status(
        db, doc_id,
        status="generated",
        content=content,
        variables=payload.variables,
        generated_by=user_name,
    )
    return doc
