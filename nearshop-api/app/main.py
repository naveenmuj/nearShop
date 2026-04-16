from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.core.exceptions import AppException, app_exception_handler
from app.middleware.auth import OptionalAuthMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.logging import LoggingMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


def create_app() -> FastAPI:
    app = FastAPI(
        title="NearShop API",
        description="Hyperlocal commerce platform API",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS — update ALLOWED_ORIGINS in .env for production
    _origins = (
        ["*"]
        if settings.APP_ENV == "development"
        else settings.ALLOWED_ORIGINS or ["*"]
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Custom middleware (executes in reverse order: OptionalAuth -> RateLimit -> Logging)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(OptionalAuthMiddleware)

    # Exception handlers
    app.add_exception_handler(AppException, app_exception_handler)

    # Routers
    from app.auth.router import router as auth_router
    from app.shops.router import router as shops_router
    from app.products.router import router as products_router
    from app.orders.router import router as orders_router
    from app.reviews.router import router as reviews_router
    from app.deals.router import router as deals_router
    from app.stories.router import router as stories_router
    from app.haggle.router import router as haggle_router
    from app.loyalty.router import router as loyalty_router
    from app.community.router import router as community_router
    from app.reservations.router import router as reservations_router
    from app.feed.router import router as feed_router
    from app.analytics.router import router as analytics_router
    from app.ai.router import router as ai_router
    from app.wishlists.router import router as wishlists_router
    from app.notifications.router import router as notifications_router
    from app.products.categories_router import router as categories_router
    from app.referral.router import router as referral_router
    from app.udhaar.router import router as udhaar_router
    from app.media.router import router as media_router
    from app.admin.router import router as admin_router
    from app.billing.router import router as billing_router
    from app.marketing.router import router as marketing_router
    from app.expenses.router import router as expenses_router
    from app.inventory.router import router as inventory_router
    from app.broadcast.router import router as broadcast_router
    from app.advisor.router import router as advisor_router
    from app.engagement.router import router as engagement_router
    from app.search.router import router as search_router
    from app.messaging.router import router as messaging_router
    from app.returns.router import router as returns_router
    from app.staff.router import router as staff_router
    from app.giftcards.router import router as giftcards_router
    from app.subscriptions.router import router as subscriptions_router
    from app.delivery.router import router as delivery_router
    from app.catalog.router import router as catalog_router
    from app.addresses.router import router as addresses_router
    from app.payments.router import router as payments_router
    from app.profiles.router import router as profiles_router

    app.include_router(auth_router)
    app.include_router(search_router)
    app.include_router(shops_router)
    app.include_router(products_router)
    app.include_router(orders_router)
    app.include_router(reviews_router)
    app.include_router(deals_router)
    app.include_router(stories_router)
    app.include_router(haggle_router)
    app.include_router(loyalty_router)
    app.include_router(community_router)
    app.include_router(reservations_router)
    app.include_router(feed_router)
    app.include_router(analytics_router)
    app.include_router(ai_router)
    app.include_router(wishlists_router)
    app.include_router(notifications_router)
    app.include_router(categories_router)
    app.include_router(referral_router)
    app.include_router(udhaar_router)
    app.include_router(media_router)
    app.include_router(admin_router)
    app.include_router(billing_router)
    app.include_router(marketing_router)
    app.include_router(expenses_router)
    app.include_router(inventory_router)
    app.include_router(broadcast_router)
    app.include_router(advisor_router)
    app.include_router(engagement_router)
    app.include_router(messaging_router)
    app.include_router(returns_router)
    app.include_router(staff_router)
    app.include_router(giftcards_router)
    app.include_router(subscriptions_router)
    app.include_router(delivery_router)
    app.include_router(catalog_router)
    app.include_router(addresses_router)
    app.include_router(payments_router)
    app.include_router(profiles_router)

    # Serve locally uploaded files (dev fallback when R2 is not configured)
    static_dir = Path(__file__).resolve().parents[1] / "static"
    static_dir.mkdir(exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    @app.get("/api/v1/health")
    async def health_check():
        return {"status": "healthy", "version": "1.0.0"}

    @app.get("/api/v1/features")
    async def feature_flags():
        """Return enabled feature flags so clients can conditionally render UI."""
        visual_search_available = bool(settings.OPENAI_API_KEY)
        return {
            "map_view": settings.FEATURE_MAP_VIEW,
            "map_provider": settings.MAP_PROVIDER if settings.FEATURE_MAP_VIEW else None,
            "cdn_images": settings.FEATURE_CDN_IMAGES,
            "visual_search": visual_search_available,
            "ai_recommendations": settings.FEATURE_AI_RECOMMENDATIONS,
            "ai_cataloging": settings.FEATURE_AI_CATALOGING,
            "ai_pricing": settings.FEATURE_AI_PRICING,
            "ai_sentiment": settings.FEATURE_AI_SENTIMENT,
            "redis_cache": settings.FEATURE_REDIS_CACHE,
            "social_sharing": settings.FEATURE_SOCIAL_SHARING,
            "onboarding_tutorial": settings.FEATURE_ONBOARDING_TUTORIAL,
            "postgis": settings.FEATURE_POSTGIS,
        }

    @app.get("/api/v1/share/{entity_type}/{entity_id}")
    async def get_share_link(entity_type: str, entity_id: str):
        """Generate share deeplink for a product, deal, or shop."""
        base = settings.APP_DEEPLINK_BASE
        path_map = {
            "product": f"/app/product/{entity_id}",
            "shop": f"/shop/{entity_id}",
            "deal": f"/app/deals?highlight={entity_id}",
        }
        path = path_map.get(entity_type, f"/app/{entity_type}/{entity_id}")
        url = f"{base}{path}"
        whatsapp_url = f"https://wa.me/?text={url}"
        return {
            "url": url,
            "whatsapp_url": whatsapp_url,
            "entity_type": entity_type,
            "entity_id": entity_id,
        }

    return app


app = create_app()
