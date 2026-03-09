from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    TAVILY_API_KEY: str = ""
    DEFAULT_LLM_PROVIDER: str = "openai"
    OPENAI_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    GOOGLE_MODEL: str = "gemini-2.0-flash"
    RECRUITING_URL: str = "http://localhost:8002"
    REDIS_URL: str = "redis://localhost:6379"
    GITHUB_TOKEN: str = ""

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
