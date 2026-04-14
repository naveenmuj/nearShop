#!/usr/bin/env python3
"""
Generate demo catalog data using direct SQL inserts to avoid ORM relationship issues.
"""

import asyncio
import logging
from datetime import datetime
from uuid import uuid4
import json
import random
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.config import Settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load settings
settings = Settings()

# Realistic product data for Indian market
DEMO_PRODUCTS = {
    "Groceries": [
        {"name": "Basmati Rice 5kg", "brand": "India Gate", "price": 450, "image": "https://via.placeholder.com/300?text=Basmati+Rice"},
        {"name": "Sunflower Oil 1L", "brand": "Fortune", "price": 180, "image": "https://via.placeholder.com/300?text=Sunflower+Oil"},
        {"name": "Wheat Flour 5kg", "brand": "Aashirvaad", "price": 230, "image": "https://via.placeholder.com/300?text=Wheat+Flour"},
        {"name": "Sugar 1kg", "brand": "Dalmia", "price": 45, "image": "https://via.placeholder.com/300?text=Sugar"},
        {"name": "Salt 1kg", "brand": "Tata", "price": 20, "image": "https://via.placeholder.com/300?text=Salt"},
        {"name": "Black Tea 250g", "brand": "Lipton", "price": 150, "image": "https://via.placeholder.com/300?text=Black+Tea"},
        {"name": "Coffee Powder 100g", "brand": "Nescafe", "price": 120, "image": "https://via.placeholder.com/300?text=Coffee"},
        {"name": "Milk Powder 400g", "brand": "Amul", "price": 180, "image": "https://via.placeholder.com/300?text=Milk+Powder"},
        {"name": "Honey 500ml", "brand": "Dabur", "price": 240, "image": "https://via.placeholder.com/300?text=Honey"},
        {"name": "Peanut Butter 500g", "brand": "Alpino", "price": 280, "image": "https://via.placeholder.com/300?text=Peanut+Butter"},
    ],
    "Electronics": [
        {"name": "USB-C Charging Cable 2m", "brand": "Belkin", "price": 599, "image": "https://via.placeholder.com/300?text=USB-C+Cable"},
        {"name": "Phone Screen Protector", "brand": "Spigen", "price": 299, "image": "https://via.placeholder.com/300?text=Screen+Protector"},
        {"name": "Wireless Earbuds", "brand": "Boat", "price": 1299, "image": "https://via.placeholder.com/300?text=Wireless+Earbuds"},
        {"name": "Phone Case TPU", "brand": "Spigen", "price": 399, "image": "https://via.placeholder.com/300?text=Phone+Case"},
        {"name": "Power Bank 20000mAh", "brand": "Anker", "price": 1699, "image": "https://via.placeholder.com/300?text=Power+Bank"},
        {"name": "LED Desk Lamp", "brand": "Philips", "price": 899, "image": "https://via.placeholder.com/300?text=LED+Lamp"},
        {"name": "USB Hub 4-Port", "brand": "Belkin", "price": 999, "image": "https://via.placeholder.com/300?text=USB+Hub"},
        {"name": "HDMI Cable 2m", "brand": "Boat", "price": 299, "image": "https://via.placeholder.com/300?text=HDMI+Cable"},
        {"name": "Mouse Optical", "brand": "Logitech", "price": 899, "image": "https://via.placeholder.com/300?text=Mouse"},
        {"name": "Keyboard USB", "brand": "Dell", "price": 1499, "image": "https://via.placeholder.com/300?text=Keyboard"},
    ],
    "Clothing": [
        {"name": "Men's Cotton T-Shirt Blue", "brand": "Levi's", "price": 699, "image": "https://via.placeholder.com/300?text=T-Shirt"},
        {"name": "Women's Jeans Dark Blue", "brand": "Tommy Hilfiger", "price": 2999, "image": "https://via.placeholder.com/300?text=Jeans"},
        {"name": "Men's Formal Shirt White", "brand": "Van Heusen", "price": 1499, "image": "https://via.placeholder.com/300?text=Formal+Shirt"},
        {"name": "Women's Pajama Set", "brand": "Clovia", "price": 599, "image": "https://via.placeholder.com/300?text=Pajama+Set"},
        {"name": "Unisex Hoodie Black", "brand": "Nike", "price": 2499, "image": "https://via.placeholder.com/300?text=Hoodie"},
        {"name": "Men's Shorts Sports", "brand": "Adidas", "price": 1999, "image": "https://via.placeholder.com/300?text=Shorts"},
        {"name": "Women's Top Cotton", "brand": "H&M", "price": 799, "image": "https://via.placeholder.com/300?text=Top"},
        {"name": "Sports Socks Pack 6", "brand": "Decathlon", "price": 399, "image": "https://via.placeholder.com/300?text=Socks"},
        {"name": "Leather Belt Brown", "brand": "Hidesign", "price": 1299, "image": "https://via.placeholder.com/300?text=Belt"},
        {"name": "Winter Jacket Waterproof", "brand": "Decathlon", "price": 2999, "image": "https://via.placeholder.com/300?text=Jacket"},
    ],
    "Home & Kitchen": [
        {"name": "Non-Stick Frying Pan 10'", "brand": "Cello", "price": 599, "image": "https://via.placeholder.com/300?text=Frying+Pan"},
        {"name": "Stainless Steel Utensil Set", "brand": "Pigeon", "price": 1299, "image": "https://via.placeholder.com/300?text=Utensil+Set"},
        {"name": "Kitchen Knife Set Stainless", "brand": "Prestige", "price": 999, "image": "https://via.placeholder.com/300?text=Knife+Set"},
        {"name": "Cutting Board Plastic", "brand": "Milton", "price": 299, "image": "https://via.placeholder.com/300?text=Cutting+Board"},
        {"name": "Glass Bottles Set 4-Pack", "brand": "Milton", "price": 599, "image": "https://via.placeholder.com/300?text=Glass+Bottles"},
        {"name": "Plastic Food Containers Set", "brand": "Signoraware", "price": 699, "image": "https://via.placeholder.com/300?text=Food+Containers"},
        {"name": "Stainless Steel Thermos", "brand": "Cello", "price": 599, "image": "https://via.placeholder.com/300?text=Thermos"},
        {"name": "Dish Dryer Rack", "brand": "Prestige", "price": 799, "image": "https://via.placeholder.com/300?text=Dish+Rack"},
        {"name": "Microwave Safe Plates Set", "brand": "Anchor", "price": 899, "image": "https://via.placeholder.com/300?text=Plate+Set"},
        {"name": "Stainless Steel Spoon Set", "brand": "Milton", "price": 449, "image": "https://via.placeholder.com/300?text=Spoon+Set"},
    ],
}


def generate_sku(name: str, brand: str, category: str) -> str:
    """Generate unique SKU from product details."""
    # Format: CATEGORY-BRAND-NAME-RANDOM
    cat_abbr = category[:3].upper()
    brand_abbr = brand.replace(" ", "")[:3].upper()
    name_part = name.split()[0][:3].upper()
    random_suffix = str(uuid4())[:8].upper()
    return f"{cat_abbr}-{brand_abbr}-{name_part}-{random_suffix}"


async def populate_demo_data():
    """Populate database with direct SQL inserts."""
    
    logger.info("="*60)
    logger.info("📦 Generating Demo Catalog Data...")
    logger.info("="*60)
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            total_inserted = 0
            now = datetime.now()
            
            for category, products in DEMO_PRODUCTS.items():
                logger.info(f"\n📁 Category: {category}")
                logger.info(f"   Adding {len(products)} products...")
                
                for product in products:
                    sku = generate_sku(product["name"], product["brand"], category)
                    image_url = f"https://via.placeholder.com/300?text={product['name'].replace(' ', '+')}"
                    
                    # Direct SQL insert - image_urls and attributes need special handling for PostgreSQL
                    insert_sql = text("""
                        INSERT INTO catalog_templates (
                            id, sku, name, brand, category, subcategory,
                            description, image_urls, attributes, variants,
                            data_source, source_id, source_url, confidence_score,
                            base_price_inr, compare_price_inr, avg_rating, num_reviews,
                            popularity_score, num_shops_using, is_active, is_verified,
                            last_scraped_at, created_at, updated_at
                        ) VALUES (
                            :id, :sku, :name, :brand, :category, :subcategory,
                            :description, ARRAY[:image_url], :attributes, :variants,
                            :data_source, :source_id, :source_url, :confidence_score,
                            :base_price_inr, :compare_price_inr, :avg_rating, :num_reviews,
                            :popularity_score, :num_shops_using, :is_active, :is_verified,
                            :last_scraped_at, :created_at, :updated_at
                        )
                    """)
                    
                    base_price = float(product["price"])
                    compare_price = base_price * 1.2
                    
                    await session.execute(insert_sql, {
                        "id": str(uuid4()),
                        "sku": sku,
                        "name": product["name"],
                        "brand": product["brand"],
                        "category": category,
                        "subcategory": "Various",
                        "description": f"{product['name']} from {product['brand']}. High quality product.",
                        "image_url": image_url,  # Single value, will be converted to ARRAY
                        "attributes": json.dumps({"color": "Default", "variant": "Standard"}),
                        "variants": json.dumps([]),
                        "data_source": "demo",
                        "source_id": f"demo-{sku}",
                        "source_url": f"https://demo.nearshop.in/{sku}",
                        "confidence_score": 1.0,
                        "base_price_inr": base_price,
                        "compare_price_inr": compare_price,
                        "avg_rating": 4.5,
                        "num_reviews": random.randint(10, 500),
                        "popularity_score": random.randint(1, 50),
                        "num_shops_using": 0,
                        "is_active": True,
                        "is_verified": True,
                        "last_scraped_at": now,
                        "created_at": now,
                        "updated_at": now,
                    })
                    
                    total_inserted += 1
            
            await session.commit()
            
            logger.info("\n" + "="*60)
            logger.info(f"✅ Successfully inserted {total_inserted} demo products!")
            logger.info("="*60)
            
            # Verify with SELECT
            result = await session.execute(text("SELECT COUNT(*) FROM catalog_templates"))
            total_count = result.scalar()
            
            logger.info(f"\n📊 Database Summary:")
            logger.info(f"   Total products: {total_count}")
            
            # Group by category
            cat_result = await session.execute(
                text("SELECT category, COUNT(*) FROM catalog_templates GROUP BY category ORDER BY category")
            )
            
            for cat, count in cat_result:
                logger.info(f"   - {cat}: {count} products")
            
            logger.info("\n✨ Demo catalog is ready!")
            logger.info("Products are now available for shop owners to browse and select!")
            
        except Exception as e:
            logger.error(f"Error populating demo data: {e}", exc_info=True)
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(populate_demo_data())
