from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    AUTH_URL: str = "http://localhost:8001"
    RECRUITING_URL: str = "http://localhost:8002"
    ADMIN_URL: str = "http://localhost:8003"
    ORCHESTRATOR_URL: str = "http://localhost:8014"
    MQTT_URL: str = "http://localhost:8020"
    WORKFLOWS_URL: str = "http://localhost:8015"

    class Config:
        env_file = ".env"


settings = Settings()
