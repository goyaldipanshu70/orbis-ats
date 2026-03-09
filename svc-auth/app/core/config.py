from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    DEFAULT_ADMIN_EMAIL: str = "admin@example.com"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:8080"
    REDIS_URL: str = "redis://localhost:6379"
    INTERNAL_API_KEY: str = "intesa-internal-key-dev"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
