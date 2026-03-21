"""Media upload endpoint — accepts image files and returns a public URL."""
import io

from fastapi import APIRouter, Depends, File, UploadFile

from app.auth.models import User
from app.auth.permissions import get_current_user
from app.core.storage import upload_file

router = APIRouter(prefix="/api/v1/upload", tags=["media"])

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"}
_MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("")
async def upload_media(
    file: UploadFile = File(...),
    folder: str = "products",
    current_user: User = Depends(get_current_user),
):
    """Upload an image and return its URL.

    - **folder**: subdirectory for organisation (products, shops, stories, avatars)
    - Returns `{"url": "https://..."}` — use this URL when creating products/shops
    """
    content_type = file.content_type or "image/jpeg"
    if content_type not in _ALLOWED_TYPES:
        from app.core.exceptions import BadRequestError
        raise BadRequestError(f"File type '{content_type}' is not allowed. Use JPEG, PNG, or WebP.")

    data = await file.read()
    if len(data) > _MAX_SIZE_BYTES:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("File exceeds 10 MB limit.")

    url = await upload_file(io.BytesIO(data), folder, content_type)
    return {"url": url}
