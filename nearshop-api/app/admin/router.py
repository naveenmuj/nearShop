from fastapi import APIRouter, Depends, HTTPException, Query
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.permissions import get_current_user
from app.admin import service
from app.admin import ai_analytics
from app.admin import ranking_analytics
from app.admin import ranking_outcomes

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def require_admin(current_user=Depends(get_current_user)):
    # TODO: In production, restrict to users with "admin" role
    return current_user


@router.get("/overview")
async def overview(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_overview(db)


@router.get("/users/growth")
async def user_growth(
    period: str = Query("30d"),
    interval: str = Query("daily"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_user_growth(db, period, interval)


@router.get("/users/segmentation")
async def user_segmentation(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_user_segmentation(db)


@router.get("/users/recent")
async def recent_users(
    limit: int = Query(20),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_recent_users(db, limit)


@router.get("/shops/leaderboard")
async def shop_leaderboard(
    sort_by: str = Query("score"),
    limit: int = Query(50),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_shop_leaderboard(db, sort_by, limit)


@router.get("/shops/categories")
async def shop_categories(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_shop_categories(db)


@router.get("/shops/growth")
async def shop_growth(
    period: str = Query("30d"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_shop_growth(db, period)


@router.get("/shops/health")
async def shops_health(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_shops_needing_attention(db)


@router.get("/products/by-category")
async def products_by_category(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_products_by_category(db)


@router.get("/products/top-viewed")
async def top_viewed(
    limit: int = Query(20),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_top_products(db, "view_count", limit)


@router.get("/products/top-wishlisted")
async def top_wishlisted(
    limit: int = Query(20),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_top_products(db, "wishlist_count", limit)


@router.get("/products/growth")
async def products_growth(
    period: str = Query("30d"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_products_growth(db, period)


@router.get("/products/price-distribution")
async def price_distribution(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_price_distribution(db)


@router.get("/products/ai-stats")
async def ai_stats(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_ai_stats(db)


@router.get("/products/rating-distribution")
async def rating_dist(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_rating_distribution(db)


@router.get("/orders/trend")
async def orders_trend(
    period: str = Query("30d"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_orders_trend(db, period)


@router.get("/orders/funnel")
async def order_funnel(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_order_funnel(db)


@router.get("/orders/recent")
async def recent_orders(
    limit: int = Query(50),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_recent_orders(db, limit)


@router.get("/engagement/features")
async def feature_usage(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_feature_usage(db)


@router.get("/engagement/searches")
async def top_searches(
    limit: int = Query(30),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_top_searches(db, limit)


@router.get("/engagement/demand-gaps")
async def demand_gaps(
    limit: int = Query(20),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_demand_gaps(db, limit)


@router.get("/engagement/haggles")
async def haggle_stats(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_haggle_stats(db)


@router.get("/engagement/deals")
async def deal_stats(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await service.get_deal_performance(db)


@router.get("/financial/shopcoins")
async def shopcoins_economy(
    period: str = Query("30d"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_shopcoins_economy(db, period)


@router.get("/users/{user_id}")
async def user_detail_admin(user_id: UUID, user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    data = await service.get_user_detail(db, user_id)
    if not data:
        raise HTTPException(status_code=404, detail="User not found")
    return data


@router.get("/shops/{shop_id}")
async def shop_detail_admin_endpoint(shop_id: UUID, user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    data = await service.get_shop_detail_admin(db, shop_id)
    if not data:
        raise HTTPException(status_code=404, detail="Shop not found")
    return data


@router.get("/products/{product_id}")
async def product_detail_admin_endpoint(product_id: UUID, user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    data = await service.get_product_detail_admin(db, product_id)
    if not data:
        raise HTTPException(status_code=404, detail="Product not found")
    return data


@router.get("/orders/{order_id}")
async def order_detail_admin_endpoint(order_id: UUID, user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    data = await service.get_order_detail_admin(db, order_id)
    if not data:
        raise HTTPException(status_code=404, detail="Order not found")
    return data


# ── AI Usage Analytics ─────────────────────────────────────────────────────


@router.get("/ai/overview")
async def ai_overview(
    period: str = Query("30d"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await ai_analytics.get_ai_overview(db, period)


@router.get("/ai/cost-by-feature")
async def ai_cost_by_feature(
    period: str = Query("30d"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await ai_analytics.get_ai_cost_by_feature(db, period)


@router.get("/ai/cost-by-model")
async def ai_cost_by_model(
    period: str = Query("30d"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await ai_analytics.get_ai_cost_by_model(db, period)


@router.get("/ai/daily-trend")
async def ai_daily_trend(
    period: str = Query("30d"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await ai_analytics.get_ai_daily_trend(db, period)


@router.get("/ai/recent-calls")
async def ai_recent_calls(
    limit: int = Query(50),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await ai_analytics.get_ai_recent_calls(db, limit)


@router.get("/ai/hourly-distribution")
async def ai_hourly_distribution(
    period: str = Query("7d"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await ai_analytics.get_ai_hourly_distribution(db, period)


@router.get("/ai/top-users")
async def ai_top_users(
    period: str = Query("30d"),
    limit: int = Query(20),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await ai_analytics.get_ai_top_users(db, period, limit)


@router.get("/ai/ranking-diagnostics")
async def ai_ranking_diagnostics(
    user=Depends(require_admin),
):
    return await ranking_analytics.get_ranking_diagnostics()


@router.get("/ai/ranking-outcomes")
async def ai_ranking_outcomes(
    period: str = Query("30d"),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await ranking_outcomes.get_ranking_outcomes(db, period)
