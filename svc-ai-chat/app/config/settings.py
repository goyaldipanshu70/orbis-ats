from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBED_MODEL: str = "text-embedding-3-small"

    model_config = {"env_file": ".env"}


_settings = Settings()

OPENAI_API_KEY = _settings.OPENAI_API_KEY
OPENAI_CHAT_MODEL = _settings.OPENAI_CHAT_MODEL
OPENAI_EMBED_MODEL = _settings.OPENAI_EMBED_MODEL
