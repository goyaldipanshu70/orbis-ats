"""
Real email notification service for svc-recruiting.

- When EMAIL_ENABLED=False (default), logs formatted email content to console (dev mode).
- When EMAIL_ENABLED=True, sends via SMTP using smtplib + asyncio.to_thread.
- All public functions are async and safe for fire-and-forget via asyncio.create_task.
"""
import asyncio
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("email_service")

# ---------------------------------------------------------------------------
# Shared HTML wrapper
# ---------------------------------------------------------------------------

_CSS = """
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #f4f6f9; }
.container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.header { background: #1a1a2e; color: #ffffff; padding: 28px 32px; text-align: center; }
.header h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px; }
.body { padding: 32px; color: #333333; line-height: 1.7; font-size: 15px; }
.body h2 { font-size: 18px; color: #1a1a2e; margin-top: 0; }
.detail-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
.detail-table td { padding: 8px 12px; border-bottom: 1px solid #eee; }
.detail-table td:first-child { font-weight: 600; color: #555; width: 140px; }
.cta { display: inline-block; margin: 20px 0; padding: 12px 28px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
.footer { padding: 20px 32px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
""".strip()


def _wrap_html(inner_html: str, title: str = "Orbis ATS") -> str:
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>
<style>{_CSS}</style></head>
<body>
<div class="container">
  <div class="header"><h1>{title}</h1></div>
  <div class="body">{inner_html}</div>
  <div class="footer">&copy; Orbis ATS &mdash; This is an automated message. Please do not reply.</div>
</div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Base sender
# ---------------------------------------------------------------------------

async def send_email(to: str, subject: str, body_html: str) -> bool:
    """
    Send a single email.

    When EMAIL_ENABLED is False, pretty-prints the email to the console.
    When True, sends via SMTP (run in a thread to stay async).

    Returns True on success, False on failure (never raises).
    """
    if not settings.EMAIL_ENABLED:
        _log_email(to, subject, body_html)
        return True

    try:
        await asyncio.to_thread(_send_smtp, to, subject, body_html)
        logger.info("Email sent to %s — %s", to, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s — %s", to, subject)
        return False


def _send_smtp(to: str, subject: str, body_html: str) -> None:
    """Blocking SMTP send — called via asyncio.to_thread."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        if settings.SMTP_PORT in (587, 2525):
            server.starttls()
            server.ehlo()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, [to], msg.as_string())


def _log_email(to: str, subject: str, body_html: str) -> None:
    """Pretty-print email to console when EMAIL_ENABLED=False."""
    border = "=" * 60
    logger.info(
        "\n%s\n"
        "  EMAIL (dev mode — not sent)\n"
        "%s\n"
        "  To:      %s\n"
        "  Subject: %s\n"
        "%s\n"
        "%s\n"
        "%s",
        border, border, to, subject, "-" * 60, body_html, border,
    )


# ---------------------------------------------------------------------------
# Application received
# ---------------------------------------------------------------------------

async def send_application_received(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
) -> bool:
    subject = f"Application Received - {job_title}"
    inner = f"""\
<h2>Thanks for applying, {candidate_name}!</h2>
<p>We have received your application for <strong>{job_title}</strong> and our team
will begin reviewing it shortly.</p>
<p>You can track your application status anytime from your dashboard.</p>
<a class="cta" href="{settings.FRONTEND_URL}/my-applications">View My Applications</a>
<p>Best regards,<br>The Hiring Team</p>"""
    return await send_email(candidate_email, subject, _wrap_html(inner, "Application Received"))


# ---------------------------------------------------------------------------
# Interview scheduled
# ---------------------------------------------------------------------------

async def send_interview_scheduled(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    date: str,
    time: str,
    interview_type: str = "video",
    meeting_link: Optional[str] = None,
) -> bool:
    link_row = ""
    if meeting_link:
        link_row = f'<tr><td>Meeting Link</td><td><a href="{meeting_link}">{meeting_link}</a></td></tr>'

    subject = f"Interview Scheduled - {job_title}"
    inner = f"""\
<h2>Great news, {candidate_name}!</h2>
<p>Your interview for <strong>{job_title}</strong> has been scheduled. Please find the details below:</p>
<table class="detail-table">
  <tr><td>Date</td><td>{date}</td></tr>
  <tr><td>Time</td><td>{time}</td></tr>
  <tr><td>Type</td><td>{interview_type.replace('_', ' ').title()}</td></tr>
  {link_row}
</table>
<p>Please be prepared and on time. Good luck!</p>
<a class="cta" href="{settings.FRONTEND_URL}/my-applications">View My Applications</a>
<p>Best regards,<br>The Hiring Team</p>"""
    return await send_email(candidate_email, subject, _wrap_html(inner, "Interview Scheduled"))


# ---------------------------------------------------------------------------
# Offer notification
# ---------------------------------------------------------------------------

async def send_offer_notification(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str = "Orbis",
) -> bool:
    subject = f"Congratulations! Offer for {job_title}"
    inner = f"""\
<h2>Congratulations, {candidate_name}!</h2>
<p>We are thrilled to inform you that <strong>{company_name}</strong> would like to extend a formal offer
for the position of <strong>{job_title}</strong>.</p>
<p>Please review the offer details in your application portal and respond at your earliest convenience.</p>
<a class="cta" href="{settings.FRONTEND_URL}/my-applications">Review Offer</a>
<p>We look forward to having you on the team!</p>
<p>Best regards,<br>The Hiring Team</p>"""
    return await send_email(candidate_email, subject, _wrap_html(inner, "Offer Letter"))


# ---------------------------------------------------------------------------
# Stage change
# ---------------------------------------------------------------------------

_STAGE_LABELS = {
    "applied": "Application Received",
    "screening": "Resume Screening",
    "interview": "Interview Stage",
    "offer": "Offer Extended",
    "hired": "Hired",
    "rejected": "Not Moving Forward",
    "submitted": "Application Submitted",
    "shortlisted": "Shortlisted",
    "offered": "Offer Extended",
    "withdrawn": "Withdrawn",
}


async def send_stage_change(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    from_stage: str,
    to_stage: str,
) -> bool:
    to_label = _STAGE_LABELS.get(to_stage, to_stage.replace("_", " ").title())
    from_label = _STAGE_LABELS.get(from_stage, from_stage.replace("_", " ").title())

    subject = f"Application Update - {job_title}"
    inner = f"""\
<h2>Hi {candidate_name},</h2>
<p>Your application for <strong>{job_title}</strong> has been updated.</p>
<table class="detail-table">
  <tr><td>Previous Stage</td><td>{from_label}</td></tr>
  <tr><td>Current Stage</td><td><strong>{to_label}</strong></td></tr>
</table>
<p>You can view more details in your application dashboard.</p>
<a class="cta" href="{settings.FRONTEND_URL}/my-applications">View Dashboard</a>
<p>Best regards,<br>The Hiring Team</p>"""
    return await send_email(candidate_email, subject, _wrap_html(inner, "Application Update"))


# ---------------------------------------------------------------------------
# Rejection (special case of stage change with softer language)
# ---------------------------------------------------------------------------

async def send_rejection(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
) -> bool:
    subject = f"Update on Your Application - {job_title}"
    inner = f"""\
<h2>Hi {candidate_name},</h2>
<p>Thank you for your interest in the <strong>{job_title}</strong> position and for taking the time
to apply.</p>
<p>After careful consideration, we have decided to move forward with other candidates at this time.
This was a difficult decision, and we appreciate the effort you put into your application.</p>
<p>We encourage you to apply for future positions that match your skills and experience.</p>
<p>We wish you all the best in your career journey.</p>
<p>Best regards,<br>The Hiring Team</p>"""
    return await send_email(candidate_email, subject, _wrap_html(inner, "Application Update"))


# ---------------------------------------------------------------------------
# Interview cancellation
# ---------------------------------------------------------------------------

async def send_interview_cancelled(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    date: str,
    time: str,
) -> bool:
    subject = f"Interview Cancelled - {job_title}"
    inner = f"""\
<h2>Hi {candidate_name},</h2>
<p>We regret to inform you that your interview for <strong>{job_title}</strong>
originally scheduled for <strong>{date}</strong> at <strong>{time}</strong> has been cancelled.</p>
<p>Our team will reach out to you shortly with further details. We apologize for any inconvenience.</p>
<p>Best regards,<br>The Hiring Team</p>"""
    return await send_email(candidate_email, subject, _wrap_html(inner, "Interview Cancelled"))


# ---------------------------------------------------------------------------
# AI Interview invitation
# ---------------------------------------------------------------------------

async def send_ai_interview_invite(
    email: str,
    candidate_name: str,
    job_title: str,
    interview_link: str,
    expires_at,
) -> bool:
    expires_str = expires_at.strftime("%B %d, %Y") if hasattr(expires_at, "strftime") else str(expires_at)
    subject = f"You're Invited to an AI Interview for {job_title}"
    inner = f"""\
<h2>Hi {candidate_name},</h2>
<p>You've been invited to complete an AI-powered interview for the <strong>{job_title}</strong> position.</p>
<p>This is an automated interview conducted by our AI interviewer. The interview will take approximately
<strong>20-30 minutes</strong> and will include questions about your experience, skills, and problem-solving abilities.</p>

<h3>Before you begin, please ensure:</h3>
<ul>
  <li>You're in a quiet, well-lit room</li>
  <li>Your microphone and webcam are working</li>
  <li>You have a stable internet connection</li>
  <li>You're using Chrome or Edge browser</li>
</ul>

<p style="text-align: center;">
  <a href="{interview_link}" class="cta">Start Your Interview</a>
</p>

<p><strong>Important:</strong> This link expires on <strong>{expires_str}</strong>.
Tab switching and other activities are monitored during the interview.</p>

<p>Good luck!<br>The Hiring Team</p>"""
    return await send_email(email, subject, _wrap_html(inner, "AI Interview Invitation"))


# ---------------------------------------------------------------------------
# Tracking helpers
# ---------------------------------------------------------------------------

def wrap_tracking_links(html: str, tracking_id: str, base_url: str = "") -> str:
    """Replace links in HTML with tracking redirect URLs."""
    import re
    if not base_url:
        base_url = "/api/outreach/tracking/click"

    def replace_link(match):
        original_url = match.group(1)
        if "tracking" in original_url:
            return match.group(0)  # Don't double-wrap
        from urllib.parse import quote
        tracking_url = f"{base_url}/{tracking_id}?url={quote(original_url)}"
        return f'href="{tracking_url}"'

    return re.sub(r'href="([^"]+)"', replace_link, html)


def inject_open_pixel(html: str, tracking_id: str, base_url: str = "") -> str:
    """Append a tracking pixel image before </body> (or at end)."""
    if not base_url:
        base_url = "/api/outreach/tracking/open"
    pixel = f'<img src="{base_url}/{tracking_id}" width="1" height="1" style="display:none" />'
    if "</body>" in html:
        return html.replace("</body>", f"{pixel}</body>")
    return html + pixel
