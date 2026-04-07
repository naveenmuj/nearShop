"""Media upload endpoint — accepts media/document files and returns a public URL."""
import io

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from app.auth.models import User
from app.auth.permissions import get_current_user
from app.core.storage import upload_file

router = APIRouter(prefix="/api/v1/upload", tags=["media"])

_ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "audio/mpeg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
}
_MAX_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB


@router.post("")
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    folder: str | None = Form(None),
    entity_type: str | None = Form(None),
    entity_id: str | None = Form(None),
    purpose: str | None = Form(None),
    shop_id: str | None = Form(None),
    product_id: str | None = Form(None),
    document_type: str | None = Form(None),
    current_user: User = Depends(get_current_user),
):
    """Upload media/document and return its URL.

    Preferred upload metadata:
    - **entity_type**: user | shop | product | story | verification | general
    - **entity_id**: existing entity UUID when available
    - **purpose**: avatar | logo | cover | image | media | document
    - **shop_id/product_id/document_type**: optional extra path context

    Backward compatibility:
    - **folder** is still accepted for older clients.
    """
    content_type = (file.content_type or "application/octet-stream").split(";")[0].strip().lower()
    if content_type not in _ALLOWED_TYPES:
        from app.core.exceptions import BadRequestError
        raise BadRequestError(
            f"File type '{content_type}' is not allowed. Supported: images, PDF, DOC, DOCX, TXT."
        )

    data = await file.read()
    if len(data) > _MAX_SIZE_BYTES:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("File exceeds 15 MB limit.")

    folder_value = folder or request.query_params.get("folder") or "general"
    entity_type_value = entity_type or request.query_params.get("entity_type")
    entity_id_value = entity_id or request.query_params.get("entity_id")
    purpose_value = purpose or request.query_params.get("purpose")
    shop_id_value = shop_id or request.query_params.get("shop_id")
    product_id_value = product_id or request.query_params.get("product_id")
    document_type_value = document_type or request.query_params.get("document_type")

    stored = await upload_file(
        io.BytesIO(data),
        folder_value,
        content_type,
        filename=file.filename,
        user_id=str(current_user.id),
        entity_type=entity_type_value,
        entity_id=entity_id_value,
        purpose=purpose_value,
        shop_id=shop_id_value,
        product_id=product_id_value,
        document_type=document_type_value,
    )
    return {
        "url": stored.url,
        "key": stored.key,
        "bucket": stored.bucket,
        "provider": stored.provider,
    }
