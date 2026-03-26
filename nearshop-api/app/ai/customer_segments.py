"""Feature 4: RFM Customer Segmentation + Churn Predictor."""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.orders.models import Order


_SEGMENT_META = {
    "Champions": ("#10B981", "Keep them happy with exclusive previews"),
    "Loyal": ("#3B82F6", "Reward with a loyalty deal"),
    "Potential Loyalist": ("#8B5CF6", "Nudge with a 'Come back' offer"),
    "At Risk": ("#F59E0B", "Send a win-back deal before they leave"),
    "Can't Lose": ("#EF4444", "Urgent: send a strong personalised offer"),
    "Lost": ("#6B7280", "Re-engage with a steep discount"),
    "New Customers": ("#06B6D4", "Onboard them - second purchase deal"),
    "Others": ("#9CA3AF", "Engage with a general offer"),
}


def _score_recency(days_since: int) -> int:
    if days_since <= 7:
        return 5
    if days_since <= 14:
        return 4
    if days_since <= 30:
        return 3
    if days_since <= 45:
        return 2
    return 1


def _score_frequency(order_count: int) -> int:
    if order_count >= 5:
        return 5
    if order_count >= 4:
        return 4
    if order_count >= 3:
        return 3
    if order_count == 2:
        return 2
    return 1


def _score_monetary(value: float, all_values: list[float]) -> int:
    if not all_values:
        return 1
    ordered = sorted(all_values)
    if len(ordered) == 1:
        return 5
    rank = ordered.index(value)
    percentile = rank / max(len(ordered) - 1, 1)
    if percentile >= 0.8:
        return 5
    if percentile >= 0.6:
        return 4
    if percentile >= 0.4:
        return 3
    if percentile >= 0.2:
        return 2
    return 1


def _classify(days_since: int, frequency: int, monetary_score: int) -> tuple[str, str, str]:
    """Absolute rules are more stable than quantiles for very small shops."""
    if days_since <= 14 and frequency >= 2:
        label = "Champions" if monetary_score >= 3 else "Loyal"
    elif days_since <= 21 and frequency >= 2:
        label = "Loyal"
    elif days_since <= 21 and frequency == 1:
        label = "New Customers"
    elif days_since <= 45 and frequency >= 2:
        label = "Potential Loyalist"
    elif days_since <= 45:
        label = "At Risk"
    elif days_since <= 75 and frequency >= 3:
        label = "Can't Lose"
    elif days_since <= 75:
        label = "Lost"
    else:
        label = "Lost"
    color, action = _SEGMENT_META[label]
    return label, color, action


async def get_customer_segments(
    db: AsyncSession,
    shop_id: UUID,
) -> dict:
    """Compute stable RFM-like segments for a shop."""
    now = datetime.now(timezone.utc)

    stmt = (
        select(
            Order.customer_id,
            func.count(Order.id).label("order_count"),
            func.sum(Order.total).label("total_spent"),
            func.max(Order.created_at).label("last_order_at"),
        )
        .where(
            Order.shop_id == shop_id,
            Order.status.not_in(["cancelled", "rejected"]),
        )
        .group_by(Order.customer_id)
    )
    rows = (await db.execute(stmt)).fetchall()

    if not rows:
        return {
            "segments": {},
            "customers": [],
            "summary": {"total": 0, "at_risk_count": 0, "champions_count": 0},
        }

    rfm_raw = []
    for row in rows:
        last_order_at = row.last_order_at
        if last_order_at is None:
            days_since = 999
        else:
            reference = (
                last_order_at.replace(tzinfo=timezone.utc)
                if last_order_at.tzinfo is None
                else last_order_at.astimezone(timezone.utc)
            )
            days_since = (now - reference).days
        rfm_raw.append(
            {
                "customer_id": str(row.customer_id),
                "recency_days": days_since,
                "frequency": int(row.order_count or 0),
                "monetary": float(row.total_spent or 0),
            }
        )

    customer_ids = [x["customer_id"] for x in rfm_raw]
    user_stmt = select(User.id, User.name, User.phone).where(User.id.in_(customer_ids))
    user_rows = (await db.execute(user_stmt)).fetchall()
    user_map = {
        str(u.id): {"name": u.name or "Customer", "phone": u.phone or ""}
        for u in user_rows
    }

    monetary_values = [x["monetary"] for x in rfm_raw]
    customers = []
    segment_counts: dict[str, int] = {}

    for x in rfm_raw:
        r_score = _score_recency(x["recency_days"])
        f_score = _score_frequency(x["frequency"])
        m_score = _score_monetary(x["monetary"], monetary_values)
        label, color, action = _classify(x["recency_days"], x["frequency"], m_score)
        segment_counts[label] = segment_counts.get(label, 0) + 1

        info = user_map.get(x["customer_id"], {"name": "Customer", "phone": ""})
        customers.append(
            {
                "customer_id": x["customer_id"],
                "name": info["name"],
                "phone": info["phone"],
                "recency_days": x["recency_days"],
                "frequency": x["frequency"],
                "monetary": round(x["monetary"], 2),
                "r_score": r_score,
                "f_score": f_score,
                "m_score": m_score,
                "segment": label,
                "segment_color": color,
                "win_back_action": action,
            }
        )

    priority_order = {
        "Can't Lose": 0,
        "At Risk": 1,
        "Lost": 2,
        "Champions": 3,
        "Loyal": 4,
        "Potential Loyalist": 5,
        "New Customers": 6,
        "Others": 7,
    }
    customers.sort(key=lambda c: (priority_order.get(c["segment"], 99), c["recency_days"]))

    at_risk_count = (
        segment_counts.get("At Risk", 0)
        + segment_counts.get("Can't Lose", 0)
        + segment_counts.get("Lost", 0)
    )
    champions_count = segment_counts.get("Champions", 0) + segment_counts.get("Loyal", 0)

    return {
        "segments": segment_counts,
        "customers": customers,
        "summary": {
            "total": len(customers),
            "at_risk_count": at_risk_count,
            "champions_count": champions_count,
            "lost_count": segment_counts.get("Lost", 0),
        },
    }
