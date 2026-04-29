from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "dev"
    database_url: str = ""
    jwt_secret: str = "changeme"
    jwt_access_expire_minutes: int = 480
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    db_pool_min: int = 1
    db_pool_max: int = 5
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
