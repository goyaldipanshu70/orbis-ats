from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    AI_JD_URL: str
    AI_RESUME_URL: str
    AI_INTERVIEW_URL: str
    FRONTEND_URL: str = "http://localhost:8080"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@orbis.io"
    EMAIL_FROM: str = "noreply@orbis-ats.com"  # legacy alias
    EMAIL_ENABLED: bool = False
    UPLOAD_BASE: str = "static/uploads"
    BACKEND_DOMAIN: str
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    TAVILY_API_KEY: str = ""
    INTERNAL_API_KEY: str = "intesa-internal-key-dev"
    AUTH_URL: str = "http://localhost:8001"
    ADMIN_URL: str = "http://localhost:8003"
    AI_CHAT_URL: str = "http://localhost:8013"
    ORCHESTRATOR_URL: str = "http://localhost:8014"
    REDIS_URL: str = "redis://localhost:6379"
    USE_ORCHESTRATOR: bool = False
    RESUME_SCORE_DICT: dict = {
        "core_skills": 25,
        "preferred_skills": 20,
        "experience": 20,
        "education": 15,
        "industry_fit": 10,
        "soft_skills": 10,
        "total_score": 100
    }

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
