from typing import List, Optional
from pydantic_settings import BaseSettings
from functools import lru_cache
import secrets


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/nearshop"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT - Generate a secure default or require environment variable
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # SMS / OTP
    OTP_SMS_API_KEY: str = ""

    # OpenAI
    OPENAI_API_KEY: str = ""

    # Cloudflare R2
    R2_ENDPOINT_URL: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "nearshop-media"

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # CORS — comma-separated list of allowed origins for production
    # e.g. ALLOWED_ORIGINS=https://nearshop.in,https://www.nearshop.in
    ALLOWED_ORIGINS: Optional[List[str]] = None

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = False  # Changed default to False for security

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Validate JWT_SECRET_KEY is set and not the default insecure value
        if not self.JWT_SECRET_KEY:
            if self.APP_ENV == "production":
                raise ValueError("JWT_SECRET_KEY must be set in production environment")
            # Generate a random key for development
            self.JWT_SECRET_KEY = secrets.token_urlsafe(32)
            print(f"[WARNING] Using auto-generated JWT_SECRET_KEY for development. "
                  f"Set JWT_SECRET_KEY in .env for production!")
        elif self.JWT_SECRET_KEY == "change-me":
            raise ValueError(
                "JWT_SECRET_KEY is set to default 'change-me'. "
                "Please change it to a secure random string!"
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
