"""Thin email client — delegates to the real email_service."""
from app.services.email_service import send_email as _send


async def send_email(subject: str, body: str, to_email: str):
    """Send an email. Wraps the real email service for backward compatibility."""
    await _send(to_email, subject, body)
