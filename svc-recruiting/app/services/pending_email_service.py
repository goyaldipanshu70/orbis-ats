"""Service for managing deferred stage-change emails with undo window."""
import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PendingStageEmail, CandidateDocument, CandidateJobEntry, CandidateProfile, JobDescription
from app.services.email_service import send_email_with_attachments
from app.services.email_templates import stage_changed, rejection, offer_sent

logger = logging.getLogger(__name__)

SEND_DELAY_SECONDS = 10


async def create_pending_email(
    db: AsyncSession,
    candidate_id: int,
    jd_id: int,
    from_stage: str,
    to_stage: str,
    created_by: str,
    attachment_doc_ids: list[int] | None = None,
    custom_subject: str | None = None,
    custom_body: str | None = None,
) -> int:
    """Create a pending stage email. Returns the pending email ID."""
    if custom_subject and custom_body:
        subject = custom_subject
        body_html = custom_body
    else:
        subject, body_html = await _build_stage_email(db, candidate_id, jd_id, from_stage, to_stage)

    email = PendingStageEmail(
        candidate_id=candidate_id,
        jd_id=jd_id,
        from_stage=from_stage,
        to_stage=to_stage,
        subject=subject,
        body_html=body_html,
        attachment_doc_ids=attachment_doc_ids or [],
        status="pending",
        send_after=datetime.utcnow() + timedelta(seconds=SEND_DELAY_SECONDS),
        created_by=created_by,
    )
    db.add(email)
    await db.commit()
    await db.refresh(email)
    logger.info(f"Created pending email {email.id} for candidate {candidate_id} → {to_stage}")
    return email.id


async def cancel_pending_email(db: AsyncSession, email_id: int) -> bool:
    """Cancel a pending email. Returns True if cancelled, False if already sent."""
    result = await db.execute(
        select(PendingStageEmail).where(
            PendingStageEmail.id == email_id,
            PendingStageEmail.status == "pending",
        )
    )
    email = result.scalar_one_or_none()
    if not email:
        return False

    email.status = "cancelled"
    email.cancelled_at = datetime.utcnow()
    await db.commit()
    logger.info(f"Cancelled pending email {email_id}")
    return True


async def get_pending_email(db: AsyncSession, email_id: int) -> PendingStageEmail | None:
    result = await db.execute(
        select(PendingStageEmail).where(PendingStageEmail.id == email_id)
    )
    return result.scalar_one_or_none()


async def process_pending_emails(db: AsyncSession) -> int:
    """Process all pending emails whose send_after has passed. Returns count sent."""
    result = await db.execute(
        select(PendingStageEmail).where(
            PendingStageEmail.status == "pending",
            PendingStageEmail.send_after <= datetime.utcnow(),
        ).order_by(PendingStageEmail.created_at.asc()).limit(10)
    )
    emails = result.scalars().all()
    sent_count = 0

    for email in emails:
        try:
            # Resolve candidate email
            entry_result = await db.execute(
                select(CandidateJobEntry).where(CandidateJobEntry.id == email.candidate_id)
            )
            entry = entry_result.scalar_one_or_none()
            if not entry:
                email.status = "cancelled"
                email.cancelled_at = datetime.utcnow()
                continue

            profile_result = await db.execute(
                select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
            )
            profile = profile_result.scalar_one_or_none()
            if not profile or not profile.email:
                email.status = "cancelled"
                email.cancelled_at = datetime.utcnow()
                continue

            # Build attachments from CandidateDocument IDs
            attachments = []
            if email.attachment_doc_ids:
                doc_result = await db.execute(
                    select(CandidateDocument).where(
                        CandidateDocument.id.in_(email.attachment_doc_ids),
                        CandidateDocument.status == "generated",
                    )
                )
                docs = doc_result.scalars().all()
                for doc in docs:
                    if doc.content:
                        attachments.append({
                            "filename": f"{doc.template_name.replace(' ', '_')}.html",
                            "content": doc.content,
                            "content_type": "text/html",
                        })
                        doc.status = "sent"

            # Send email
            success = await send_email_with_attachments(
                to=profile.email,
                subject=email.subject,
                body_html=email.body_html,
                attachments=attachments if attachments else None,
            )

            if success:
                email.status = "sent"
                email.sent_at = datetime.utcnow()
                sent_count += 1
            else:
                logger.error(f"Failed to send pending email {email.id}")

        except Exception:
            logger.exception(f"Error processing pending email {email.id}")

    await db.commit()
    return sent_count


async def _build_stage_email(db: AsyncSession, candidate_id: int, jd_id: int, from_stage: str, to_stage: str) -> tuple[str, str]:
    """Build email subject and HTML body for a stage change."""
    from app.services.email_service import _wrap_html

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

    jd_result = await db.execute(
        select(JobDescription).where(JobDescription.id == jd_id)
    )
    jd = jd_result.scalar_one_or_none()
    ai = jd.ai_result if jd and isinstance(jd.ai_result, dict) else {}

    candidate_name = profile.full_name if profile else "Candidate"
    job_title = ai.get("job_title", "Open Position")

    # Template functions return (subject, body) tuples
    if to_stage == "rejected":
        subject, body = rejection(job_title, candidate_name)
    elif to_stage == "offer":
        subject, body = offer_sent(job_title, candidate_name, job_title)
    else:
        subject, body = stage_changed(job_title, candidate_name, to_stage)

    body_html = _wrap_html(body)

    return subject, body_html


# ── Background worker ──────────────────────────────────────────────────

_running = False
_task = None


async def start_pending_email_worker():
    global _running, _task
    _running = True
    _task = asyncio.create_task(_worker_loop())
    logger.info("Pending email worker started")


async def stop_pending_email_worker():
    global _running, _task
    _running = False
    if _task:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
    logger.info("Pending email worker stopped")


async def _worker_loop():
    from app.db.postgres import AsyncSessionLocal
    global _running
    while _running:
        try:
            async with AsyncSessionLocal() as db:
                count = await process_pending_emails(db)
                if count > 0:
                    logger.info(f"Sent {count} pending stage emails")
        except Exception:
            logger.exception("Pending email worker error")
        await asyncio.sleep(5)
