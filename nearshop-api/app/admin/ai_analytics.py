"""AI usage analytics service for admin dashboard."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, desc, and_, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.models import AIUsageLog


def _period_bounds(period: str) -> tuple[datetime, datetime]:
    """Return (start, end) datetimes for a period filter."""
    now = datetime.now(timezone.utc)
    mapping = {"1d": 1, "7d": 7, "30d": 30, "90d": 90}
    days = mapping.get(period, 30)
    return now - timedelta(days=days), now


async def get_ai_overview(db: AsyncSession, period: str = "30d") -> dict:
    """High-level AI usage KPIs."""
    since, until = _period_bounds(period)

    base = select(
        func.count(AIUsageLog.id).label("total_calls"),
        func.coalesce(func.sum(AIUsageLog.prompt_tokens), 0).label("total_prompt_tokens"),
        func.coalesce(func.sum(AIUsageLog.completion_tokens), 0).label("total_completion_tokens"),
        func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("total_tokens"),
        func.coalesce(func.sum(AIUsageLog.cost_usd), 0).label("total_cost"),
        func.coalesce(func.avg(AIUsageLog.response_time_ms), 0).label("avg_response_ms"),
        func.count(func.distinct(AIUsageLog.user_id)).label("unique_users"),
    ).where(AIUsageLog.created_at >= since, AIUsageLog.created_at <= until)

    row = (await db.execute(base)).one()

    # Error rate
    error_count = (await db.execute(
        select(func.count()).select_from(AIUsageLog)
        .where(AIUsageLog.created_at >= since, AIUsageLog.status == "error")
    )).scalar() or 0

    total = int(row.total_calls) or 1
    return {
        "total_calls": int(row.total_calls),
        "total_prompt_tokens": int(row.total_prompt_tokens),
        "total_completion_tokens": int(row.total_completion_tokens),
        "total_tokens": int(row.total_tokens),
        "total_cost_usd": round(float(row.total_cost), 4),
        "avg_response_ms": round(float(row.avg_response_ms)),
        "unique_users": int(row.unique_users),
        "error_count": error_count,
        "error_rate": round(error_count / total * 100, 1),
        "period": period,
    }


async def get_ai_cost_by_feature(db: AsyncSession, period: str = "30d") -> list[dict]:
    """Cost & call breakdown by feature."""
    since, _ = _period_bounds(period)

    stmt = (
        select(
            AIUsageLog.feature,
            func.count(AIUsageLog.id).label("calls"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("tokens"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), 0).label("cost"),
            func.coalesce(func.avg(AIUsageLog.response_time_ms), 0).label("avg_ms"),
        )
        .where(AIUsageLog.created_at >= since)
        .group_by(AIUsageLog.feature)
        .order_by(desc("cost"))
    )
    rows = (await db.execute(stmt)).fetchall()
    return [
        {
            "feature": r.feature,
            "calls": r.calls,
            "tokens": int(r.tokens),
            "cost_usd": round(float(r.cost), 4),
            "avg_response_ms": round(float(r.avg_ms)),
        }
        for r in rows
    ]


async def get_ai_cost_by_model(db: AsyncSession, period: str = "30d") -> list[dict]:
    """Cost & token breakdown by model."""
    since, _ = _period_bounds(period)

    stmt = (
        select(
            AIUsageLog.model,
            func.count(AIUsageLog.id).label("calls"),
            func.coalesce(func.sum(AIUsageLog.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(AIUsageLog.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), 0).label("cost"),
        )
        .where(AIUsageLog.created_at >= since)
        .group_by(AIUsageLog.model)
        .order_by(desc("cost"))
    )
    rows = (await db.execute(stmt)).fetchall()
    return [
        {
            "model": r.model,
            "calls": r.calls,
            "prompt_tokens": int(r.prompt_tokens),
            "completion_tokens": int(r.completion_tokens),
            "total_tokens": int(r.total_tokens),
            "cost_usd": round(float(r.cost), 4),
        }
        for r in rows
    ]


async def get_ai_daily_trend(db: AsyncSession, period: str = "30d") -> list[dict]:
    """Daily call count, token usage, and cost trend."""
    since, _ = _period_bounds(period)

    stmt = (
        select(
            func.date_trunc("day", AIUsageLog.created_at).label("day"),
            func.count(AIUsageLog.id).label("calls"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("tokens"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), 0).label("cost"),
            func.count(case((AIUsageLog.status == "error", 1))).label("errors"),
        )
        .where(AIUsageLog.created_at >= since)
        .group_by("day")
        .order_by("day")
    )
    rows = (await db.execute(stmt)).fetchall()
    return [
        {
            "date": r.day.strftime("%Y-%m-%d") if r.day else "",
            "calls": r.calls,
            "tokens": int(r.tokens),
            "cost_usd": round(float(r.cost), 4),
            "errors": r.errors,
        }
        for r in rows
    ]


async def get_ai_recent_calls(db: AsyncSession, limit: int = 50) -> list[dict]:
    """Recent AI API calls (chat history / audit log)."""
    stmt = (
        select(AIUsageLog)
        .order_by(desc(AIUsageLog.created_at))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": str(r.id),
            "feature": r.feature,
            "model": r.model,
            "prompt_tokens": r.prompt_tokens,
            "completion_tokens": r.completion_tokens,
            "total_tokens": r.total_tokens,
            "cost_usd": round(float(r.cost_usd), 6),
            "response_time_ms": r.response_time_ms,
            "status": r.status,
            "error_message": r.error_message,
            "has_image": r.has_image,
            "user_id": str(r.user_id) if r.user_id else None,
            "shop_id": str(r.shop_id) if r.shop_id else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


async def get_ai_hourly_distribution(db: AsyncSession, period: str = "7d") -> list[dict]:
    """Calls per hour-of-day — helps identify peak usage times."""
    since, _ = _period_bounds(period)

    stmt = (
        select(
            func.extract("hour", AIUsageLog.created_at).label("hour"),
            func.count(AIUsageLog.id).label("calls"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), 0).label("cost"),
        )
        .where(AIUsageLog.created_at >= since)
        .group_by("hour")
        .order_by("hour")
    )
    rows = (await db.execute(stmt)).fetchall()
    return [
        {"hour": int(r.hour), "calls": r.calls, "cost_usd": round(float(r.cost), 4)}
        for r in rows
    ]


async def get_ai_top_users(db: AsyncSession, period: str = "30d", limit: int = 20) -> list[dict]:
    """Users generating the most AI cost."""
    since, _ = _period_bounds(period)
    from app.auth.models import User

    stmt = (
        select(
            AIUsageLog.user_id,
            User.name,
            User.phone,
            func.count(AIUsageLog.id).label("calls"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("tokens"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), 0).label("cost"),
        )
        .join(User, User.id == AIUsageLog.user_id)
        .where(AIUsageLog.created_at >= since, AIUsageLog.user_id.isnot(None))
        .group_by(AIUsageLog.user_id, User.name, User.phone)
        .order_by(desc("cost"))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).fetchall()
    return [
        {
            "user_id": str(r.user_id),
            "name": r.name or "Unknown",
            "phone": r.phone,
            "calls": r.calls,
            "tokens": int(r.tokens),
            "cost_usd": round(float(r.cost), 4),
        }
        for r in rows
    ]
