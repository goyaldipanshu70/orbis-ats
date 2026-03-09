from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"

    # Existing AI service URLs
    AI_JD_URL: str = "http://localhost:8010"
    AI_RESUME_URL: str = "http://localhost:8011"
    AI_INTERVIEW_URL: str = "http://localhost:8012"
    AI_CHAT_URL: str = "http://localhost:8013"

    # LLM providers
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    GOOGLE_API_KEY: str = ""
    GOOGLE_MODEL: str = "gemini-2.0-flash"
    DEFAULT_LLM_PROVIDER: str = "openai"

    # Per-workflow provider overrides (empty = use default)
    HIRING_AGENT_PROVIDER: str = ""
    RESUME_SCORING_PROVIDER: str = ""
    INTERVIEW_EVAL_PROVIDER: str = ""
    RAG_PROVIDER: str = ""
    LEAD_GEN_PROVIDER: str = ""

    # Web search
    TAVILY_API_KEY: str = ""

    # Recruiting DB (for hiring agent context + tool execution)
    RECRUITING_DB_URL: str = ""

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
