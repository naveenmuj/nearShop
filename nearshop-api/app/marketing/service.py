from uuid import UUID
from datetime import datetime
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.products.models import Product
from app.shops.models import Shop


async def generate_catalog_data(
    db: AsyncSession, shop_id: UUID, product_ids: list = None, limit: int = 10,
) -> dict:
    shop = await db.get(Shop, shop_id)
    if not shop:
        return None

    query = select(Product).where(Product.shop_id == shop_id, Product.is_available == True)
    if product_ids:
        from uuid import UUID as _UUID
        uuids = []
        for pid in product_ids:
            try:
                uuids.append(_UUID(pid))
            except Exception:
                pass
        if uuids:
            query = query.where(Product.id.in_(uuids))
    else:
        query = query.order_by(Product.view_count.desc()).limit(limit)

    result = await db.execute(query)
    products = result.scalars().all()

    return {
        "shop_name": shop.name,
        "shop_phone": shop.whatsapp or shop.phone or "",
        "shop_address": shop.address or "",
        "products": [
            {
                "name": p.name,
                "price": float(p.price),
                "mrp": float(p.compare_price) if p.compare_price else None,
                "image": p.images[0] if p.images else None,
                "category": p.category,
            }
            for p in products
        ],
    }


async def generate_whatsapp_text(
    db: AsyncSession, shop_id: UUID, template: str, product_ids: list = None,
) -> str:
    data = await generate_catalog_data(db, shop_id, product_ids)
    if not data:
        return ""

    prods = data["products"]
    name = data["shop_name"]
    phone = data["shop_phone"]
    addr = data["shop_address"]

    if template == "new_arrivals":
        lines = [f"*New Arrivals at {name}!*\n"]
        for p in prods[:10]:
            disc = ""
            if p["mrp"] and p["mrp"] > p["price"]:
                pct = round((1 - p["price"] / p["mrp"]) * 100)
                disc = f" ({pct}% OFF!)"
            lines.append(f"  {p['name']} -- Rs.{int(p['price'])}{disc}")
        lines.append(f"\n{addr}\nWhatsApp: {phone}")

    elif template == "deals":
        lines = [f"*Special Deals at {name}!*\n"]
        for p in prods[:10]:
            if p["mrp"] and p["mrp"] > p["price"]:
                lines.append(f"  {p['name']}\n   ~Rs.{int(p['mrp'])}~ -> *Rs.{int(p['price'])}*\n")
            else:
                lines.append(f"  {p['name']} -- *Rs.{int(p['price'])}*")
        lines.append(f"\nVisit: {addr}\nOrder: {phone}")

    elif template == "festival":
        lines = [f"*Festival Special at {name}!*\n", "Best deals on top products:\n"]
        for p in prods[:8]:
            lines.append(f"  {p['name']} -- Rs.{int(p['price'])}")
        lines.append(f"\n{addr}\n{phone}\n\n_Happy Shopping!_")

    elif template == "catalog":
        lines = [f"*{name} -- Product Catalog*\n"]
        by_cat = defaultdict(list)
        for p in prods:
            by_cat[p["category"] or "Other"].append(p)
        for cat, items in by_cat.items():
            lines.append(f"*{cat}:*")
            for p in items:
                lines.append(f"  - {p['name']} -- Rs.{int(p['price'])}")
            lines.append("")
        lines.append(f"{addr}\nOrder: {phone}")

    else:
        lines = [f"Check out *{name}*!\n"]
        for p in prods[:5]:
            lines.append(f"- {p['name']} -- Rs.{int(p['price'])}")
        lines.append(f"\n{phone}")

    return "\n".join(lines)


async def get_festival_suggestions() -> list:
    festivals = [
        {"name": "Ugadi / Gudi Padwa", "date": "2026-03-29", "emoji": "🪷", "suggestion": "New beginnings sale"},
        {"name": "Ramadan / Eid", "date": "2026-04-14", "emoji": "🌙", "suggestion": "Festive collection"},
        {"name": "Akshaya Tritiya", "date": "2026-04-26", "emoji": "✨", "suggestion": "Gold & jewelry deals"},
        {"name": "Mother's Day", "date": "2026-05-10", "emoji": "💐", "suggestion": "Gift hampers"},
        {"name": "Independence Day", "date": "2026-08-15", "emoji": "🇮🇳", "suggestion": "Freedom sale"},
        {"name": "Raksha Bandhan", "date": "2026-08-22", "emoji": "🎀", "suggestion": "Gift combos"},
        {"name": "Ganesh Chaturthi", "date": "2026-09-07", "emoji": "🙏", "suggestion": "Pooja items"},
        {"name": "Navratri / Dussehra", "date": "2026-10-12", "emoji": "🪔", "suggestion": "Fashion & ethnic"},
        {"name": "Diwali", "date": "2026-10-31", "emoji": "🪔", "suggestion": "Mega sale"},
        {"name": "Christmas", "date": "2026-12-25", "emoji": "🎄", "suggestion": "Gifts & decorations"},
    ]

    now = datetime.now()
    upcoming = []
    for f in festivals:
        fdate = datetime.strptime(f["date"], "%Y-%m-%d")
        days = (fdate - now).days
        if -3 <= days <= 45:
            upcoming.append({**f, "days_away": days, "status": "happening_now" if days < 0 else "upcoming"})
    return upcoming
