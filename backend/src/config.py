from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "dev"
    database_url: str = ""
    jwt_secret: str = "changeme"
    jwt_access_expire_minutes: int = 480
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    db_pool_min: int = 1
    db_pool_max: int = 5
    cors_origins: str = "*"
    public_api_key: str = "dev-projecthub-key-2024"
    s3_bucket: str = ""
    s3_region: str = "ap-south-1"
    cloudfront_domain: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
