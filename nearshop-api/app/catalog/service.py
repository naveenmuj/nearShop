"""Catalog data service for database operations."""

import logging
from typing import List, Dict, Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from app.catalog.models import CatalogTemplate, ShopCatalogSelection
from app.core.exceptions import NotFoundError, BadRequestError

logger = logging.getLogger(__name__)


class CatalogDataNormalizer:
    """Normalize and deduplicate product data from multiple sources."""
    
    @staticmethod
    def normalize(raw_product: Dict) -> Dict:
        """
        Normalize raw product data to standard schema.
        
        Args:
            raw_product: Raw product dict from scraper
        
        Returns:
            Normalized product dict
        """
        normalized = {
            'sku': CatalogDataNormalizer._generate_sku(
                raw_product.get('name'),
                raw_product.get('brand'),
                raw_product.get('category')
            ),
            'name': (raw_product.get('name') or '').strip()[:300],
            'brand': (raw_product.get('brand') or 'Generic').strip()[:150],
            'category': (raw_product.get('category') or 'Miscellaneous').strip()[:100],
            'subcategory': (raw_product.get('subcategory') or '').strip()[:100] or None,
            'description': (raw_product.get('description') or '').strip() or None,
            'short_description': (raw_product.get('short_description') or '')[:300],
            'image_urls': CatalogDataNormalizer._normalize_images(raw_product.get('image_urls') or raw_product.get('thumbnail_url')),
            'thumbnail_url': (raw_product.get('thumbnail_url') or '').strip()[:500] or None,
            'attributes': raw_product.get('attributes') or {},
            'variants': raw_product.get('variants') or {},
            'data_source': (raw_product.get('data_source') or '').lower(),
            'source_url': (raw_product.get('source_url') or '').strip()[:500] or None,
            'source_id': (raw_product.get('source_id') or '').strip()[:100] or None,
            'confidence_score': float(raw_product.get('confidence_score', 0.85)),
            'base_price_inr': float(raw_product.get('price', 0)) if raw_product.get('price') else None,
            'compare_price_inr': float(raw_product.get('compare_price', 0)) if raw_product.get('compare_price') else None,
            'avg_rating': float(raw_product.get('avg_rating', 0)) if raw_product.get('avg_rating') else None,
            'num_reviews': int(raw_product.get('num_reviews', 0)) or 0,
            'is_active': True,
            'is_verified': False,
        }
        
        return normalized
    
    @staticmethod
    def _generate_sku(name: str, brand: str, category: str) -> str:
        """Generate unique SKU from product attributes."""
        import re
        
        # Clean and combine components
        name_part = re.sub(r'[^a-z0-9]', '', name.lower())[:20] if name else 'product'
        brand_part = re.sub(r'[^a-z0-9]', '', (brand or '').lower())[:10]
        cat_part = re.sub(r'[^a-z0-9]', '', (category or '').lower())[:10]
        
        sku = f"{cat_part}-{brand_part}-{name_part}".replace('--', '-').strip('-')
        return sku[:100]
    
    @staticmethod
    def _normalize_images(images) -> Optional[List[str]]:
        """Normalize image URLs."""
        if not images:
            return None
        
        if isinstance(images, str):
            images = [images]
        
        # Filter valid URLs
        valid_urls = [
            url.strip() for url in images 
            if isinstance(url, str) and url.strip().startswith('http')
        ]
        
        # Remove duplicates while preserving order
        unique_urls = []
        seen = set()
        for url in valid_urls[:10]:  # Max 10 images
            if url not in seen:
                unique_urls.append(url)
                seen.add(url)
        
        return unique_urls if unique_urls else None
    
    @staticmethod
    def _calculate_discount(base_price: float, compare_price: float) -> Optional[float]:
        """Calculate discount percentage."""
        if not base_price or not compare_price or compare_price <= base_price:
            return None
        
        discount = ((compare_price - base_price) / compare_price) * 100
        return round(discount, 2) if discount > 0 else None


class CatalogService:
    """Service for catalog database operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def upsert_products(
        self, 
        products: List[Dict],
        replace_existing: bool = False
    ) -> Dict:
        """
        Insert or update products in catalog.
        
        Args:
            products: List of normalized product dicts
            replace_existing: If True, replace existing products with same SKU
        
        Returns:
            Stats: {inserted: N, updated: M, duplicates: K, errors: L}
        """
        stats = {'inserted': 0, 'updated': 0, 'duplicates': 0, 'errors': 0}
        
        for product in products:
            try:
                # Check if product exists
                existing = await self.db.execute(
                    select(CatalogTemplate).where(
                        CatalogTemplate.sku == product['sku']
                    )
                )
                existing_product = existing.scalar_one_or_none()
                
                if existing_product and not replace_existing:
                    # Update popularity score
                    existing_product.popularity_score = (existing_product.popularity_score or 0) + 1
                    existing_product.last_scraped_at = datetime.utcnow()
                    stats['duplicates'] += 1
                    continue
                
                if existing_product and replace_existing:
                    # Delete and re-insert
                    await self.db.delete(existing_product)
                    stats['updated'] += 1
                
                # Insert new product
                new_product = CatalogTemplate(**product)
                self.db.add(new_product)
                stats['inserted'] += 1
            
            except Exception as e:
                logger.error(f"Error upserting product {product.get('sku', '')}: {e}")
                stats['errors'] += 1
                continue
        
        await self.db.flush()
        logger.info(f"Upsert complete: {stats}")
        return stats
    
    async def search_catalog(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[CatalogTemplate]:
        """Search catalog with filters."""
        q = select(CatalogTemplate).where(CatalogTemplate.is_active == True)
        
        if query:
            q = q.where(
                (CatalogTemplate.name.ilike(f"%{query}%")) |
                (CatalogTemplate.description.ilike(f"%{query}%"))
            )
        
        if category:
            q = q.where(CatalogTemplate.category == category)
        
        if brand:
            q = q.where(CatalogTemplate.brand == brand)
        
        if min_price is not None:
            q = q.where(CatalogTemplate.base_price_inr >= min_price)
        
        if max_price is not None:
            q = q.where(CatalogTemplate.base_price_inr <= max_price)
        
        # Order by popularity
        q = q.order_by(CatalogTemplate.popularity_score.desc())
        q = q.limit(limit).offset(offset)
        
        result = await self.db.execute(q)
        return result.scalars().all()
    
    async def get_by_id(self, catalog_id: UUID) -> Optional[CatalogTemplate]:
        """Get catalog product by ID."""
        result = await self.db.execute(
            select(CatalogTemplate).where(CatalogTemplate.id == catalog_id)
        )
        return result.scalar_one_or_none()
    
    async def get_categories(self) -> List[str]:
        """Get list of all categories."""
        result = await self.db.execute(
            select(CatalogTemplate.category)
            .where(CatalogTemplate.is_active == True)
            .distinct()
        )
        return result.scalars().all()
    
    async def get_brands(self, category: Optional[str] = None) -> List[str]:
        """Get list of brands, optionally filtered by category."""
        q = select(CatalogTemplate.brand).where(CatalogTemplate.is_active == True)
        
        if category:
            q = q.where(CatalogTemplate.category == category)
        
        q = q.distinct().limit(100)
        result = await self.db.execute(q)
        return [b for b in result.scalars().all() if b]
    
    async def add_to_shop(
        self,
        shop_id: UUID,
        catalog_id: UUID,
        local_price: float,
        stock_quantity: Optional[int] = None,
        compare_price: Optional[float] = None,
        local_description: Optional[str] = None
    ) -> ShopCatalogSelection:
        """Add a catalog product to a shop's inventory."""
        
        # Verify catalog exists
        catalog = await self.get_by_id(catalog_id)
        if not catalog:
            raise NotFoundError("Product not found in catalog")
        
        # Check if already added
        existing = await self.db.execute(
            select(ShopCatalogSelection).where(
                (ShopCatalogSelection.shop_id == shop_id) &
                (ShopCatalogSelection.catalog_id == catalog_id)
            )
        )
        existing_selection = existing.scalar_one_or_none()
        
        if existing_selection:
            # Update existing
            existing_selection.local_price = local_price
            existing_selection.compare_price = compare_price
            existing_selection.local_description = local_description
            existing_selection.stock_quantity = stock_quantity
            existing_selection.is_active = True
            await self.db.flush()
            await self.db.refresh(existing_selection)
            return existing_selection
        
        # Create new selection
        selection = ShopCatalogSelection(
            shop_id=shop_id,
            catalog_id=catalog_id,
            local_price=local_price,
            compare_price=compare_price,
            local_description=local_description,
            stock_quantity=stock_quantity,
            is_active=True
        )
        self.db.add(selection)
        
        # Increment catalog popularity
        catalog.num_shops_using = (catalog.num_shops_using or 0) + 1
        
        await self.db.flush()
        await self.db.refresh(selection)
        return selection
    
    async def get_shop_catalog(self, shop_id: UUID, limit: int = 100) -> List[CatalogTemplate]:
        """Get all catalog products a shop has selected."""
        result = await self.db.execute(
            select(CatalogTemplate)
            .join(ShopCatalogSelection)
            .where(
                (ShopCatalogSelection.shop_id == shop_id) &
                (ShopCatalogSelection.is_active == True)
            )
            .limit(limit)
        )
        return result.scalars().all()
