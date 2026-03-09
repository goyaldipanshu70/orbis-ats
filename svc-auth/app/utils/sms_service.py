"""SMS service — multi-provider with DB-driven config and console fallback."""
import asyncio
import logging
from typing import Optional

from app.db.postgres import AsyncSessionLocal

logger = logging.getLogger("svc-auth")


async def _get_sms_settings() -> Optional[dict]:
    """Fetch SMS provider settings from DB."""
    try:
        from sqlalchemy import select
        from app.db.models import Setting

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Setting).where(Setting.category == "sms"))
            setting = result.scalar_one_or_none()
            return setting.value if setting else None
    except Exception as e:
        logger.debug("Could not fetch SMS settings from DB: %s", e)
        return None


async def _send_via_twilio(phone: str, message: str, settings: dict) -> bool:
    from twilio.rest import Client

    client = Client(settings["twilio_account_sid"], settings["twilio_auth_token"])
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            body=message,
            from_=settings["twilio_from_number"],
            to=phone,
        ),
    )
    logger.info("SMS sent to %s via Twilio", phone)
    return True


async def _send_via_vonage(phone: str, message: str, settings: dict) -> bool:
    import vonage

    client = vonage.Client(
        key=settings["vonage_api_key"],
        secret=settings["vonage_api_secret"],
    )
    sms = vonage.Sms(client)
    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(
        None,
        lambda: sms.send_message(
            {
                "from": settings.get("vonage_from_number", "Intesa"),
                "to": phone,
                "text": message,
            }
        ),
    )
    if response["messages"][0]["status"] == "0":
        logger.info("SMS sent to %s via Vonage", phone)
        return True
    logger.warning("Vonage SMS failed: %s", response["messages"][0].get("error-text"))
    return False


async def _send_via_sns(phone: str, message: str, settings: dict) -> bool:
    import boto3

    sns = boto3.client(
        "sns",
        aws_access_key_id=settings.get("aws_access_key_id"),
        aws_secret_access_key=settings.get("aws_secret_access_key"),
        region_name=settings.get("aws_region", "us-east-1"),
    )
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        lambda: sns.publish(PhoneNumber=phone, Message=message),
    )
    logger.info("SMS sent to %s via AWS SNS", phone)
    return True


async def _send_via_messagebird(phone: str, message: str, settings: dict) -> bool:
    import messagebird

    client = messagebird.Client(settings["messagebird_access_key"])
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        lambda: client.message_create(
            settings.get("messagebird_originator", "Intesa"),
            [phone],
            message,
        ),
    )
    logger.info("SMS sent to %s via MessageBird", phone)
    return True


_DISPATCH = {
    "twilio": _send_via_twilio,
    "vonage": _send_via_vonage,
    "sns": _send_via_sns,
    "messagebird": _send_via_messagebird,
}


async def send_sms(phone: str, message: str):
    """Send SMS using the configured provider. Falls back to console log."""
    settings = await _get_sms_settings()

    if settings:
        provider = settings.get("provider", "twilio")
        handler = _DISPATCH.get(provider)
        if handler:
            try:
                await handler(phone, message, settings)
                return
            except Exception as e:
                logger.warning("%s SMS failed, falling back to console: %s", provider, e)

    # Also try env-var based Twilio as legacy fallback
    import os

    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")

    if account_sid and auth_token and from_number:
        try:
            await _send_via_twilio(
                phone,
                message,
                {
                    "twilio_account_sid": account_sid,
                    "twilio_auth_token": auth_token,
                    "twilio_from_number": from_number,
                },
            )
            return
        except Exception as e:
            logger.warning("Twilio env-var SMS failed, falling back to console: %s", e)

    # Console fallback
    logger.info("SMS console fallback — To: %s | Message: %s", phone, message)
