from typing import List, Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/nearshop"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me"
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
    
    # Payment Test Mode - set to True for development to bypass actual Razorpay
    PAYMENT_TEST_MODE: bool = True

    # CORS — comma-separated list of allowed origins for production
    # e.g. ALLOWED_ORIGINS=https://nearshop.in,https://www.nearshop.in
    ALLOWED_ORIGINS: Optional[List[str]] = None

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True

    # ── Feature flags ────────────────────────────────────────────
    # Paid / optional features that can be toggled via environment variables.
    # Map view — requires a Mapbox or Google Maps API key
    FEATURE_MAP_VIEW: bool = False
    MAP_PROVIDER: str = "leaflet"  # "leaflet" (free), "mapbox", "google"
    MAPBOX_ACCESS_TOKEN: str = ""
    GOOGLE_MAPS_API_KEY: str = ""

    # CDN for product images — rewrites R2 URLs to a CDN edge URL
    FEATURE_CDN_IMAGES: bool = False
    CDN_BASE_URL: str = ""  # e.g. https://cdn.nearshop.in

    # Visual search (CLIP / OpenAI embeddings) — uses OpenAI API credits
    FEATURE_VISUAL_SEARCH: bool = False

    # AI-powered features — all require OPENAI_API_KEY
    FEATURE_AI_RECOMMENDATIONS: bool = True
    FEATURE_AI_CATALOGING: bool = True
    FEATURE_AI_PRICING: bool = True
    FEATURE_AI_SENTIMENT: bool = True

    # Redis caching for recommendations
    FEATURE_REDIS_CACHE: bool = True
    RECOMMENDATION_CACHE_TTL: int = 3600  # seconds (1 hour)

    # Social sharing deeplinks
    FEATURE_SOCIAL_SHARING: bool = True
    APP_DEEPLINK_BASE: str = "https://nearshop.in"  # base URL for share links

    # Business onboarding tutorial
    FEATURE_ONBOARDING_TUTORIAL: bool = True

    # PostGIS-powered geo queries (requires PostGIS extension)
    FEATURE_POSTGIS: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
