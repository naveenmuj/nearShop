from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.permissions import require_business
from app.catalog.models import CatalogTemplate
from app.catalog.models import ShopCatalogSelection
from app.catalog.schemas import (
    CatalogAddProductsRequest,
    CatalogAddProductsResponse,
    CatalogPublishProductsRequest,
    CatalogPublishProductsResponse,
    CatalogPublishResultItem,
    CatalogAddResultItem,
    CatalogCategorySummary,
    CatalogEnableProductsRequest,
    CatalogEnableProductsResponse,
    ShopCatalogSelectionListResponse,
    ShopCatalogSelectionResponse,
    CatalogTemplateListResponse,
    CatalogTemplateResponse,
)
from app.core.database import get_db
from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.products.models import Product
from app.shops.models import Shop

router = APIRouter(prefix="/api/v1/catalog", tags=["catalog"])


def _catalog_to_response(item: CatalogTemplate) -> CatalogTemplateResponse:
    return CatalogTemplateResponse.model_validate(item)


async def _verify_shop_owner(
    db: AsyncSession,
    shop_id: UUID,
    owner_id: UUID,
) -> Shop:
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")
    return shop


@router.get("/templates", response_model=CatalogTemplateListResponse)
async def list_catalog_templates(
    q: str | None = Query(None, min_length=1, max_length=100),
    category: str | None = Query(None, max_length=100),
    categories: list[str] | None = Query(None),
    brand: str | None = Query(None, max_length=150),
    source: str | None = Query(None, max_length=50),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(CatalogTemplate).where(CatalogTemplate.is_active == True)

    if q:
        like_pattern = f"%{q}%"
        base_query = base_query.where(
            or_(
                CatalogTemplate.name.ilike(like_pattern),
                CatalogTemplate.brand.ilike(like_pattern),
                CatalogTemplate.category.ilike(like_pattern),
                CatalogTemplate.description.ilike(like_pattern),
                CatalogTemplate.short_description.ilike(like_pattern),
            )
        )

    if category:
        base_query = base_query.where(func.lower(CatalogTemplate.category) == category.lower())
    if categories:
        normalized_categories = [item.strip().lower() for item in categories if item and item.strip()]
        if normalized_categories:
            base_query = base_query.where(func.lower(CatalogTemplate.category).in_(normalized_categories))
    if brand:
        base_query = base_query.where(func.lower(CatalogTemplate.brand) == brand.lower())
    if source:
        base_query = base_query.where(func.lower(CatalogTemplate.data_source) == source.lower())

    total = (await db.execute(select(func.count()).select_from(base_query.subquery()))).scalar() or 0
    offset = (page - 1) * per_page
    result = await db.execute(
        base_query.order_by(
            CatalogTemplate.popularity_score.desc(),
            CatalogTemplate.num_shops_using.desc(),
            CatalogTemplate.created_at.desc(),
        )
        .offset(offset)
        .limit(per_page)
    )
    items = list(result.scalars().all())

    return CatalogTemplateListResponse(
        items=[_catalog_to_response(item) for item in items],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/templates/{catalog_id}", response_model=CatalogTemplateResponse)
async def get_catalog_template(
    catalog_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CatalogTemplate).where(CatalogTemplate.id == catalog_id))
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundError("Catalog product not found")
    return _catalog_to_response(template)


@router.get("/categories", response_model=list[CatalogCategorySummary])
async def list_catalog_categories(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            CatalogTemplate.category,
            func.count(CatalogTemplate.id),
        )
        .where(CatalogTemplate.is_active == True)
        .group_by(CatalogTemplate.category)
        .order_by(func.count(CatalogTemplate.id).desc(), CatalogTemplate.category.asc())
    )
    rows = result.all()
    return [CatalogCategorySummary(name=row[0], count=row[1]) for row in rows if row[0]]


@router.post("/shops/{shop_id}/add-products", response_model=CatalogAddProductsResponse)
async def add_catalog_products_to_shop(
    shop_id: UUID,
    body: CatalogAddProductsRequest,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    if not body.items:
        raise BadRequestError("Select at least one catalog product")

    await _verify_shop_owner(db, shop_id, current_user.id)
    created: list[CatalogAddResultItem] = []
    created_count = 0
    updated_count = 0
    skipped_count = 0

    for selection in body.items:
        template_result = await db.execute(
            select(CatalogTemplate).where(CatalogTemplate.id == selection.catalog_id)
        )
        template = template_result.scalar_one_or_none()
        if not template:
            skipped_count += 1
            created.append(
                CatalogAddResultItem(
                    catalog_id=selection.catalog_id,
                    name="Unknown catalog item",
                    status="skipped",
                    message="Catalog product not found",
                )
            )
            continue

        price_value = selection.price if selection.price is not None else (template.base_price_inr or Decimal("0"))
        compare_price = selection.compare_price if selection.compare_price is not None else template.compare_price_inr

        selection_result = await db.execute(
            select(ShopCatalogSelection).where(
                ShopCatalogSelection.shop_id == shop_id,
                ShopCatalogSelection.catalog_id == template.id,
            )
        )
        existing_selection = selection_result.scalar_one_or_none()
        if existing_selection:
            existing_selection.local_price = price_value
            existing_selection.compare_price = compare_price
            existing_selection.local_description = selection.local_description
            existing_selection.stock_quantity = selection.stock_quantity
            existing_selection.is_active = True
            updated_count += 1
            created.append(
                CatalogAddResultItem(
                    catalog_id=template.id,
                    name=template.name,
                    status="updated",
                    message="Selection updated for your shop",
                )
            )
        else:
            db.add(
                ShopCatalogSelection(
                    shop_id=shop_id,
                    catalog_id=template.id,
                    local_price=price_value,
                    compare_price=compare_price,
                    local_description=selection.local_description,
                    stock_quantity=selection.stock_quantity,
                    is_active=True,
                )
            )
            created_count += 1
            created.append(
                CatalogAddResultItem(
                    catalog_id=template.id,
                    name=template.name,
                    status="created",
                    message="Saved to your shop selections",
                )
            )

    await db.commit()
    return CatalogAddProductsResponse(
        created_count=created_count,
        updated_count=updated_count,
        skipped_count=skipped_count,
        items=created,
    )


@router.get("/shops/{shop_id}/selections", response_model=ShopCatalogSelectionListResponse)
async def list_shop_catalog_selections(
    shop_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    await _verify_shop_owner(db, shop_id, current_user.id)

    base_query = (
        select(ShopCatalogSelection, CatalogTemplate)
        .join(CatalogTemplate, CatalogTemplate.id == ShopCatalogSelection.catalog_id)
        .where(
            ShopCatalogSelection.shop_id == shop_id,
            ShopCatalogSelection.is_active == True,
        )
    )

    total = (await db.execute(select(func.count()).select_from(base_query.subquery()))).scalar() or 0
    offset = (page - 1) * per_page
    result = await db.execute(
        base_query
        .order_by(ShopCatalogSelection.selected_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    rows = result.all()

    catalog_ids = [row[1].id for row in rows]
    published_map: dict[UUID, UUID] = {}
    if catalog_ids:
        barcodes = [f"CAT-{catalog_id}" for catalog_id in catalog_ids]
        published_result = await db.execute(
            select(Product.id, Product.barcode)
            .where(
                Product.shop_id == shop_id,
                Product.barcode.in_(barcodes),
            )
        )
        for product_id, barcode in published_result.all():
            try:
                catalog_id_str = str(barcode).replace("CAT-", "", 1)
                published_map[UUID(catalog_id_str)] = product_id
            except Exception:
                continue

    items = []
    for selection, template in rows:
        product_id = published_map.get(template.id)
        items.append(
            ShopCatalogSelectionResponse(
                catalog_id=template.id,
                name=template.name,
                brand=template.brand,
                category=template.category,
                subcategory=template.subcategory,
                thumbnail_url=template.thumbnail_url,
                data_source=template.data_source,
                local_price=selection.local_price,
                compare_price=selection.compare_price,
                local_description=selection.local_description,
                stock_quantity=selection.stock_quantity,
                is_active=selection.is_active,
                is_published=product_id is not None,
                product_id=product_id,
            )
        )

    return ShopCatalogSelectionListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("/shops/{shop_id}/publish-products", response_model=CatalogPublishProductsResponse)
async def publish_selected_catalog_products(
    shop_id: UUID,
    body: CatalogPublishProductsRequest,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    if not body.catalog_ids:
        raise BadRequestError("Select at least one catalog product to publish")

    shop = await _verify_shop_owner(db, shop_id, current_user.id)

    created_count = 0
    updated_count = 0
    skipped_count = 0
    items: list[CatalogPublishResultItem] = []

    for catalog_id in body.catalog_ids:
        selection_result = await db.execute(
            select(ShopCatalogSelection, CatalogTemplate)
            .join(CatalogTemplate, CatalogTemplate.id == ShopCatalogSelection.catalog_id)
            .where(
                ShopCatalogSelection.shop_id == shop_id,
                ShopCatalogSelection.catalog_id == catalog_id,
                ShopCatalogSelection.is_active == True,
            )
        )
        row = selection_result.first()
        if not row:
            skipped_count += 1
            items.append(
                CatalogPublishResultItem(
                    catalog_id=catalog_id,
                    name="Unknown catalog item",
                    status="skipped",
                    message="Selection not found. Add it to selections first",
                )
            )
            continue

        selection, template = row
        barcode = f"CAT-{template.id}"

        existing_result = await db.execute(
            select(Product).where(
                Product.shop_id == shop_id,
                Product.barcode == barcode,
            )
        )
        existing_product = existing_result.scalar_one_or_none()

        price_value = selection.local_price if selection.local_price is not None else (template.base_price_inr or Decimal("0"))
        compare_price = selection.compare_price if selection.compare_price is not None else template.compare_price_inr

        if existing_product:
            existing_product.price = price_value
            existing_product.compare_price = compare_price
            if selection.local_description is not None:
                existing_product.description = selection.local_description
            existing_product.stock_quantity = selection.stock_quantity
            existing_product.attributes = {
                **(existing_product.attributes or {}),
                "catalog_id": str(template.id),
                "catalog_source": template.data_source,
                "catalog_source_url": template.source_url,
                "catalog_source_id": template.source_id,
            }
            items.append(
                CatalogPublishResultItem(
                    catalog_id=template.id,
                    product_id=existing_product.id,
                    name=template.name,
                    status="updated",
                    message="Published product updated from selection",
                )
            )
            updated_count += 1
            continue

        product = Product(
            shop_id=shop_id,
            name=template.name,
            description=selection.local_description or template.description or template.short_description,
            price=price_value,
            compare_price=compare_price,
            category=template.category,
            subcategory=template.subcategory,
            attributes={
                **(template.attributes or {}),
                "catalog_id": str(template.id),
                "catalog_source": template.data_source,
                "catalog_source_url": template.source_url,
                "catalog_source_id": template.source_id,
            },
            tags=[tag for tag in [template.brand, template.category, template.subcategory] if tag],
            images=template.image_urls or ([template.thumbnail_url] if template.thumbnail_url else []),
            is_featured=False,
            is_available=False,
            barcode=barcode,
            stock_quantity=selection.stock_quantity,
            ai_generated=False,
        )
        db.add(product)
        shop.total_products = (shop.total_products or 0) + 1
        await db.flush()
        await db.refresh(product)
        items.append(
            CatalogPublishResultItem(
                catalog_id=template.id,
                product_id=product.id,
                name=template.name,
                status="created",
                message="Published to your shop catalog as hidden",
            )
        )
        created_count += 1

    await db.commit()
    return CatalogPublishProductsResponse(
        created_count=created_count,
        updated_count=updated_count,
        skipped_count=skipped_count,
        items=items,
    )


@router.post("/shops/{shop_id}/enable-products", response_model=CatalogEnableProductsResponse)
async def enable_catalog_products(
    shop_id: UUID,
    body: CatalogEnableProductsRequest,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Batch enable (make live) previously hidden catalog products."""
    if not body.product_ids:
        raise BadRequestError("Select at least one product to enable")

    shop = await _verify_shop_owner(db, shop_id, current_user.id)

    enabled_count = 0
    already_enabled_count = 0
    not_found_count = 0

    for product_id in body.product_ids:
        product_result = await db.execute(
            select(Product).where(
                Product.id == product_id,
                Product.shop_id == shop_id,
            )
        )
        product = product_result.scalar_one_or_none()
        
        if not product:
            not_found_count += 1
            continue

        if product.is_available:
            already_enabled_count += 1
            continue

        product.is_available = True
        enabled_count += 1

    await db.commit()
    
    return CatalogEnableProductsResponse(
        enabled_count=enabled_count,
        already_enabled_count=already_enabled_count,
        not_found_count=not_found_count,
        message=f"Enabled {enabled_count} products, {already_enabled_count} already live, {not_found_count} not found",
    )
