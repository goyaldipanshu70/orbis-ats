"""
Backward-compatible wrappers around the real email_service.

These were previously print() stubs. Now they delegate to email_service
with proper HTML emails and SMTP support.
"""
from app.services.email_service import send_interview_scheduled, send_interview_cancelled, send_ai_interview_invite as _send_ai_interview_invite


async def send_interview_notification(candidate_email: str, interview_details: dict):
    """Send an interview-scheduled email to the candidate."""
    await send_interview_scheduled(
        candidate_email=candidate_email,
        candidate_name=interview_details.get("candidate_name", "Candidate"),
        job_title=interview_details.get("job_title", "Open Position"),
        date=interview_details.get("scheduled_date", "TBD"),
        time=interview_details.get("scheduled_time", "TBD"),
        interview_type=interview_details.get("interview_type", "video"),
        meeting_link=interview_details.get("meeting_link"),
    )


async def send_interview_cancellation(candidate_email: str, interview_details: dict):
    """Send an interview-cancelled email to the candidate."""
    await send_interview_cancelled(
        candidate_email=candidate_email,
        candidate_name=interview_details.get("candidate_name", "Candidate"),
        job_title=interview_details.get("job_title", "Open Position"),
        date=interview_details.get("scheduled_date", "TBD"),
        time=interview_details.get("scheduled_time", "TBD"),
    )


async def send_ai_interview_invite(email: str, candidate_name: str, job_title: str, interview_link: str, expires_at):
    """Send an AI interview invitation email."""
    await _send_ai_interview_invite(
        email=email,
        candidate_name=candidate_name,
        job_title=job_title,
        interview_link=interview_link,
        expires_at=expires_at,
    )
