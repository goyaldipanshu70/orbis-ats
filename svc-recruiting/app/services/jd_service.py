import logging
import math
from typing import Dict, List, Optional, Union
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from app.core.config import settings
from app.core.http_client import get_ai_client
from app.db.models import JobDescription, CandidateJobEntry, JobLocationVacancy

logger = logging.getLogger("svc-recruiting")


async def evaluate_jd(jd_url: str) -> dict:
    payload = {"jd_file_link": jd_url}
    try:
        client = get_ai_client()
        response = await client.post(f"{settings.AI_JD_URL}/jd/extract/jd", json=payload)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error("JD evaluation failed: %s", e)
        raise


async def check_duplicate_job(db: AsyncSession, title: str, locations: List[Dict]) -> Optional[Dict]:
    """Check if an Open job with the same title already exists in any of the given cities."""
    cities = [loc.get("city", "") for loc in locations if loc.get("city")]
    if not cities:
        return None
    for city in cities:
        result = await db.execute(
            select(JobDescription).where(
                JobDescription.status == "Open",
                JobDescription.deleted_at.is_(None),
                func.lower(JobDescription.city) == city.lower(),
                func.lower(JobDescription.ai_result["job_title"].astext) == title.lower(),
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            ai = existing.ai_result or {}
            return {"id": existing.id, "title": ai.get("job_title", "Untitled"), "city": city}
    return None


async def submit_jd_to_db(
    db: AsyncSession,
    user_id: str,
    ai_result: Dict,
    rubric_text: str = "",
    model_answer_text: str = "",
    uploaded_file_details_list: Optional[List[Dict]] = None,
    number_of_vacancies: int = 1,
    rejection_lock_days: Optional[int] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    location_vacancies: Optional[List[Dict]] = None,
    job_type: Optional[str] = None,
    position_type: Optional[str] = None,
    experience_range: Optional[str] = None,
    salary_range_min: Optional[float] = None,
    salary_range_max: Optional[float] = None,
    salary_currency: Optional[str] = None,
    salary_visibility: str = "hidden",
    location_type: Optional[str] = None,
    hiring_close_date: Optional[str] = None,
) -> str:
    # If multi-location provided, compute total vacancies and use first location for backward compat
    if location_vacancies:
        number_of_vacancies = sum(loc.get("vacancies", 1) for loc in location_vacancies)
        country = location_vacancies[0].get("country", country)
        city = location_vacancies[0].get("city", city)

    # Parse hiring_close_date if string
    parsed_close_date = None
    if hiring_close_date:
        try:
            parsed_close_date = datetime.fromisoformat(hiring_close_date)
        except (ValueError, TypeError):
            pass

    jd = JobDescription(
        user_id=user_id,
        ai_result=ai_result,
        rubric_text=rubric_text or "",
        model_answer_text=model_answer_text or "",
        uploaded_file_info=uploaded_file_details_list or [],
        status="Open",
        number_of_vacancies=max(1, number_of_vacancies),
        rejection_lock_days=rejection_lock_days,
        country=country,
        city=city,
        job_type=job_type,
        position_type=position_type,
        experience_range=experience_range,
        salary_range_min=salary_range_min,
        salary_range_max=salary_range_max,
        salary_currency=salary_currency or "USD",
        salary_visibility=salary_visibility or "hidden",
        location_type=location_type,
        hiring_close_date=parsed_close_date,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(jd)
    await db.commit()
    await db.refresh(jd)

    # Insert location vacancy rows
    locs = location_vacancies or []
    if not locs and country and city:
        # Old-style single location — create one row for consistency
        locs = [{"country": country, "city": city, "vacancies": max(1, number_of_vacancies)}]
    for loc in locs:
        db.add(JobLocationVacancy(
            jd_id=jd.id,
            country=loc["country"],
            city=loc["city"],
            vacancies=max(1, loc.get("vacancies", 1)),
        ))
    if locs:
        await db.commit()

    return str(jd.id)


async def extract_rubric_text(rubric_url: str) -> str:
    payload = {"rubric_file_link": rubric_url}
    try:
        client = get_ai_client()
        response = await client.post(f"{settings.AI_JD_URL}/jd/extract/rubric", json=payload)
        response.raise_for_status()
        return response.json().get("rubric_text", "")
    except Exception as e:
        logger.error("Rubric extraction failed: %s", e)
        raise


async def extract_model_answer_text(model_answer_url: str) -> str:
    payload = {"model_answer_file_link": model_answer_url}
    try:
        client = get_ai_client()
        response = await client.post(f"{settings.AI_JD_URL}/jd/extract/model-answer", json=payload)
        response.raise_for_status()
        return response.json().get("model_answer_text", "")
    except Exception as e:
        logger.error("Model answer extraction failed: %s", e)
        raise


def _jd_to_dict(jd: JobDescription) -> dict:
    return {
        "_id": str(jd.id),
        "user_id": jd.user_id,
        "ai_result": jd.ai_result,
        "rubric_text": jd.rubric_text,
        "model_answer_text": jd.model_answer_text,
        "uploaded_file_info": jd.uploaded_file_info,
        "status": jd.status,
        "visibility": getattr(jd, "visibility", "internal"),
        "country": jd.country,
        "city": jd.city,
        "number_of_vacancies": jd.number_of_vacancies,
        "job_type": getattr(jd, "job_type", None),
        "position_type": getattr(jd, "position_type", None),
        "experience_range": getattr(jd, "experience_range", None),
        "salary_range_min": float(jd.salary_range_min) if getattr(jd, "salary_range_min", None) else None,
        "salary_range_max": float(jd.salary_range_max) if getattr(jd, "salary_range_max", None) else None,
        "salary_currency": getattr(jd, "salary_currency", None),
        "salary_visibility": getattr(jd, "salary_visibility", "hidden"),
        "location_type": getattr(jd, "location_type", None),
        "hiring_close_date": jd.hiring_close_date if getattr(jd, "hiring_close_date", None) else None,
        "created_at": jd.created_at,
        "updated_at": jd.updated_at,
    }


async def get_all_jobs(db: AsyncSession, job_id: Optional[str] = None, page: int = 1, page_size: int = 20, search: Optional[str] = None, status: Optional[str] = None) -> Union[Dict, None]:
    if job_id:
        result = await db.execute(
            select(JobDescription).where(JobDescription.id == int(job_id), JobDescription.deleted_at.is_(None))
        )
        jd = result.scalar_one_or_none()
        return _jd_to_dict(jd) if jd else None
    conditions = [JobDescription.deleted_at.is_(None)]
    if status:
        conditions.append(JobDescription.status == status)
    if search:
        conditions.append(JobDescription.ai_result['job_title'].astext.ilike(f'%{search}%'))
    total = (await db.execute(select(func.count()).select_from(JobDescription).where(*conditions))).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(
        select(JobDescription).where(*conditions).order_by(JobDescription.created_at.desc()).offset(offset).limit(page_size)
    )
    return {
        "items": [_jd_to_dict(jd) for jd in result.scalars().all()],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


async def get_jobs_for_user(db: AsyncSession, user_id: str, job_id: Optional[str] = None, page: int = 1, page_size: int = 20, search: Optional[str] = None, status: Optional[str] = None) -> Union[Dict, None]:
    if job_id:
        result = await db.execute(
            select(JobDescription).where(JobDescription.id == int(job_id), JobDescription.user_id == user_id, JobDescription.deleted_at.is_(None))
        )
        jd = result.scalar_one_or_none()
        return _jd_to_dict(jd) if jd else None
    base = [JobDescription.user_id == user_id, JobDescription.deleted_at.is_(None)]
    if status:
        base.append(JobDescription.status == status)
    if search:
        base.append(JobDescription.ai_result['job_title'].astext.ilike(f'%{search}%'))
    total = (await db.execute(select(func.count()).select_from(JobDescription).where(*base))).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(
        select(JobDescription).where(*base).order_by(JobDescription.created_at.desc()).offset(offset).limit(page_size)
    )
    return {
        "items": [_jd_to_dict(jd) for jd in result.scalars().all()],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


async def delete_job_by_id(db: AsyncSession, job_id: str, user_id: str) -> bool:
    result = await db.execute(
        update(JobDescription)
        .where(JobDescription.id == int(job_id), JobDescription.deleted_at.is_(None))
        .values(deleted_at=datetime.utcnow(), deleted_by=user_id)
    )
    await db.commit()
    return result.rowcount > 0


async def update_job_status(db: AsyncSession, job_id: str, user_id: str, status: str) -> bool:
    result = await db.execute(
        update(JobDescription)
        .where(JobDescription.id == int(job_id))
        .values(status=status, updated_at=datetime.utcnow())
    )
    await db.commit()
    return result.rowcount > 0


async def get_jobs_for_import(db: AsyncSession, user_id: str, exclude_job_id: str) -> list:
    result = await db.execute(
        select(JobDescription).where(JobDescription.id != int(exclude_job_id), JobDescription.deleted_at.is_(None))
    )
    jobs = result.scalars().all()
    output = []
    for job in jobs:
        count_result = await db.execute(
            select(func.count()).select_from(CandidateJobEntry).where(CandidateJobEntry.jd_id == job.id, CandidateJobEntry.deleted_at.is_(None))
        )
        candidate_count = count_result.scalar_one()
        output.append({
            "job_id": str(job.id),
            "job_title": job.ai_result.get("job_title", "Untitled") if isinstance(job.ai_result, dict) else "Untitled",
            "status": job.status,
            "candidate_count": candidate_count,
        })
    return output


async def search_jobs(db: AsyncSession, query: str, exclude_job_id: str, limit: int = 10) -> list:
    """Typeahead search for jobs by title (JSONB text match). Returns top `limit` matches."""
    from sqlalchemy import or_

    where_clauses = [
        JobDescription.id != int(exclude_job_id),
        JobDescription.deleted_at.is_(None),
    ]
    if query.strip():
        pattern = f"%{query.strip().lower()}%"
        where_clauses.append(
            func.lower(JobDescription.ai_result["job_title"].astext).like(pattern)
        )

    result = await db.execute(
        select(JobDescription)
        .where(*where_clauses)
        .order_by(JobDescription.created_at.desc())
        .limit(limit)
    )
    jobs = result.scalars().all()

    # Batch-load candidate counts in one query
    job_ids = [j.id for j in jobs]
    count_map = {}
    if job_ids:
        count_result = await db.execute(
            select(CandidateJobEntry.jd_id, func.count())
            .where(CandidateJobEntry.jd_id.in_(job_ids), CandidateJobEntry.deleted_at.is_(None))
            .group_by(CandidateJobEntry.jd_id)
        )
        count_map = dict(count_result.all())

    return [
        {
            "job_id": str(j.id),
            "job_title": j.ai_result.get("job_title", "Untitled") if isinstance(j.ai_result, dict) else "Untitled",
            "status": j.status,
            "candidate_count": count_map.get(j.id, 0),
        }
        for j in jobs
    ]


async def get_location_vacancies(db: AsyncSession, jd_id: int) -> List[Dict]:
    """Get all location vacancy rows for a job, enriched with hired counts."""
    result = await db.execute(
        select(JobLocationVacancy).where(JobLocationVacancy.jd_id == jd_id).order_by(JobLocationVacancy.id)
    )
    locations = result.scalars().all()
    if not locations:
        return []

    loc_ids = [loc.id for loc in locations]
    # Count hired candidates per location
    hired_result = await db.execute(
        select(CandidateJobEntry.hired_location_id, func.count())
        .where(
            CandidateJobEntry.jd_id == jd_id,
            CandidateJobEntry.pipeline_stage == "hired",
            CandidateJobEntry.deleted_at.is_(None),
            CandidateJobEntry.hired_location_id.in_(loc_ids),
        )
        .group_by(CandidateJobEntry.hired_location_id)
    )
    hired_map = dict(hired_result.all())

    return [
        {
            "id": loc.id,
            "country": loc.country,
            "city": loc.city,
            "vacancies": loc.vacancies,
            "hired_count": hired_map.get(loc.id, 0),
            "is_full": hired_map.get(loc.id, 0) >= loc.vacancies,
        }
        for loc in locations
    ]


async def get_available_hire_locations(db: AsyncSession, jd_id: int) -> List[Dict]:
    """Get only locations that still have open vacancies."""
    all_locs = await get_location_vacancies(db, jd_id)
    return [loc for loc in all_locs if not loc["is_full"]]
