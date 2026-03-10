from uuid import uuid4
import os
import json
from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user, require_employee
from app.core.config import settings
from app.utils.file_validation import validate_resume_upload
from app.services.jd_service import (
    evaluate_jd,
    extract_rubric_text,
    extract_model_answer_text,
    submit_jd_to_db,
    check_duplicate_job,
    get_jobs_for_user as get_jobs_for_user_service,
    get_all_jobs as get_all_jobs_service,
    delete_job_by_id,
    update_job_status,
    get_jobs_for_import,
    search_jobs,
    get_location_vacancies,
    get_available_hire_locations,
)
from app.services.candidate_service import get_candidates_analytics, get_job_statistics
from app.schemas.job_schema import (
    JDExtractResponse,
    JDSubmitResponse,
    JobResponse,
    UploadedFileSchema,
    JobStatisticsSchema,
    JobStatusUpdateRequest,
    LocationVacancySchema,
    JobEditRequest,
)
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timezone


router = APIRouter()


@router.post("/extract/jd", response_model=JDExtractResponse)
async def upload_jd_only(
    jd_file: UploadFile = File(...),
    user: dict = Depends(require_employee)
):
    contents = await jd_file.read()

    # Validate real file type via magic bytes
    await validate_resume_upload(jd_file, contents)

    jd_filename = f"{uuid4()}_{jd_file.filename}"
    jd_path = os.path.join(settings.UPLOAD_BASE, "jd", jd_filename)
    os.makedirs(os.path.dirname(jd_path), exist_ok=True)
    with open(jd_path, "wb") as f:
        f.write(contents)

    jd_url = f"{settings.BACKEND_DOMAIN}/files/jd/{jd_filename}"
    try:
        ai_result = await evaluate_jd(jd_url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {str(e)}")

    return JDExtractResponse(ai_result=ai_result)


@router.post("/submit", response_model=JDSubmitResponse)
async def submit_all_data(
    ai_result: str = Form(...),
    number_of_vacancies: int = Form(1),
    rejection_lock_days: Optional[int] = Form(None),
    country: str = Form(""),
    city: str = Form(""),
    location_vacancies: str = Form("[]"),
    job_type: Optional[str] = Form(None),
    position_type: Optional[str] = Form(None),
    experience_range: Optional[str] = Form(None),
    salary_range_min: Optional[float] = Form(None),
    salary_range_max: Optional[float] = Form(None),
    salary_currency: Optional[str] = Form(None),
    salary_visibility: str = Form("hidden"),
    location_type: Optional[str] = Form(None),
    hiring_close_date: Optional[str] = Form(None),
    rubric_file: UploadFile = File(None),
    model_answer_file: UploadFile = File(None),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    rubric_text = ""
    model_answer_text = ""
    uploaded_file_details_list = []

    if rubric_file:
        file_content = await rubric_file.read()

        # Validate real file type via magic bytes
        await validate_resume_upload(rubric_file, file_content)

        rubric_filename = f"{uuid4()}_{rubric_file.filename}"
        rubric_path = os.path.join(settings.UPLOAD_BASE, "rubric", rubric_filename)
        os.makedirs(os.path.dirname(rubric_path), exist_ok=True)
        with open(rubric_path, "wb") as f:
            f.write(file_content)
        rubric_file_link = f"{settings.BACKEND_DOMAIN}/files/rubric/{rubric_filename}"
        rubric_text = await extract_rubric_text(rubric_file_link)

        rubric_details = {
            "file_id": rubric_filename,
            "file_name": rubric_file.filename,
            "file_type": "rubric",
            "display_name": "Evaluation Rubric",
            "upload_date": datetime.now(timezone.utc).isoformat(),
            "file_size": rubric_file.size if rubric_file.size else len(file_content),
            "file_link": rubric_file_link
        }
        uploaded_file_details_list.append(rubric_details)

    if model_answer_file:
        file_content_model = await model_answer_file.read()

        # Validate real file type via magic bytes
        await validate_resume_upload(model_answer_file, file_content_model)

        model_filename = f"{uuid4()}_{model_answer_file.filename}"
        model_path = os.path.join(settings.UPLOAD_BASE, "model_answer", model_filename)
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        with open(model_path, "wb") as f:
            f.write(file_content_model)
        model_answer_file_link = f"{settings.BACKEND_DOMAIN}/files/model_answer/{model_filename}"
        model_answer_text = await extract_model_answer_text(model_answer_file_link)

        model_answer_details = {
            "file_id": model_filename,
            "file_name": model_answer_file.filename,
            "file_type": "model_answer",
            "display_name": "Model Answers",
            "upload_date": datetime.now(timezone.utc).isoformat(),
            "file_size": model_answer_file.size if model_answer_file.size else len(file_content_model),
            "file_link": model_answer_file_link
        }
        uploaded_file_details_list.append(model_answer_details)

    try:
        parsed_ai_result = json.loads(ai_result)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ai_result format")

    # Parse location_vacancies
    try:
        parsed_locations = json.loads(location_vacancies) if location_vacancies else []
    except Exception:
        parsed_locations = []
    # If no locations provided but country/city given, construct single-element array
    if not parsed_locations and country and city:
        parsed_locations = [{"country": country, "city": city, "vacancies": number_of_vacancies}]

    # Duplicate check — block if an Open job with same title exists in same city
    job_title = parsed_ai_result.get("ai_result", {}).get("job_title", "")
    if job_title and parsed_locations:
        dup = await check_duplicate_job(db, job_title, parsed_locations)
        if dup:
            raise HTTPException(
                status_code=409,
                detail=f'A job titled "{dup["title"]}" is already open in {dup.get("city", city)} (Job ID: {dup["id"]})',
            )

    jd_id = await submit_jd_to_db(
        db=db,
        user_id=user["sub"],
        ai_result=parsed_ai_result["ai_result"],
        rubric_text=rubric_text,
        model_answer_text=model_answer_text,
        uploaded_file_details_list=uploaded_file_details_list,
        number_of_vacancies=number_of_vacancies,
        rejection_lock_days=rejection_lock_days,
        country=country or (parsed_locations[0]["country"] if parsed_locations else ""),
        city=city or (parsed_locations[0]["city"] if parsed_locations else ""),
        location_vacancies=parsed_locations if parsed_locations else None,
        job_type=job_type,
        position_type=position_type,
        experience_range=experience_range,
        salary_range_min=salary_range_min,
        salary_range_max=salary_range_max,
        salary_currency=salary_currency,
        salary_visibility=salary_visibility,
        location_type=location_type,
        hiring_close_date=hiring_close_date,
    )

    return JDSubmitResponse(
        message="JD and optional files saved successfully",
        jd_id=jd_id
    )


@router.get("")
async def get_user_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by job title"),
    status: Optional[str] = Query(None, description="Filter by job status"),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    user_id = user["sub"]
    if user["role"] == "admin" or user["role"] in ("admin", "hr", "hiring_manager"):
        paginated = await get_all_jobs_service(db, page=page, page_size=page_size, search=search, status=status)
    else:
        paginated = await get_jobs_for_user_service(db, user_id, page=page, page_size=page_size, search=search, status=status)
    job_documents = paginated["items"]
    if not job_documents:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}
    response_list = []
    for job_document in job_documents:
        ai_result = job_document.get("ai_result", {})
        job_title = ai_result.get("job_title", "N/A")
        rubric_summary = ai_result.get("summary", "N/A")

        extracted_rubric = ai_result.get("extracted_rubric", {})
        core_skills = extracted_rubric.get("core_skills", [])
        preferred_skills = extracted_rubric.get("preferred_skills", [])

        experience_desc = ""
        experience_req_data = extracted_rubric.get("experience_requirements", {})
        if isinstance(experience_req_data, dict):
            experience_desc = experience_req_data.get("description", "")
        elif isinstance(experience_req_data, str):
            experience_desc = experience_req_data
        elif isinstance(experience_req_data, list):
            experience_desc = "; ".join(str(x) for x in experience_req_data)

        education_req_data = extracted_rubric.get("educational_requirements", {})
        degree = ""
        field = ""
        education_req_str = ""
        if isinstance(education_req_data, dict):
            degree = education_req_data.get("degree", "")
            field = education_req_data.get("field", "")
            if degree and field:
                education_req_str = f"{degree} in {field}"
            elif degree:
                education_req_str = degree
            elif field:
                education_req_str = f"Study in {field}"
        elif isinstance(education_req_data, list):
            education_req_str = "; ".join(str(x) for x in education_req_data)
        elif isinstance(education_req_data, str):
            education_req_str = education_req_data

        key_requirements = []
        if isinstance(core_skills, list): key_requirements.extend(core_skills)
        if isinstance(preferred_skills, list): key_requirements.extend(preferred_skills)
        if experience_desc: key_requirements.append(experience_desc)
        if education_req_str: key_requirements.append(education_req_str)
        key_requirements = [req for req in key_requirements if req]

        created_date = job_document.get("created_at", datetime.utcnow())
        updated_date = job_document.get("updated_at", created_date)

        current_job_uploaded_file_info = job_document.get("uploaded_file_info", [])
        current_uploaded_files_list = []
        for file_info_dict in current_job_uploaded_file_info:
            try:
                current_uploaded_files_list.append(UploadedFileSchema(**file_info_dict))
            except Exception:
                pass

        statistics_data = await get_job_statistics(db, str(job_document["_id"]))
        statistics = JobStatisticsSchema(**statistics_data)

        loc_vacs = await get_location_vacancies(db, int(job_document["_id"]))
        loc_vac_schemas = [LocationVacancySchema(**lv) for lv in loc_vacs]

        response_list.append(
            JobResponse(
                job_id=str(job_document["_id"]),
                job_title=job_title,
                status=job_document.get("status", "Open"),
                visibility=job_document.get("visibility", "internal"),
                country=job_document.get("country"),
                city=job_document.get("city"),
                rubric_summary=rubric_summary,
                uploaded_files=current_uploaded_files_list,
                statistics=statistics,
                number_of_vacancies=job_document.get("number_of_vacancies", 1),
                key_requirements=key_requirements,
                created_date=created_date,
                updated_date=updated_date,
                location_vacancies=loc_vac_schemas,
                job_type=job_document.get("job_type"),
                position_type=job_document.get("position_type"),
                experience_range=job_document.get("experience_range"),
                salary_range_min=job_document.get("salary_range_min"),
                salary_range_max=job_document.get("salary_range_max"),
                salary_currency=job_document.get("salary_currency"),
                salary_visibility=job_document.get("salary_visibility", "hidden"),
                location_type=job_document.get("location_type"),
                hiring_close_date=job_document.get("hiring_close_date"),
            )
        )
    return {
        "items": response_list,
        "total": paginated["total"],
        "page": paginated["page"],
        "page_size": paginated["page_size"],
        "total_pages": paginated["total_pages"],
    }


@router.get("/{job_id}", response_model=JobResponse)
async def get_user_job(
    job_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    user_id = user["sub"]
    if user["role"] == "admin" or user["role"] in ("admin", "hr", "hiring_manager"):
        job_result = await get_all_jobs_service(db, job_id)
    else:
        job_result = await get_jobs_for_user_service(db, user_id, job_id)
    if not job_result:
        raise HTTPException(status_code=404, detail="Job not found")

    job_document = job_result if isinstance(job_result, dict) else job_result[0] if job_result else None
    if not job_document:
        raise HTTPException(status_code=404, detail="Job not found")

    ai_result = job_document.get("ai_result", {})
    job_title = ai_result.get("job_title", "N/A")
    rubric_summary = ai_result.get("summary", "N/A")

    extracted_rubric = ai_result.get("extracted_rubric", {})
    core_skills = extracted_rubric.get("core_skills", [])
    preferred_skills = extracted_rubric.get("preferred_skills", [])

    experience_req_data = extracted_rubric.get("experience_requirements", {})
    if isinstance(experience_req_data, dict):
        experience_req_desc = experience_req_data.get("description", "")
    elif isinstance(experience_req_data, list):
        experience_req_desc = "; ".join(str(x) for x in experience_req_data)
    elif isinstance(experience_req_data, str):
        experience_req_desc = experience_req_data
    else:
        experience_req_desc = ""

    education_req_data = extracted_rubric.get("educational_requirements", {})
    if isinstance(education_req_data, dict):
        education_degree = education_req_data.get("degree", "")
        education_field = education_req_data.get("field", "")
        education_req = f"{education_degree} in {education_field}" if education_degree or education_field else ""
    elif isinstance(education_req_data, list):
        education_req = "; ".join(str(x) for x in education_req_data)
    elif isinstance(education_req_data, str):
        education_req = education_req_data
    else:
        education_req = ""

    key_requirements = core_skills + preferred_skills
    if experience_req_desc:
        key_requirements.append(experience_req_desc)
    if education_req.strip() and education_req.strip() != "in":
        key_requirements.append(education_req)
    key_requirements = [req for req in key_requirements if req]

    created_date = job_document.get("created_at", datetime.utcnow())
    updated_date = job_document.get("updated_at", job_document.get("created_at", datetime.utcnow()))

    retrieved_uploaded_file_info = job_document.get("uploaded_file_info", [])
    uploaded_files_list = []
    for file_info_dict in retrieved_uploaded_file_info:
        try:
            uploaded_files_list.append(UploadedFileSchema(**file_info_dict))
        except Exception:
            pass

    statistics_data = await get_job_statistics(db, job_id)
    statistics = JobStatisticsSchema(**statistics_data)

    loc_vacs = await get_location_vacancies(db, int(job_id))
    loc_vac_schemas = [LocationVacancySchema(**lv) for lv in loc_vacs]

    return JobResponse(
        job_id=str(job_document["_id"]),
        job_title=job_title,
        status=job_document.get("status", "Open"),
        visibility=job_document.get("visibility", "internal"),
        country=job_document.get("country"),
        city=job_document.get("city"),
        rubric_summary=rubric_summary,
        uploaded_files=uploaded_files_list,
        statistics=statistics,
        number_of_vacancies=job_document.get("number_of_vacancies", 1),
        key_requirements=key_requirements,
        created_date=created_date,
        updated_date=updated_date,
        location_vacancies=loc_vac_schemas,
        job_type=job_document.get("job_type"),
        position_type=job_document.get("position_type"),
        experience_range=job_document.get("experience_range"),
        salary_range_min=job_document.get("salary_range_min"),
        salary_range_max=job_document.get("salary_range_max"),
        salary_currency=job_document.get("salary_currency"),
        salary_visibility=job_document.get("salary_visibility", "hidden"),
        location_type=job_document.get("location_type"),
        hiring_close_date=job_document.get("hiring_close_date"),
    )


@router.get("/{job_id}/available-locations")
async def get_available_locations(
    job_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    return await get_available_hire_locations(db, int(job_id))


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    success = await delete_job_by_id(db, job_id, user["sub"])
    if not success:
        raise HTTPException(status_code=404, detail="Job not found or unauthorized")
    return {"message": "Job deleted successfully"}


@router.put("/{job_id}/edit")
async def edit_job(
    job_id: str,
    payload: JobEditRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Edit job details including AI result fields and metadata."""
    if user["role"] not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    from sqlalchemy import update as sql_update
    from app.db.models import JobDescription as JD

    # Fetch current job
    result = await db.execute(select(JD).where(JD.id == int(job_id), JD.deleted_at.is_(None)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Handle ai_result JSONB updates (title, summary, skills, etc.)
    ai_result = dict(job.ai_result) if job.ai_result else {}
    ai_changed = False

    if "job_title" in update_data:
        ai_result["job_title"] = update_data.pop("job_title")
        ai_changed = True
    if "summary" in update_data:
        ai_result["summary"] = update_data.pop("summary")
        ai_changed = True

    extracted_rubric = ai_result.get("extracted_rubric", {})
    if "core_skills" in update_data:
        extracted_rubric["core_skills"] = update_data.pop("core_skills")
        ai_changed = True
    if "preferred_skills" in update_data:
        extracted_rubric["preferred_skills"] = update_data.pop("preferred_skills")
        ai_changed = True
    if "experience_description" in update_data:
        exp_req = extracted_rubric.get("experience_requirements", {})
        if not isinstance(exp_req, dict):
            exp_req = {}
        exp_req["description"] = update_data.pop("experience_description")
        extracted_rubric["experience_requirements"] = exp_req
        ai_changed = True
    if "education_degree" in update_data:
        edu_req = extracted_rubric.get("educational_requirements", {})
        if not isinstance(edu_req, dict):
            edu_req = {}
        edu_req["degree"] = update_data.pop("education_degree")
        extracted_rubric["educational_requirements"] = edu_req
        ai_changed = True
    if "education_field" in update_data:
        edu_req = extracted_rubric.get("educational_requirements", {})
        if not isinstance(edu_req, dict):
            edu_req = {}
        edu_req["field"] = update_data.pop("education_field")
        extracted_rubric["educational_requirements"] = edu_req
        ai_changed = True

    if ai_changed:
        ai_result["extracted_rubric"] = extracted_rubric

    # Handle hiring_close_date string -> datetime
    if "hiring_close_date" in update_data:
        val = update_data["hiring_close_date"]
        if val:
            try:
                update_data["hiring_close_date"] = datetime.fromisoformat(val)
            except (ValueError, TypeError):
                update_data["hiring_close_date"] = None
        else:
            update_data["hiring_close_date"] = None

    # Build DB update
    db_vals = {}
    direct_fields = {"country", "city", "number_of_vacancies", "job_type", "position_type",
                     "experience_range", "salary_range_min", "salary_range_max", "salary_currency",
                     "salary_visibility", "location_type", "hiring_close_date"}
    for key in direct_fields:
        if key in update_data:
            db_vals[key] = update_data[key]

    if ai_changed:
        db_vals["ai_result"] = ai_result

    if not db_vals:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    db_vals["updated_at"] = datetime.utcnow()
    await db.execute(
        sql_update(JD).where(JD.id == int(job_id)).values(**db_vals)
    )
    await db.commit()

    return {"message": "Job updated successfully"}


@router.put("/{job_id}/status")
async def change_job_status(
    job_id: str,
    payload: JobStatusUpdateRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    allowed_statuses = ["Open", "Closed", "Draft", "Archived"]
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed_statuses}")

    success = await update_job_status(db, job_id, user["sub"], payload.status)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found or unauthorized")

    return {"message": "Job status updated successfully"}


@router.put("/{job_id}/visibility")
async def change_job_visibility(
    job_id: str,
    payload: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Toggle job visibility between 'internal' and 'public'."""
    if user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or admin access required")
    visibility = payload.get("visibility")
    if visibility not in ("internal", "public"):
        raise HTTPException(status_code=400, detail="visibility must be 'internal' or 'public'")
    from sqlalchemy import update as sql_update
    from app.db.models import JobDescription
    result = await db.execute(
        sql_update(JobDescription).where(JobDescription.id == int(job_id)).values(visibility=visibility)
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": f"Job visibility set to {visibility}"}


@router.put("/{job_id}/metadata")
async def update_job_metadata(
    job_id: str,
    payload: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Update job metadata fields (job_type, position_type, salary, etc.)."""
    from sqlalchemy import update as sql_update
    from app.db.models import JobDescription as JD

    allowed_fields = {
        "job_type", "position_type", "experience_range",
        "salary_range_min", "salary_range_max", "salary_currency",
        "salary_visibility", "location_type", "hiring_close_date",
    }
    update_vals = {}
    for key in allowed_fields:
        if key in payload:
            val = payload[key]
            if key == "hiring_close_date" and val:
                try:
                    val = datetime.fromisoformat(val)
                except (ValueError, TypeError):
                    val = None
            update_vals[key] = val

    if not update_vals:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    update_vals["updated_at"] = datetime.utcnow()
    result = await db.execute(
        sql_update(JD).where(JD.id == int(job_id)).values(**update_vals)
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job metadata updated"}


@router.get("/import/available")
async def get_jobs_for_import_endpoint(
    exclude_job_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    jobs = await get_jobs_for_import(db, user["sub"], exclude_job_id)
    return jobs


@router.get("/import/search")
async def search_jobs_endpoint(
    q: str = Query("", description="Search query for job title"),
    exclude_job_id: str = Query(..., description="Job ID to exclude"),
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    return await search_jobs(db, q, exclude_job_id, limit)


# ── Approval Workflow ─────────────────────────────────────────────────────────

@router.post("/{job_id}/request-approval")
async def request_job_approval(
    job_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Request approval for a job posting."""
    from app.services.approval_service import request_approval
    try:
        result = await request_approval(db, int(job_id), f"{user['first_name']} {user['last_name']}")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{job_id}/approve")
async def approve_job_endpoint(
    job_id: str,
    body: dict = None,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Approve a job posting (admin/HR only)."""
    if user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or admin access required")
    from app.services.approval_service import approve_job
    comments = (body or {}).get("comments")
    try:
        result = await approve_job(db, int(job_id), f"{user['first_name']} {user['last_name']}", comments)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{job_id}/reject")
async def reject_job_endpoint(
    job_id: str,
    body: dict = None,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Reject a job posting (admin/HR only)."""
    if user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or admin access required")
    from app.services.approval_service import reject_job
    comments = (body or {}).get("comments")
    try:
        result = await reject_job(db, int(job_id), f"{user['first_name']} {user['last_name']}", comments)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{job_id}/approvals")
async def get_job_approvals(
    job_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Get approval history for a job."""
    from app.services.approval_service import get_approvals_for_job
    return await get_approvals_for_job(db, int(job_id))


# ── Pending Approvals (for dashboard) ────────────────────────────────────────

@router.get("/approvals/pending")
async def get_pending_approvals_endpoint(
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Get all jobs pending approval."""
    from app.services.approval_service import get_pending_approvals
    return await get_pending_approvals(db)


# ── Job Members ───────────────────────────────────────────────────────────────

@router.post("/{job_id}/members")
async def add_member(
    job_id: str,
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Add a team member to a job."""
    from app.services.job_access_service import add_job_member
    user_id = body.get("user_id")
    role = body.get("role", "viewer")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    try:
        result = await add_job_member(db, int(job_id), int(user_id), role)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{job_id}/members/{member_user_id}")
async def remove_member(
    job_id: str,
    member_user_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Remove a team member from a job."""
    from app.services.job_access_service import remove_job_member
    ok = await remove_job_member(db, int(job_id), member_user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"message": "Member removed"}


@router.get("/{job_id}/members")
async def list_members(
    job_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Get all members of a job."""
    from app.services.job_access_service import get_job_members
    return await get_job_members(db, int(job_id))
