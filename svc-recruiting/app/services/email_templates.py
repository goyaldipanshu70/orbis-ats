"""Email notification templates for the ATS."""


def application_received(job_title: str, applicant_name: str) -> tuple[str, str]:
    subject = f"Application Received — {job_title}"
    body = (
        f"Hi {applicant_name},<br><br>"
        f"Thank you for applying to <strong>{job_title}</strong>. "
        f"We have received your application and our team will review it shortly.<br><br>"
        f"You can track your application status anytime from your dashboard.<br><br>"
        f"Best regards,<br>The Hiring Team"
    )
    return subject, body


def interview_scheduled(
    job_title: str,
    applicant_name: str,
    date: str,
    time: str,
    interview_type: str = "video",
    meeting_link: str = None,
) -> tuple[str, str]:
    subject = f"Interview Scheduled — {job_title}"
    location_info = f'<br>Meeting link: <a href="{meeting_link}">{meeting_link}</a>' if meeting_link else ""
    body = (
        f"Hi {applicant_name},<br><br>"
        f"Great news! Your interview for <strong>{job_title}</strong> has been scheduled.<br><br>"
        f"<strong>Date:</strong> {date}<br>"
        f"<strong>Time:</strong> {time}<br>"
        f"<strong>Type:</strong> {interview_type}{location_info}<br><br>"
        f"Please be prepared and on time. Good luck!<br><br>"
        f"Best regards,<br>The Hiring Team"
    )
    return subject, body


def offer_sent(job_title: str, applicant_name: str, position_title: str = None) -> tuple[str, str]:
    title = position_title or job_title
    subject = f"Congratulations! Offer for {title}"
    body = (
        f"Hi {applicant_name},<br><br>"
        f"Congratulations! We are pleased to extend an offer for the position of "
        f"<strong>{title}</strong>.<br><br>"
        f"Please review the offer details in your application portal and respond at your earliest convenience.<br><br>"
        f"We look forward to having you on the team!<br><br>"
        f"Best regards,<br>The Hiring Team"
    )
    return subject, body


def stage_changed(job_title: str, applicant_name: str, new_status: str) -> tuple[str, str]:
    subject = f"Application Update — {job_title}"
    body = (
        f"Hi {applicant_name},<br><br>"
        f"Your application for <strong>{job_title}</strong> has been updated.<br><br>"
        f"<strong>New status:</strong> {new_status}<br><br>"
        f"You can view more details in your application dashboard.<br><br>"
        f"Best regards,<br>The Hiring Team"
    )
    return subject, body


def rejection(job_title: str, applicant_name: str) -> tuple[str, str]:
    subject = f"Update on Your Application — {job_title}"
    body = (
        f"Hi {applicant_name},<br><br>"
        f"Thank you for your interest in the <strong>{job_title}</strong> position and for taking the time "
        f"to apply.<br><br>"
        f"After careful consideration, we have decided to move forward with other candidates at this time. "
        f"This was a difficult decision, and we appreciate the effort you put into your application.<br><br>"
        f"We encourage you to apply for future positions that match your skills and experience.<br><br>"
        f"We wish you all the best in your career journey.<br><br>"
        f"Best regards,<br>The Hiring Team"
    )
    return subject, body


STATUS_MESSAGES = {
    "submitted": "Your application is under review",
    "screening": "Your resume is being evaluated by AI",
    "shortlisted": "You've been shortlisted!",
    "ai_interview": "You have been invited for an AI-powered interview",
    "interview": "Interview stage",
    "offered": "An offer has been extended",
    "offer": "An offer has been extended",
    "hired": "Welcome aboard!",
    "rejected": "We've decided to move forward with other candidates",
    "withdrawn": "Application withdrawn",
}
