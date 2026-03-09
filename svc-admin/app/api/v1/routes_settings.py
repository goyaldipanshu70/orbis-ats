from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.schemas.settings_schema import (
    ATSSettingsSchema,
    EmailProviderSettings,
    SMSProviderSettings,
    AIProviderSettings,
)
from app.db.postgres import get_db
from app.db.models import AppSetting, User
from app.core.security import get_current_user

logger = logging.getLogger("svc-admin")

router = APIRouter()

DEFAULT_ATS = {
    "default_rejection_lock_days": 90,
    "rejection_lock_enabled": True,
    "otp_email_required": True,
    "otp_phone_required": True,
    "otp_expiry_minutes": 10,
    "otp_max_attempts": 5,
}

DEFAULT_SYSTEM = {
    "company_name": "",
    "timezone": "UTC",
    "date_format": "YYYY-MM-DD",
    "maintenance_mode": False,
}


@router.get("/api-keys")
async def get_api_keys(db: AsyncSession = Depends(get_db)):
    """Get stored API keys (admin only — auth checked at gateway)."""
    result = await db.execute(select(AppSetting).where(AppSetting.key == "api_keys"))
    row = result.scalar_one_or_none()
    if row:
        return row.value
    return {}


@router.put("/api-keys")
async def update_api_keys(body: dict, db: AsyncSession = Depends(get_db)):
    """Upsert API keys (admin only — auth checked at gateway)."""
    result = await db.execute(select(AppSetting).where(AppSetting.key == "api_keys"))
    row = result.scalar_one_or_none()
    if row:
        row.value = body
        row.updated_at = datetime.utcnow()
    else:
        db.add(AppSetting(key="api_keys", value=body, updated_at=datetime.utcnow()))
    await db.commit()
    return body


@router.get("/system")
async def get_system_settings(db: AsyncSession = Depends(get_db)):
    """Get system settings (admin only — auth checked at gateway)."""
    result = await db.execute(select(AppSetting).where(AppSetting.key == "system"))
    row = result.scalar_one_or_none()
    if row:
        return {**DEFAULT_SYSTEM, **row.value}
    return DEFAULT_SYSTEM


@router.put("/system")
async def update_system_settings(body: dict, db: AsyncSession = Depends(get_db)):
    """Upsert system settings (admin only — auth checked at gateway)."""
    result = await db.execute(select(AppSetting).where(AppSetting.key == "system"))
    row = result.scalar_one_or_none()
    if row:
        row.value = body
        row.updated_at = datetime.utcnow()
    else:
        db.add(AppSetting(key="system", value=body, updated_at=datetime.utcnow()))
    await db.commit()
    return body


@router.get("/ats")
async def get_ats_settings(db: AsyncSession = Depends(get_db)):
    """Get ATS configuration (rejection lock, OTP settings)."""
    result = await db.execute(select(AppSetting).where(AppSetting.key == "ats_settings"))
    row = result.scalar_one_or_none()
    if row:
        return {**DEFAULT_ATS, **row.value}
    return DEFAULT_ATS


@router.put("/ats")
async def update_ats_settings(body: ATSSettingsSchema, db: AsyncSession = Depends(get_db)):
    """Update ATS configuration (admin only — auth checked at gateway)."""
    result = await db.execute(select(AppSetting).where(AppSetting.key == "ats_settings"))
    row = result.scalar_one_or_none()
    new_value = body.model_dump()
    if row:
        row.value = new_value
        row.updated_at = datetime.utcnow()
    else:
        db.add(AppSetting(key="ats_settings", value=new_value, updated_at=datetime.utcnow()))
    await db.commit()
    return {"message": "ATS settings updated successfully"}


DEFAULT_THEME = {"mode": "system", "accent_color": "blue"}


@router.get("/theme")
async def get_org_theme(db: AsyncSession = Depends(get_db)):
    """Get org-wide theme settings."""
    result = await db.execute(select(AppSetting).where(AppSetting.key == "theme"))
    row = result.scalar_one_or_none()
    if row:
        return {**DEFAULT_THEME, **row.value}
    return DEFAULT_THEME


@router.put("/theme")
async def update_org_theme(body: dict, db: AsyncSession = Depends(get_db)):
    """Update org-wide theme settings (admin only)."""
    result = await db.execute(select(AppSetting).where(AppSetting.key == "theme"))
    row = result.scalar_one_or_none()
    if row:
        row.value = body
        row.updated_at = datetime.utcnow()
    else:
        db.add(AppSetting(key="theme", value=body, updated_at=datetime.utcnow()))
    await db.commit()
    return body


@router.get("/user-theme")
async def get_user_theme(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's theme preference."""
    user_id = int(user["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    theme_pref = None
    if db_user and hasattr(db_user, "theme_preference"):
        theme_pref = db_user.theme_preference
    return {"theme_preference": theme_pref}


@router.put("/user-theme")
async def update_user_theme(
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's theme preference."""
    user_id = int(user["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    theme_preference = body.get("theme_preference", "")
    if hasattr(db_user, "theme_preference"):
        db_user.theme_preference = theme_preference
    await db.commit()
    return {"message": "Theme preference updated"}


# ---------------------------------------------------------------------------
# Helpers — mask secret fields before returning to frontend
# ---------------------------------------------------------------------------

_SECRET_FIELDS = {
    "api_key", "smtp_password", "aws_secret_access_key",
    "twilio_auth_token", "vonage_api_secret", "messagebird_access_key",
    "openai_api_key", "anthropic_api_key", "google_api_key",
}


def _mask_secrets(d: dict) -> dict:
    """Return a copy with secret fields masked (show last 4 chars only)."""
    out = {}
    for k, v in d.items():
        if k in _SECRET_FIELDS and isinstance(v, str) and len(v) > 4:
            out[k] = "*" * (len(v) - 4) + v[-4:]
        else:
            out[k] = v
    return out


async def _get_setting(db: AsyncSession, key: str) -> dict:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    return row.value if row else {}


async def _upsert_setting(db: AsyncSession, key: str, value: dict):
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
        row.updated_at = datetime.utcnow()
    else:
        db.add(AppSetting(key=key, value=value, updated_at=datetime.utcnow()))
    await db.commit()


# ---------------------------------------------------------------------------
# Email provider settings
# ---------------------------------------------------------------------------

@router.get("/email")
async def get_email_settings(db: AsyncSession = Depends(get_db)):
    raw = await _get_setting(db, "email_provider_settings")
    return _mask_secrets(raw) if raw else EmailProviderSettings().model_dump()


@router.put("/email")
async def update_email_settings(body: EmailProviderSettings, db: AsyncSession = Depends(get_db)):
    await _upsert_setting(db, "email_provider_settings", body.model_dump())
    # Also sync to the legacy 'email' key used by svc-auth settings_service
    await _upsert_setting(db, "email", body.model_dump())
    return {"message": "Email provider settings saved"}


@router.post("/email/test")
async def test_email(body: dict, db: AsyncSession = Depends(get_db)):
    to = body.get("to", "")
    if not to:
        raise HTTPException(400, "Missing 'to' email address")
    try:
        import httpx
        settings_raw = await _get_setting(db, "email_provider_settings")
        if not settings_raw:
            raise HTTPException(400, "No email provider configured")
        # Forward test to svc-auth which has the sending logic
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "http://localhost:8001/api/auth/test-email",
                json={"to": to, "subject": "Intesa Test Email", "body": "<h2>Test email from Intesa</h2><p>Your email provider is configured correctly.</p>"},
            )
        if r.status_code < 300:
            return {"message": f"Test email sent to {to}"}
        return {"message": f"Email send returned status {r.status_code}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Test failed: {getattr(e, 'message', str(e))}")


# ---------------------------------------------------------------------------
# SMS provider settings
# ---------------------------------------------------------------------------

@router.get("/sms")
async def get_sms_settings(db: AsyncSession = Depends(get_db)):
    raw = await _get_setting(db, "sms_provider_settings")
    return _mask_secrets(raw) if raw else SMSProviderSettings().model_dump()


@router.put("/sms")
async def update_sms_settings(body: SMSProviderSettings, db: AsyncSession = Depends(get_db)):
    await _upsert_setting(db, "sms_provider_settings", body.model_dump())
    # Also sync to the 'sms' key used by svc-auth
    await _upsert_setting(db, "sms", body.model_dump())
    return {"message": "SMS provider settings saved"}


@router.post("/sms/test")
async def test_sms(body: dict, db: AsyncSession = Depends(get_db)):
    to = body.get("to", "")
    if not to:
        raise HTTPException(400, "Missing 'to' phone number")
    try:
        settings_raw = await _get_setting(db, "sms_provider_settings")
        if not settings_raw:
            raise HTTPException(400, "No SMS provider configured")
        # Call svc-auth to send test SMS
        import httpx
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "http://localhost:8001/api/auth/test-sms",
                json={"to": to, "message": "Intesa test SMS - your provider is configured correctly."},
            )
        if r.status_code < 300:
            return {"message": f"Test SMS sent to {to}"}
        return {"message": f"SMS send returned status {r.status_code}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Test failed: {getattr(e, 'message', str(e))}")


# ---------------------------------------------------------------------------
# AI provider settings
# ---------------------------------------------------------------------------

@router.get("/ai-provider")
async def get_ai_provider_settings(db: AsyncSession = Depends(get_db)):
    raw = await _get_setting(db, "ai_provider_settings")
    return _mask_secrets(raw) if raw else AIProviderSettings().model_dump()


@router.put("/ai-provider")
async def update_ai_provider_settings(body: AIProviderSettings, db: AsyncSession = Depends(get_db)):
    await _upsert_setting(db, "ai_provider_settings", body.model_dump())
    return {"message": "AI provider settings saved"}


@router.post("/ai-provider/test")
async def test_ai_provider(body: dict, db: AsyncSession = Depends(get_db)):
    """Test AI provider connection with a simple prompt."""
    settings_raw = await _get_setting(db, "ai_provider_settings")
    if not settings_raw:
        raise HTTPException(400, "No AI provider configured")

    provider = settings_raw.get("provider", "openai")
    try:
        if provider == "openai":
            from openai import OpenAI
            client = OpenAI(api_key=settings_raw["openai_api_key"])
            r = client.chat.completions.create(
                model=settings_raw.get("openai_model", "gpt-4o-mini"),
                messages=[{"role": "user", "content": "Say hello in one word."}],
                max_tokens=10,
            )
            return {"message": f"OpenAI OK — response: {r.choices[0].message.content}"}

        elif provider == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=settings_raw["anthropic_api_key"])
            r = client.messages.create(
                model=settings_raw.get("anthropic_model", "claude-sonnet-4-20250514"),
                max_tokens=10,
                messages=[{"role": "user", "content": "Say hello in one word."}],
            )
            return {"message": f"Anthropic OK — response: {r.content[0].text}"}

        elif provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=settings_raw["google_api_key"])
            model = genai.GenerativeModel(settings_raw.get("google_model", "gemini-2.0-flash"))
            r = model.generate_content("Say hello in one word.")
            return {"message": f"Gemini OK — response: {r.text}"}

        else:
            raise HTTPException(400, f"Unknown provider: {provider}")

    except HTTPException:
        raise
    except Exception as e:
        # Return 422 — this is a config/credentials issue, not a server error
        err_msg = getattr(e, "message", str(e))
        raise HTTPException(422, f"AI provider test failed: {err_msg}")
