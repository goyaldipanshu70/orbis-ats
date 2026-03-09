from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MQTT_BROKER_HOST: str = "localhost"
    MQTT_BROKER_PORT: int = 1883
    REDIS_URL: str = "redis://localhost:6379"
    MQTT_TOPIC_PREFIX: str = "intesa"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
