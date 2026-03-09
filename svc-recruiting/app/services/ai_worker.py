"""Background AI worker — polls ai_jobs table and processes pending jobs."""
import asyncio
import logging
from app.db.postgres import AsyncSessionLocal
from app.services.ai_queue_service import pick_next_pending_job, complete_ai_job, fail_ai_job
from app.services.candidate_service import evaluate_and_save_candidate_sync_ai
from app.core.config import settings

logger = logging.getLogger("svc-recruiting")

_running = False
_task: asyncio.Task = None


async def _process_one_job():
    """Pick and process a single AI job."""
    async with AsyncSessionLocal() as db:
        job = await pick_next_pending_job(db)
        if not job:
            return False  # nothing to process

        try:
            if job.type == "resume_scoring":
                result = await _process_resume_scoring(db, job)
                await complete_ai_job(db, job.id, result)
            elif job.type == "metadata_extraction":
                result = await _process_metadata_extraction(job)
                await complete_ai_job(db, job.id, result)
            else:
                await fail_ai_job(db, job.id, f"Unknown job type: {job.type}")
        except Exception as e:
            logger.error("AI worker error processing job %s: %s", job.id, e)
            await fail_ai_job(db, job.id, str(e))
            # Publish failure event
            try:
                from app.services.event_bus import publish_user_event
                input_data = job.input_data or {}
                await publish_user_event(
                    input_data.get("user_id", 0),
                    "candidate_evaluation_failed",
                    {"candidate_id": job.resource_id, "jd_id": input_data.get("jd_id"), "error": str(e)},
                )
            except Exception:
                pass

        return True


async def _process_resume_scoring(db, job):
    """Process a resume scoring job — calls AI and updates the CandidateJobEntry + CandidateProfile."""
    from sqlalchemy import select as sql_select, update as sql_update
    from app.db.models import CandidateJobEntry, CandidateProfile
    from app.services.candidate_service import derive_category

    input_data = job.input_data or {}
    resume_url = input_data.get("resume_url")
    jd_id = input_data.get("jd_id")
    use_rubric = input_data.get("use_rubric", True)

    if not resume_url or not jd_id:
        raise ValueError("Missing resume_url or jd_id in input_data")

    result = await evaluate_and_save_candidate_sync_ai(db, jd_id, resume_url, use_rubric)

    meta = result.get("metadata", {})
    current_role = meta.get("current_role", "")
    email = meta.get("email")
    full_name = meta.get("full_name")
    phone = meta.get("phone")

    # Update the job entry with AI results
    await db.execute(
        sql_update(CandidateJobEntry)
        .where(CandidateJobEntry.id == job.resource_id)
        .values(
            ai_resume_analysis=result,
            onboard=True,
        )
    )

    # Update the profile with identity info from AI
    entry_row = (await db.execute(
        sql_select(CandidateJobEntry).where(CandidateJobEntry.id == job.resource_id)
    )).scalar_one_or_none()

    if entry_row:
        profile_values = {"category": derive_category(current_role)}
        if full_name:
            profile_values["full_name"] = full_name
        if email:
            profile_values["email"] = email
        if phone:
            profile_values["phone"] = phone
        if resume_url:
            profile_values["resume_url"] = resume_url

        # Extract social links from AI metadata
        linkedin_url = meta.get("linkedin_url") or meta.get("linkedin")
        github_url = meta.get("github_url") or meta.get("github")
        portfolio_url = meta.get("portfolio_url") or meta.get("portfolio")
        if linkedin_url:
            profile_values["linkedin_url"] = linkedin_url
        if github_url:
            profile_values["github_url"] = github_url
        if portfolio_url:
            profile_values["portfolio_url"] = portfolio_url

        await db.execute(
            sql_update(CandidateProfile)
            .where(CandidateProfile.id == entry_row.profile_id)
            .values(**profile_values)
        )

    await db.commit()

    # Publish real-time event
    if entry_row:
        from app.services.event_bus import publish_user_event, publish_broadcast_event
        score = result.get("category_scores", {}).get("total_score", {})
        score_val = score.get("obtained_score", score.get("obtained", 0)) if isinstance(score, dict) else 0
        event_data = {"candidate_id": job.resource_id, "jd_id": jd_id, "score": score_val, "full_name": full_name or ""}
        await publish_user_event(entry_row.user_id, "candidate_evaluation_complete", event_data)
        await publish_broadcast_event("candidate_evaluation_complete", event_data)

    return result


async def _process_metadata_extraction(job):
    """Process a metadata extraction job."""
    from app.core.http_client import get_ai_client
    input_data = job.input_data or {}
    resume_url = input_data.get("resume_url")

    if not resume_url:
        raise ValueError("Missing resume_url in input_data")

    client = get_ai_client()
    resp = await client.post(
        f"{settings.AI_RESUME_URL}/resume/extract-metadata",
        json={"resume_file_link": resume_url},
    )
    resp.raise_for_status()
    return resp.json()


async def _worker_loop():
    """Main worker loop — polls every 2 seconds."""
    global _running
    while _running:
        try:
            processed = await _process_one_job()
            if not processed:
                await asyncio.sleep(2)
        except Exception as e:
            logger.error("AI worker loop error: %s", e)
            await asyncio.sleep(5)


async def start_worker():
    """Start the background AI worker."""
    global _running, _task
    if _running:
        return
    _running = True
    _task = asyncio.create_task(_worker_loop())
    logger.info("AI background worker started")


async def stop_worker():
    """Stop the background AI worker."""
    global _running, _task
    _running = False
    if _task:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
    logger.info("AI background worker stopped")
