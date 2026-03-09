from pydantic import BaseModel
from typing import Optional, Literal


class EmailProviderSettings(BaseModel):
    provider: Literal["sendgrid", "mailgun", "smtp", "ses"] = "smtp"
    api_key: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    # AWS SES
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: Optional[str] = "us-east-1"
    ses_from_email: Optional[str] = None


class SMSProviderSettings(BaseModel):
    provider: Literal["twilio", "vonage", "sns", "messagebird"] = "twilio"
    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    # Vonage
    vonage_api_key: str = ""
    vonage_api_secret: str = ""
    vonage_from_number: str = ""
    # AWS SNS
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    # MessageBird
    messagebird_access_key: str = ""
    messagebird_originator: str = ""


class AIProviderSettings(BaseModel):
    provider: Literal["openai", "anthropic", "gemini"] = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"
    google_api_key: str = ""
    google_model: str = "gemini-2.0-flash"


class SettingsSchema(BaseModel):
    google_client_id: str = ""
    google_client_secret: str = ""
    openai_api_key: str = ""
    stripe_publishable_key: str = ""
    stripe_secret_key: str = ""
    app_name: str = ""
    enable_registrations: bool = True
    email_settings: EmailProviderSettings


class ATSSettingsSchema(BaseModel):
    default_rejection_lock_days: int = 90
    rejection_lock_enabled: bool = True
    otp_email_required: bool = True
    otp_phone_required: bool = True
    otp_expiry_minutes: int = 10
    otp_max_attempts: int = 5
