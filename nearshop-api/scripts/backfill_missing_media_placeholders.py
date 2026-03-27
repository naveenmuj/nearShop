"""Replace broken product image references with branded placeholders in Spaces."""

from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import psycopg2
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.storage import store_bytes
from scripts.migrate_media_to_spaces import db_connect


def build_placeholder(title: str) -> bytes:
    width, height = 1200, 1200
    img = Image.new("RGB", (width, height), "#f6f1ff")
    draw = ImageDraw.Draw(img)

    # soft premium card look
    draw.rounded_rectangle((70, 70, width - 70, height - 70), radius=60, fill="#ffffff", outline="#e6dcff", width=4)
    draw.rounded_rectangle((120, 120, width - 120, 430), radius=40, fill="#7c6cf2")
    draw.ellipse((190, 170, 330, 310), fill="#ffffff")
    draw.rectangle((252, 205, 268, 285), fill="#7c6cf2")
    draw.rectangle((220, 237, 300, 253), fill="#7c6cf2")
    draw.text((360, 190), "NearShop", fill="#ffffff")
    draw.text((360, 255), "Product image coming soon", fill="#efeaff")

    safe_title = (title or "Product").strip()[:34]
    draw.text((140, 540), safe_title, fill="#1f2937")
    draw.text((140, 610), "Image unavailable in source data", fill="#6b7280")
    draw.text((140, 690), "Hosted fallback generated from media migration", fill="#8b5cf6")

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=90)
    return out.getvalue()


def main() -> None:
    conn = db_connect()
    updated = 0
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text, shop_id::text, name, images
                FROM products
                WHERE EXISTS (
                    SELECT 1
                    FROM unnest(COALESCE(images, ARRAY[]::text[])) v
                    WHERE v <> ''
                      AND v NOT LIKE 'https://nearshop-bucket.sfo3.digitaloceanspaces.com/%'
                )
                """
            )
            rows = cur.fetchall()
            for product_id, shop_id, name, images in rows:
                replacement = store_bytes(
                    build_placeholder(name),
                    content_type="image/jpeg",
                    filename=f"{product_id}.jpg",
                    entity_type="product",
                    entity_id=product_id,
                    product_id=product_id,
                    shop_id=shop_id,
                    purpose="image",
                )
                cur.execute(
                    "UPDATE products SET images = %s WHERE id = %s::uuid",
                    ([replacement.url], product_id),
                )
                updated += 1
    conn.close()
    print(f"updated_products={updated}")


if __name__ == "__main__":
    main()
