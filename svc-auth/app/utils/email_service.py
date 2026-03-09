import asyncio
import logging

import aiosmtplib
import httpx
import sendgrid
from sendgrid.helpers.mail import Mail
from email.message import EmailMessage

from app.db.postgres import AsyncSessionLocal
from app.services.settings_service import get_email_settings

logger = logging.getLogger("svc-auth")


async def _fetch_email_config() -> dict:
    """Fetch email settings from DB using a dedicated session."""
    async with AsyncSessionLocal() as db:
        config = await get_email_settings(db)
    if not config:
        raise Exception("Email config not set")
    return config


async def _send_via_sendgrid(to: str, subject: str, html: str, config: dict) -> int:
    sg = sendgrid.SendGridAPIClient(api_key=config["api_key"])
    message = Mail(
        from_email=config["smtp_user"],
        to_emails=to,
        subject=subject,
        html_content=html,
    )
    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(None, sg.send, message)
    return response.status_code


async def _send_via_mailgun(to: str, subject: str, html: str, config: dict) -> int:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"https://api.mailgun.net/v3/{config['smtp_host']}/messages",
            auth=("api", config["api_key"]),
            data={
                "from": config["smtp_user"],
                "to": [to],
                "subject": subject,
                "html": html,
            },
        )
        return response.status_code


async def _send_via_smtp(to: str, subject: str, html: str, config: dict) -> int:
    msg = EmailMessage()
    msg.set_content(html)
    msg["Subject"] = subject
    msg["From"] = config["smtp_user"]
    msg["To"] = to
    await aiosmtplib.send(
        msg,
        hostname=config["smtp_host"],
        port=config["smtp_port"],
        username=config["smtp_user"],
        password=config["smtp_password"],
        use_tls=True,
    )
    return 200


async def _send_via_ses(to: str, subject: str, html: str, config: dict) -> int:
    """Send email via AWS SES using boto3."""
    import boto3

    ses = boto3.client(
        "ses",
        aws_access_key_id=config.get("aws_access_key_id"),
        aws_secret_access_key=config.get("aws_secret_access_key"),
        region_name=config.get("aws_region", "us-east-1"),
    )
    from_email = config.get("ses_from_email") or config.get("smtp_user", "")
    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(
        None,
        lambda: ses.send_email(
            Source=from_email,
            Destination={"ToAddresses": [to]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Html": {"Data": html, "Charset": "UTF-8"}},
            },
        ),
    )
    return response["ResponseMetadata"]["HTTPStatusCode"]


_DISPATCH = {
    "sendgrid": _send_via_sendgrid,
    "mailgun": _send_via_mailgun,
    "smtp": _send_via_smtp,
    "ses": _send_via_ses,
}


async def send_email(subject: str, body: str, to: str) -> int:
    config = await _fetch_email_config()
    provider = config.get("provider", "smtp")
    handler = _DISPATCH.get(provider)
    if not handler:
        raise Exception(f"Unsupported email provider: {provider}")
    return await handler(to, subject, body, config)
