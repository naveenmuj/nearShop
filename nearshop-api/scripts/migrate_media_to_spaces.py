"""Migrate existing media URLs in the database into DigitalOcean Spaces."""

from __future__ import annotations

import json
import mimetypes
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import psycopg2
from botocore.exceptions import ClientError

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.storage import _get_s3_client, _spaces_settings, store_bytes, upload_remote_file

STATIC_UPLOADS_DIR = Path(__file__).resolve().parents[1] / "static" / "uploads"


def load_env() -> dict[str, str]:
    env = {}
    env_path = Path(__file__).resolve().parents[1] / ".env"
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def db_connect():
    env = load_env()
    dsn = env["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://").replace("ssl=require", "sslmode=require")
    return psycopg2.connect(dsn)


def already_bucketed(url: str) -> bool:
    cfg = _spaces_settings()
    public_base = cfg["public_base"].rstrip("/")
    return bool(public_base and url.startswith(public_base + "/"))


def usable_url(url: str | None) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"}


def local_upload_key(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.replace("\\", "/")
    if normalized.startswith("/static/uploads/"):
        return normalized.removeprefix("/static/uploads/").lstrip("/")
    if normalized.startswith("static/uploads/"):
        return normalized.removeprefix("static/uploads/").lstrip("/")
    return None


def upload_existing_media(
    source: str,
    *,
    filename: str | None = None,
    folder: str | None = None,
    user_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    purpose: str | None = None,
    shop_id: str | None = None,
    product_id: str | None = None,
    document_type: str | None = None,
):
    local_key = local_upload_key(source)
    if local_key:
        local_path = STATIC_UPLOADS_DIR / Path(local_key)
        if not local_path.exists():
            raise FileNotFoundError(f"Local upload not found: {local_path}")
        content_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
        return store_bytes(
            local_path.read_bytes(),
            content_type=content_type,
            filename=filename or local_path.name,
            folder=folder,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            purpose=purpose,
            shop_id=shop_id,
            product_id=product_id,
            document_type=document_type,
            object_key=local_key,
        )

    if usable_url(source):
        return upload_remote_file(
            source,
            filename=filename,
            folder=folder,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            purpose=purpose,
            shop_id=shop_id,
            product_id=product_id,
            document_type=document_type,
        )

    raise ValueError(f"Unsupported media source: {source}")


def migrate_user_avatars(cur) -> dict:
    cur.execute(
        """
        SELECT id::text, avatar_url
        FROM users
        WHERE avatar_url IS NOT NULL
          AND avatar_url <> ''
        """
    )
    rows = cur.fetchall()
    migrated = 0
    skipped = 0
    failed = []

    for user_id, url in rows:
        if already_bucketed(url):
            skipped += 1
            continue
        try:
            stored = upload_existing_media(
                url,
                entity_type="user",
                entity_id=user_id,
                purpose="avatar",
                user_id=user_id,
            )
            cur.execute("UPDATE users SET avatar_url = %s WHERE id = %s::uuid", (stored.url, user_id))
            migrated += 1
        except Exception as exc:
            failed.append({"user_id": user_id, "url": url, "error": str(exc)})

    return {"migrated": migrated, "skipped": skipped, "failed": failed}


def migrate_product_images(cur) -> dict:
    cur.execute(
        """
        SELECT p.id::text, p.shop_id::text, p.images
        FROM products p
        WHERE p.images IS NOT NULL
          AND array_length(p.images, 1) > 0
        """
    )
    rows = cur.fetchall()
    migrated = 0
    skipped = 0
    failed = []

    for product_id, shop_id, images in rows:
        new_images = []
        changed = False
        for image_url in images or []:
            if already_bucketed(image_url):
                new_images.append(image_url)
                skipped += 1
                continue
            try:
                stored = upload_existing_media(
                    image_url,
                    entity_type="product",
                    entity_id=product_id,
                    product_id=product_id,
                    shop_id=shop_id,
                    purpose="image",
                )
                new_images.append(stored.url)
                migrated += 1
                changed = True
            except Exception as exc:
                failed.append({"product_id": product_id, "url": image_url, "error": str(exc)})
                new_images.append(image_url)
        if changed:
            cur.execute("UPDATE products SET images = %s WHERE id = %s::uuid", (new_images, product_id))

    return {"migrated": migrated, "skipped": skipped, "failed": failed}


def migrate_shop_media(cur) -> dict:
    cur.execute(
        """
        SELECT id::text, owner_id::text, logo_url, cover_image, gallery
        FROM shops
        WHERE COALESCE(logo_url, '') <> ''
           OR COALESCE(cover_image, '') <> ''
           OR (gallery IS NOT NULL AND array_length(gallery, 1) > 0)
        """
    )
    rows = cur.fetchall()
    migrated = 0
    skipped = 0
    failed = []

    for shop_id, owner_id, logo_url, cover_image, gallery in rows:
        updates = {}
        for field_name, field_url, purpose in [
            ("logo_url", logo_url, "logo"),
            ("cover_image", cover_image, "cover"),
        ]:
            if already_bucketed(field_url):
                if field_url:
                    skipped += 1
                continue
            try:
                stored = upload_existing_media(
                    field_url,
                    entity_type="shop",
                    entity_id=shop_id,
                    shop_id=shop_id,
                    user_id=owner_id,
                    purpose=purpose,
                )
                updates[field_name] = stored.url
                migrated += 1
            except Exception as exc:
                failed.append({"shop_id": shop_id, "field": field_name, "url": field_url, "error": str(exc)})

        if gallery:
            new_gallery = []
            gallery_changed = False
            for idx, image_url in enumerate(gallery):
                if already_bucketed(image_url):
                    new_gallery.append(image_url)
                    skipped += 1
                    continue
                try:
                    stored = upload_existing_media(
                        image_url,
                        entity_type="shop",
                        entity_id=shop_id,
                        shop_id=shop_id,
                        user_id=owner_id,
                        purpose="gallery",
                    )
                    new_gallery.append(stored.url)
                    migrated += 1
                    gallery_changed = True
                except Exception as exc:
                    failed.append({"shop_id": shop_id, "field": f"gallery[{idx}]", "url": image_url, "error": str(exc)})
                    new_gallery.append(image_url)
            if gallery_changed:
                updates["gallery"] = new_gallery

        if updates:
            assignments = []
            values = []
            for field, value in updates.items():
                assignments.append(f"{field} = %s")
                values.append(value)
            values.append(shop_id)
            cur.execute(f"UPDATE shops SET {', '.join(assignments)} WHERE id = %s::uuid", tuple(values))

    return {"migrated": migrated, "skipped": skipped, "failed": failed}


def migrate_story_media(cur) -> dict:
    cur.execute(
        """
        SELECT id::text, shop_id::text, media_url
        FROM stories
        WHERE media_url IS NOT NULL
          AND media_url <> ''
        """
    )
    rows = cur.fetchall()
    migrated = 0
    skipped = 0
    failed = []

    for story_id, shop_id, media_url in rows:
        if already_bucketed(media_url):
            skipped += 1
            continue
        try:
            stored = upload_existing_media(
                media_url,
                entity_type="story",
                entity_id=story_id,
                shop_id=shop_id,
                purpose="media",
            )
            cur.execute("UPDATE stories SET media_url = %s WHERE id = %s::uuid", (stored.url, story_id))
            migrated += 1
        except Exception as exc:
            failed.append({"story_id": story_id, "url": media_url, "error": str(exc)})

    return {"migrated": migrated, "skipped": skipped, "failed": failed}


def migrate_verification_media(cur) -> dict:
    cur.execute(
        """
        SELECT id::text, metadata
        FROM shops
        WHERE metadata IS NOT NULL
        """
    )
    rows = cur.fetchall()
    migrated = 0
    skipped = 0
    failed = []

    for shop_id, metadata in rows:
        metadata = metadata or {}
        verification = metadata.get("verification") or {}
        documents = verification.get("documents") or []
        changed = False

        for idx, document in enumerate(documents):
            image_url = document.get("image_url")
            if already_bucketed(image_url):
                if image_url:
                    skipped += 1
                continue
            try:
                stored = upload_existing_media(
                    image_url,
                    entity_type="verification",
                    shop_id=shop_id,
                    purpose="document",
                    document_type=document.get("type"),
                )
                document["image_url"] = stored.url
                changed = True
                migrated += 1
            except Exception as exc:
                failed.append({"shop_id": shop_id, "document_index": idx, "url": image_url, "error": str(exc)})

        if changed:
            metadata["verification"] = verification
            cur.execute("UPDATE shops SET metadata = %s WHERE id = %s::uuid", (json.dumps(metadata), shop_id))

    return {"migrated": migrated, "skipped": skipped, "failed": failed}


def main() -> None:
    cfg = _spaces_settings()
    client = _get_s3_client()
    try:
        client.list_objects_v2(Bucket=cfg["bucket"], MaxKeys=1)
    except ClientError as exc:
        raise RuntimeError(
            "DigitalOcean Spaces authentication failed. "
            "Please verify DO_SPACES_ACCESS_KEY / DO_SPACES_SECRET_KEY before running migration."
        ) from exc

    conn = db_connect()
    try:
        with conn.cursor() as cur:
            report = {
                "provider_public_base": _spaces_settings()["public_base"],
                "users_avatar": migrate_user_avatars(cur),
                "shops_media": migrate_shop_media(cur),
                "products_images": migrate_product_images(cur),
                "stories_media": migrate_story_media(cur),
                "verification_media": migrate_verification_media(cur),
            }
        conn.commit()
        print(json.dumps(report, indent=2))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
