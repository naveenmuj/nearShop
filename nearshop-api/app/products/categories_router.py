from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.products.schemas import CategoryResponse
from app.products.categories_service import get_categories, get_category

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories_endpoint(
    db: AsyncSession = Depends(get_db),
):
    categories = await get_categories(db)
    return [CategoryResponse.model_validate(c) for c in categories]


@router.get("/{slug}", response_model=CategoryResponse)
async def get_category_endpoint(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    category = await get_category(db, slug)
    return CategoryResponse.model_validate(category)
