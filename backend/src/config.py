from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Database
    DATABASE_URL: str
    LOCAL_DB_URL: str

    # Application
    APP_NAME: str = "college"
    DEBUG: bool = False

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_TIME: int = 10080

    LOCAL: bool

    # Email / Brevo REST API
    BREVO_API_KEY: str = ""
    BREVO_FROM_EMAIL: str = ""
    BREVO_FROM_NAME: str = "Campus Connect"

    # Rate Limiting
    DAILY_EMAIL_LIMIT: int = 300
    OTP_COOLDOWN_SECONDS: int = 30
    MAX_OTP_ATTEMPTS_PER_EMAIL: int = 3
    OTP_EXPIRE_MINUTES: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
