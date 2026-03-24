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

    app.include_router(auth_router)
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

    # Serve locally uploaded files (dev fallback when R2 is not configured)
    static_dir = Path(__file__).resolve().parents[1] / "static"
    static_dir.mkdir(exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    @app.get("/api/v1/health")
    async def health_check():
        return {"status": "healthy", "version": "1.0.0"}

    return app


app = create_app()
