"""Inbox capture service — scan recruiter inbox for resume emails."""
import asyncio
import email
import imaplib
import logging
import os
import re
from datetime import datetime
from email.header import decode_header
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.models import InboxCaptureConfig, InboxCaptureLog
from app.core.config import settings

logger = logging.getLogger("svc-recruiting")

RESUME_EXTENSIONS = {".pdf", ".doc", ".docx"}
UPLOAD_DIR = os.path.join(settings.UPLOAD_BASE, "inbox")


def _decode_mime_header(value: str) -> str:
    """Decode MIME-encoded header value."""
    if not value:
        return ""
    parts = decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return " ".join(decoded)


def _extract_name_from_email(from_header: str) -> tuple[str, str]:
    """Extract name and email from From header."""
    match = re.match(r'"?([^"<]+)"?\s*<([^>]+)>', from_header)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    # Just an email address
    email_match = re.match(r'<?([^>]+)>?', from_header)
    if email_match:
        addr = email_match.group(1).strip()
        name = addr.split("@")[0].replace(".", " ").title()
        return name, addr
    return "Unknown", from_header


def _scan_inbox_sync(
    host: str,
    port: int,
    username: str,
    password: str,
    use_ssl: bool = True,
    folder: str = "INBOX",
    max_emails: int = 50,
) -> list[dict]:
    """Synchronous IMAP scan — returns list of parsed email dicts with attachments."""
    results = []

    if use_ssl:
        mail = imaplib.IMAP4_SSL(host, port)
    else:
        mail = imaplib.IMAP4(host, port)

    try:
        mail.login(username, password)
        mail.select(folder)

        # Search for unread emails
        status, data = mail.search(None, "UNSEEN")
        if status != "OK":
            return results

        email_ids = data[0].split()
        if not email_ids:
            return results

        # Process most recent first, up to max
        for eid in reversed(email_ids[:max_emails]):
            try:
                status, msg_data = mail.fetch(eid, "(RFC822)")
                if status != "OK":
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                from_header = _decode_mime_header(msg.get("From", ""))
                subject = _decode_mime_header(msg.get("Subject", ""))
                date_str = msg.get("Date", "")
                sender_name, sender_email = _extract_name_from_email(from_header)

                # Extract body text
                body_text = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        ct = part.get_content_type()
                        if ct == "text/plain":
                            payload = part.get_payload(decode=True)
                            if payload:
                                body_text = payload.decode("utf-8", errors="replace")
                                break
                else:
                    payload = msg.get_payload(decode=True)
                    if payload:
                        body_text = payload.decode("utf-8", errors="replace")

                # Extract attachments
                attachments = []
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_disposition() == "attachment":
                            filename = _decode_mime_header(part.get_filename() or "")
                            ext = os.path.splitext(filename)[1].lower()
                            if ext in RESUME_EXTENSIONS:
                                file_data = part.get_payload(decode=True)
                                if file_data:
                                    attachments.append({
                                        "filename": filename,
                                        "data": file_data,
                                        "size": len(file_data),
                                        "content_type": part.get_content_type(),
                                    })

                if attachments:  # Only include emails with resume attachments
                    results.append({
                        "email_id": eid.decode() if isinstance(eid, bytes) else str(eid),
                        "from_name": sender_name,
                        "from_email": sender_email,
                        "subject": subject,
                        "date": date_str,
                        "body": body_text[:2000],  # Truncate
                        "attachments": attachments,
                    })

                    # Mark as seen
                    mail.store(eid, "+FLAGS", "\\Seen")

            except Exception as e:
                logger.warning("Failed to process email %s: %s", eid, e)
                continue
    finally:
        try:
            mail.logout()
        except Exception:
            pass

    return results


async def scan_inbox(
    host: str,
    port: int,
    username: str,
    password: str,
    use_ssl: bool = True,
    folder: str = "INBOX",
    max_emails: int = 50,
) -> list[dict]:
    """Async wrapper around sync IMAP scan."""
    return await asyncio.to_thread(
        _scan_inbox_sync, host, port, username, password, use_ssl, folder, max_emails
    )


async def save_attachment(filename: str, data: bytes) -> str:
    """Save an attachment to disk and return the relative path."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = re.sub(r'[^\w.\-]', '_', filename)
    dest_name = f"{timestamp}_{safe_name}"
    dest_path = os.path.join(UPLOAD_DIR, dest_name)

    def _write():
        with open(dest_path, "wb") as f:
            f.write(data)

    await asyncio.to_thread(_write)
    return f"inbox/{dest_name}"


async def process_inbox_scan(
    db: AsyncSession,
    config_id: int,
    host: str,
    port: int,
    username: str,
    password: str,
    use_ssl: bool = True,
    folder: str = "INBOX",
    max_emails: int = 50,
) -> dict:
    """Scan inbox and create capture log entries for review."""
    emails = await scan_inbox(host, port, username, password, use_ssl, folder, max_emails)

    captured = []
    for em in emails:
        saved_files = []
        for att in em["attachments"]:
            path = await save_attachment(att["filename"], att["data"])
            saved_files.append({
                "filename": att["filename"],
                "path": path,
                "size": att["size"],
            })

        log = InboxCaptureLog(
            config_id=config_id,
            from_name=em["from_name"],
            from_email=em["from_email"],
            subject=em["subject"],
            body_preview=em["body"][:500],
            attachments=saved_files,
            status="pending_review",
        )
        db.add(log)
        captured.append({
            "from_name": em["from_name"],
            "from_email": em["from_email"],
            "subject": em["subject"],
            "attachments": [f["filename"] for f in saved_files],
        })

    if captured:
        await db.commit()

    return {"scanned": len(emails), "captured": len(captured), "items": captured}


# -- Config CRUD --------------------------------------------------------------


async def create_inbox_config(
    db: AsyncSession,
    name: str,
    imap_host: str,
    imap_port: int,
    username: str,
    password: str,
    use_ssl: bool = True,
    folder: str = "INBOX",
    created_by: str = "",
) -> dict:
    config = InboxCaptureConfig(
        name=name,
        imap_host=imap_host,
        imap_port=imap_port,
        username=username,
        password=password,
        use_ssl=use_ssl,
        folder=folder,
        created_by=created_by,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return _config_to_dict(config)


async def get_inbox_configs(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(InboxCaptureConfig).order_by(InboxCaptureConfig.created_at.desc())
    )
    return [_config_to_dict(c) for c in result.scalars().all()]


async def get_inbox_config(db: AsyncSession, config_id: int) -> dict | None:
    result = await db.execute(
        select(InboxCaptureConfig).where(InboxCaptureConfig.id == config_id)
    )
    config = result.scalar_one_or_none()
    return _config_to_dict(config) if config else None


async def delete_inbox_config(db: AsyncSession, config_id: int) -> bool:
    result = await db.execute(
        select(InboxCaptureConfig).where(InboxCaptureConfig.id == config_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return False
    await db.delete(config)
    await db.commit()
    return True


async def get_capture_logs(
    db: AsyncSession,
    config_id: int | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    conditions = []
    if config_id:
        conditions.append(InboxCaptureLog.config_id == config_id)
    if status:
        conditions.append(InboxCaptureLog.status == status)

    total_q = select(func.count(InboxCaptureLog.id))
    if conditions:
        total_q = total_q.where(*conditions)
    total = (await db.execute(total_q)).scalar() or 0

    q = select(InboxCaptureLog).order_by(InboxCaptureLog.created_at.desc())
    if conditions:
        q = q.where(*conditions)
    q = q.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()

    return {
        "items": [_log_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def update_capture_log_status(
    db: AsyncSession, log_id: int, status: str, candidate_id: int | None = None
) -> dict | None:
    result = await db.execute(
        select(InboxCaptureLog).where(InboxCaptureLog.id == log_id)
    )
    log = result.scalar_one_or_none()
    if not log:
        return None
    log.status = status
    if candidate_id:
        log.candidate_id = candidate_id
    log.processed_at = datetime.utcnow()

    # When accepted, create a CandidateProfile in the talent pool
    if status == "accepted" and not log.candidate_id:
        from app.services.candidate_service import _find_or_create_profile

        # Use the first attachment as the resume URL (if any)
        resume_url = None
        attachments = log.attachments or []
        if attachments and isinstance(attachments, list) and len(attachments) > 0:
            resume_url = attachments[0].get("path")

        profile, _was_existing = await _find_or_create_profile(
            db=db,
            email=log.from_email or None,
            full_name=log.from_name or None,
            phone=None,
            resume_url=resume_url,
            category="Other",
            source="inbox_capture",
            created_by="system",
        )
        log.candidate_id = profile.id

    await db.commit()
    await db.refresh(log)
    return _log_to_dict(log)


def _config_to_dict(c: InboxCaptureConfig) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "imap_host": c.imap_host,
        "imap_port": c.imap_port,
        "username": c.username,
        "use_ssl": c.use_ssl,
        "folder": c.folder,
        "is_active": c.is_active,
        "last_scan_at": c.last_scan_at.isoformat() if c.last_scan_at else None,
        "created_by": c.created_by,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _log_to_dict(log: InboxCaptureLog) -> dict:
    return {
        "id": log.id,
        "config_id": log.config_id,
        "from_name": log.from_name,
        "from_email": log.from_email,
        "subject": log.subject,
        "body_preview": log.body_preview,
        "attachments": log.attachments or [],
        "status": log.status,
        "candidate_id": log.candidate_id,
        "processed_at": log.processed_at.isoformat() if log.processed_at else None,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }
