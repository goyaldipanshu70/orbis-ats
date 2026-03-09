import csv
import io
import logging
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import CandidateProfile, CandidateJobEntry

logger = logging.getLogger("svc-recruiting")


def preview_csv(file_content: bytes) -> dict:
    """Parse CSV and return headers + first 5 rows as dicts."""
    try:
        text = file_content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = file_content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        rows.append(dict(row))

    return {
        "headers": list(headers),
        "preview_rows": rows,
        "total_preview": len(rows),
    }


async def import_csv(
    db: AsyncSession,
    jd_id: Optional[int],
    file_content: bytes,
    field_mapping: dict,
    user_id: str,
) -> dict:
    """
    Import candidates from CSV.

    field_mapping maps CSV column names to system fields:
      e.g. {"Name": "full_name", "Email": "email", "Phone": "phone", "LinkedIn": "linkedin_url"}

    For each row:
      1. Map fields using field_mapping
      2. Find-or-create CandidateProfile (by email)
      3. Create CandidateJobEntry with source="csv_import"
    """
    try:
        text = file_content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = file_content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    skipped = 0
    errors = []

    # Invert mapping: system_field -> csv_column
    reverse_mapping = {v: k for k, v in field_mapping.items()}

    for row_num, row in enumerate(reader, start=2):  # row 1 is header
        try:
            # Extract mapped fields
            email = row.get(reverse_mapping.get("email", ""), "").strip() or None
            full_name = row.get(reverse_mapping.get("full_name", ""), "").strip() or None
            phone = row.get(reverse_mapping.get("phone", ""), "").strip() or None
            linkedin_url = row.get(reverse_mapping.get("linkedin_url", ""), "").strip() or None
            github_url = row.get(reverse_mapping.get("github_url", ""), "").strip() or None
            portfolio_url = row.get(reverse_mapping.get("portfolio_url", ""), "").strip() or None

            if not full_name and not email:
                skipped += 1
                continue

            # Find or create CandidateProfile
            profile = None
            if email:
                result = await db.execute(
                    select(CandidateProfile).where(
                        CandidateProfile.email == email,
                        CandidateProfile.deleted_at.is_(None),
                    )
                )
                profile = result.scalar_one_or_none()

            if not profile:
                profile = CandidateProfile(
                    email=email,
                    full_name=full_name,
                    phone=phone,
                    linkedin_url=linkedin_url,
                    github_url=github_url,
                    portfolio_url=portfolio_url,
                    status="active",
                    original_source="csv_import",
                    created_by=str(user_id),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(profile)
                await db.flush()
            else:
                # Update profile fields if they were previously empty
                if not profile.full_name and full_name:
                    profile.full_name = full_name
                if not profile.phone and phone:
                    profile.phone = phone
                if not profile.linkedin_url and linkedin_url:
                    profile.linkedin_url = linkedin_url
                if not profile.github_url and github_url:
                    profile.github_url = github_url
                if not profile.portfolio_url and portfolio_url:
                    profile.portfolio_url = portfolio_url
                profile.updated_at = datetime.utcnow()

            # If jd_id provided, create CandidateJobEntry
            if jd_id is not None:
                # Check if CandidateJobEntry already exists for this profile + job
                existing_entry = await db.execute(
                    select(CandidateJobEntry).where(
                        CandidateJobEntry.profile_id == profile.id,
                        CandidateJobEntry.jd_id == jd_id,
                    )
                )
                if existing_entry.scalar_one_or_none():
                    skipped += 1
                    continue

                # Create CandidateJobEntry
                entry = CandidateJobEntry(
                    profile_id=profile.id,
                    jd_id=jd_id,
                    user_id=str(user_id),
                    ai_resume_analysis={},
                    pipeline_stage="applied",
                    source="csv_import",
                    imported_at=datetime.utcnow(),
                    created_at=datetime.utcnow(),
                )
                db.add(entry)

            imported += 1

        except Exception as e:
            logger.warning("CSV import error on row %d: %s", row_num, e)
            errors.append({"row": row_num, "error": str(e)})

    await db.commit()

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    }
