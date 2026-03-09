from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    RECRUITING_INTERNAL_URL: str = "http://intesahr-recruiting:8002"
    INTERNAL_API_KEY: str = "intesa-internal-key-dev"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
