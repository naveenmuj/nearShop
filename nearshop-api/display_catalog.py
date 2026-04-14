#!/usr/bin/env python3
"""
Display sample catalog data from the database.
"""

import asyncio
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.config import Settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

settings = Settings()


async def display_catalog():
    """Display sample products from each category."""
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Get stats
            stats_result = await session.execute(
                text("""
                    SELECT category, COUNT(*) as count, 
                           ROUND(AVG(base_price_inr)::numeric, 2) as avg_price,
                           MAX(base_price_inr) as max_price,
                           MIN(base_price_inr) as min_price
                    FROM catalog_templates 
                    GROUP BY category 
                    ORDER BY category
                """)
            )
            
            print("\n" + "="*80)
            print("📊 NEARSHOP PRODUCT CATALOG - SUMMARY")
            print("="*80)
            
            total_products = 0
            for cat, count, avg_price, max_price, min_price in stats_result:
                total_products += count
                print(f"\n📦 {cat}")
                print(f"   Products: {count}")
                print(f"   Price Range: ₹{min_price:,.0f} - ₹{max_price:,.0f}")
                print(f"   Average Price: ₹{avg_price:,.0f}")
            
            print(f"\n{'='*80}")
            print(f"Total Products Available: {total_products}")
            print(f"{'='*80}\n")
            
            # Show sample products from each category
            print("🛍️  SAMPLE PRODUCTS BY CATEGORY\n")
            
            categories = ["Groceries", "Electronics", "Clothing", "Home & Kitchen"]
            
            for cat in categories:
                print(f"\n{'─'*80}")
                print(f"📁 {cat}")
                print(f"{'─'*80}")
                
                result = await session.execute(
                    text(f"""
                        SELECT 
                            name, 
                            brand, 
                            base_price_inr, 
                            compare_price_inr,
                            avg_rating,
                            num_reviews,
                            ROUND((1 - base_price_inr/compare_price_inr) * 100)::int as discount_pct
                        FROM catalog_templates 
                        WHERE category = :category
                        ORDER BY base_price_inr ASC
                        LIMIT 5
                    """),
                    {"category": cat}
                )
                
                products = result.fetchall()
                for i, (name, brand, price, compare, rating, reviews, discount) in enumerate(products, 1):
                    print(f"\n  {i}. {name}")
                    print(f"     Brand: {brand}")
                    print(f"     Price: ₹{price:,.0f} (was ₹{compare:,.0f}) | Discount: {discount}%")
                    if rating:
                        print(f"     Rating: ⭐ {rating}/5.0 ({reviews} reviews)")
            
            print(f"\n{'='*80}\n")
            
        except Exception as e:
            logger.error(f"Error: {e}", exc_info=True)
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(display_catalog())
