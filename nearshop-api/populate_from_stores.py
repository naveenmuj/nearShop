
#!/usr/bin/env python3
"""
Standalone catalog population system using direct database connection.
"""

import asyncio
import logging
from typing import List, Dict, Optional
from pathlib import Path
from datetime import datetime

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import sqlalchemy as sa
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)



def get_database_url() -> str:
    """Get database URL from environment or use default."""
    return os.getenv(
        'DATABASE_URL',
        os.getenv('DB_URL', 'postgresql+asyncpg://postgres:example@localhost/nearshop')
    )

class CatalogPopulator:
    """Populate catalog with real product data."""
    
    def __init__(self):
        self.engine = None
        self.session_maker = None
    
    async def connect(self):
        """Connect to database."""
        logger.info(f"Connecting to database...")
        
        # Create async engine
        self.engine = create_async_engine(
            get_database_url(),
            echo=False,
            future=True,
            pool_size=5,
            max_overflow=10
        )
        
        # Create session factory
        self.session_maker = sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            future=True
        )
        
        # Test connection
        async with self.engine.begin() as conn:
            result = await conn.execute(sa.text("SELECT 1"))
            logger.info("✅ Database connection successful")
    
    async def add_product(self, session: AsyncSession, product: Dict) -> bool:
        """Add product to catalog."""
        try:
            # Insert into catalog_templates table
            query = sa.text("""
                INSERT INTO catalog_templates (
                    sku, name, brand, category, base_price_inr, compare_price_inr,
                    description, thumbnail_url, source_url, source_id,
                    data_source, avg_rating, num_reviews, confidence_score,
                    popularity_score, is_active, is_verified, created_at, updated_at
                ) VALUES (
                    :sku, :name, :brand, :category, :base_price_inr, :compare_price_inr,
                    :description, :thumbnail_url, :source_url, :source_id,
                    :data_source, :avg_rating, :num_reviews, :confidence_score,
                    :popularity_score, :is_active, :is_verified, :created_at, :updated_at
                )
                ON CONFLICT (sku) DO NOTHING
            """)
            
            now = datetime.utcnow()
            
            await session.execute(query, {
                'sku': product.get('sku', '').lower().replace(' ', '-'),
                'name': product.get('name', ''),
                'brand': product.get('brand', 'Generic'),
                'category': product.get('category', 'Other'),
                'base_price_inr': float(product.get('price', 0)),
                'compare_price_inr': float(product.get('compare_price')) if product.get('compare_price') else None,
                'description': product.get('description', product.get('name', '')),
                'thumbnail_url': product.get('thumbnail_url'),
                'source_url': product.get('source_url'),
                'source_id': product.get('source_id'),
                'data_source': product.get('data_source', 'manual'),
                'avg_rating': float(product.get('avg_rating')) if product.get('avg_rating') else None,
                'num_reviews': int(product.get('num_reviews', 0)),
                'confidence_score': float(product.get('confidence_score', 0.8)),
                'popularity_score': 0.5,
                'is_active': True,
                'is_verified': True,
                'created_at': now,
                'updated_at': now,
            })
            
            return True
        except Exception as e:
            logger.warning(f"Error adding product {product.get('name')}: {e}")
            return False
    
    async def import_test_data(self) -> int:
        """Import comprehensive test data."""
        
        products = [
            # Groceries
            {'sku': 'basmati-rice-1kg', 'name': 'Basmati Rice 1kg', 'brand': 'India Gate', 'category': 'Groceries', 'price': 145, 'compare_price': 160, 'description': 'Premium basmati rice, long grain', 'avg_rating': 4.5, 'num_reviews': 450},
            {'sku': 'wheat-flour-2kg', 'name': 'Wheat Flour 2kg', 'brand': 'Aatta King', 'category': 'Groceries', 'price': 95, 'compare_price': 110, 'description': 'Whole wheat flour, high protein'},
            {'sku': 'mustard-oil-1L', 'name': 'Mustard Oil 1L', 'brand': 'Fortune', 'category': 'Groceries', 'price': 185, 'compare_price': 210, 'description': 'Pure vegetable mustard oil'},
            {'sku': 'sugar-1kg', 'name': 'Sugar 1kg', 'brand': 'Doomed', 'category': 'Groceries', 'price': 45, 'compare_price': 50, 'description': 'White granulated sugar'},
            {'sku': 'salt-1kg', 'name': 'Salt 1kg', 'brand': 'Tata', 'category': 'Groceries', 'price': 25, 'compare_price': 30, 'description': 'Iodized table salt'},
            {'sku': 'dal-masoor-500g', 'name': 'Red Lentils 500g', 'brand': 'Tata', 'category': 'Groceries', 'price': 65, 'compare_price': 75, 'description': 'Premium masoor dal'},
            {'sku': 'chickpea-1kg', 'name': 'Chickpea 1kg', 'brand': 'Perfect', 'category': 'Groceries', 'price': 85, 'compare_price': 100, 'description': 'White chickpea, chana'},
            {'sku': 'turmeric-powder-100g', 'name': 'Turmeric Powder 100g', 'brand': 'Everest', 'category': 'Groceries', 'price': 120, 'compare_price': 140, 'description': 'Pure turmeric powder'},
            
            # Fresh Produce
            {'sku': 'onion-1kg', 'name': 'Onion 1kg', 'brand': 'Local Fresh', 'category': 'Fresh Produce', 'price': 35, 'compare_price': 45, 'description': 'Fresh red onions, locally grown'},
            {'sku': 'tomato-1kg', 'name': 'Tomato 1kg', 'brand': 'Local Fresh', 'category': 'Fresh Produce', 'price': 45, 'compare_price': 55, 'description': 'Fresh red tomatoes, juicy'},
            {'sku': 'carrot-500g', 'name': 'Carrot 500g', 'brand': 'Local Fresh', 'category': 'Fresh Produce', 'price': 40, 'compare_price': 50, 'description': 'Fresh orange carrots'},
            {'sku': 'banana-1kg', 'name': 'Banana 1kg', 'brand': 'Local Fresh', 'category': 'Fresh Produce', 'price': 55, 'compare_price': 65, 'description': 'Fresh yellow bananas'},
            {'sku': 'apple-1kg', 'name': 'Apple 1kg', 'brand': 'Local Fresh', 'category': 'Fresh Produce', 'price': 150, 'compare_price': 180, 'description': 'Fresh red apples'},
            {'sku': 'potato-1kg', 'name': 'Potato 1kg', 'brand': 'Local Fresh', 'category': 'Fresh Produce', 'price': 30, 'compare_price': 40, 'description': 'Fresh potatoes'},
            
            # Snacks
            {'sku': 'lays-chips-40g', 'name': 'Lay\'s Chips 40g', 'brand': 'Lay\'s', 'category': 'Snacks', 'price': 10, 'compare_price': 15, 'description': 'Salted potato chips'},
            {'sku': 'doritos-40g', 'name': 'Doritos 40g', 'brand': 'Doritos', 'category': 'Snacks', 'price': 20, 'compare_price': 25, 'description': 'Nacho cheese flavored chips'},
            {'sku': 'biscuits-marie-500g', 'name': 'Marie Biscuits 500g', 'brand': 'Parle', 'category': 'Snacks', 'price': 55, 'compare_price': 70, 'description': 'Plain digestive biscuits'},
            {'sku': 'popcorn-100g', 'name': 'Popcorn 100g', 'brand': 'Act II', 'category': 'Snacks', 'price': 85, 'compare_price': 100, 'description': 'Buttered microwave popcorn'},
            {'sku': 'wafers-250g', 'name': 'Wafers 250g', 'brand': 'Sunfeast', 'category': 'Snacks', 'price': 45, 'compare_price': 60, 'description': 'Light cream wafer cookies'},
            
            # Beverages
            {'sku': 'tea-100bags', 'name': 'Tea Bags 100pc', 'brand': 'Taj Mahal', 'category': 'Beverages', 'price': 180, 'compare_price': 210, 'description': 'Black tea bags, assam blend'},
            {'sku': 'coffee-powder-200g', 'name': 'Coffee Powder 200g', 'brand': 'Bru', 'category': 'Beverages', 'price': 160, 'compare_price': 190, 'description': 'Instant coffee powder'},
            {'sku': 'milk-powder-1kg', 'name': 'Milk Powder 1kg', 'brand': 'Nido', 'category': 'Beverages', 'price': 320, 'compare_price': 380, 'description': 'Fortified milk powder'},
        ]
        
        async with self.session_maker() as session:
            inserted = 0
            
            for i, product in enumerate(products, 1):
                product['data_source'] = 'store_test'
                product['confidence_score'] = 0.92
                
                if await self.add_product(session, product):
                    inserted += 1
                
                if i % 10 == 0:
                    logger.info(f"  Processing {i}/{len(products)}...")
            
            # Commit transaction
            await session.commit()
        
        logger.info(f"✅ Successfully added {inserted} products to database")
        return inserted
    
    async def verify_insertion(self) -> int:
        """Verify products are in database."""
        async with self.session_maker() as session:
            result = await session.execute(
                sa.text("SELECT COUNT(*) as count FROM catalog_templates")
            )
            count = result.scalar()
            logger.info(f"📊 Total products in database: {count}")
            
            # Show sample
            result = await session.execute(
                sa.text("""
                    SELECT name, category, base_price_inr 
                    FROM catalog_templates 
                    ORDER BY created_at DESC 
                    LIMIT 5
                """)
            )
            
            logger.info("\n📦 Latest products added:")
            for row in result:
                logger.info(f"   • {row[0]} ({row[1]}) - ₹{int(row[2])}")
            
            return count
    
    async def disconnect(self):
        """Disconnect from database."""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database connection closed")


async def main():
    """Main execution."""
    print("\n" + "="*80)
    print("🏪 CATALOG POPULATION SYSTEM")
    print("="*80)
    
    populator = CatalogPopulator()
    
    try:
        # Connect to database
        await populator.connect()
        
        # Load test data
        print("\n📥 Loading product data...")
        count = await populator.import_test_data()
        
        # Verify
        print("\n🔍 Verifying insertion...")
        total = await populator.verify_insertion()
        
        print("\n" + "="*80)
        print(f"✅ SUCCESS! {count} new products added ({total} total in database)")
        print("="*80)
        
        print("\n📚 Next steps:")
        print("  1. Review all products: python display_catalog.py")
        print("  2. Connect to mobile app to browse catalog")
        print("  3. Add supplier-provided products via CSV")
        print("  4. Setup Flipkart affiliate API for automatic updates")
        
        print("\n" + "="*80 + "\n")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await populator.disconnect()


if __name__ == '__main__':
    asyncio.run(main())
