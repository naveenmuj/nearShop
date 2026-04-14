"""Main orchestration script to scrape and populate catalog."""

import asyncio
import logging
import json
from datetime import datetime
from typing import List, Dict

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.catalog.scrapers import (
    FlipkartScraper, AmazonScraper, JioMartScraper, 
    BigBasketScraper, DataSource
)
from app.catalog.service import CatalogService, CatalogDataNormalizer

logger = logging.getLogger(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class CatalogPopulator:
    """Main class to orchestrate catalog population."""
    
    def __init__(
        self,
        database_url: str,
        flipkart_token: str = None,
        amazon_rapidapi_key: str = None
    ):
        self.database_url = database_url
        self.flipkart_token = flipkart_token
        self.amazon_rapidapi_key = amazon_rapidapi_key
        self.engine = None
        self.session_maker = None
    
    async def __aenter__(self):
        self.engine = create_async_engine(self.database_url, echo=False)
        self.session_maker = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.engine:
            await self.engine.dispose()
    
    async def populate_all(self, full_sync: bool = False) -> Dict:
        """
        Populate catalog from all sources.
        
        Args:
            full_sync: If True, replace all existing data. If False, merge/update.
        
        Returns:
            Summary of results
        """
        results = {
            'flipkart': {'products': [], 'stats': {}},
            'amazon': {'products': [], 'stats': {}},
            'jiomart': {'products': [], 'stats': {}, 'categories': {}},
            'bigbasket': {'products': [], 'stats': {}, 'categories': {}},
            'total_stats': {'inserted': 0, 'updated': 0, 'duplicates': 0, 'errors': 0}
        }

        flipkart_products: List[Dict] = []
        amazon_products: List[Dict] = []
        jiomart_products: List[Dict] = []
        bigbasket_products: List[Dict] = []
        
        logger.info("=" * 80)
        logger.info("Starting Catalog Population")
        logger.info("=" * 80)
        
        # Scrape from Flipkart
        if self.flipkart_token:
            logger.info("\n📱 Scraping Flipkart...")
            flipkart_products = await self._scrape_flipkart()
            results['flipkart']['products'] = flipkart_products
            logger.info(f"✅ Flipkart: {len(flipkart_products)} products")
        
        # Scrape from Amazon
        if self.amazon_rapidapi_key:
            logger.info("\n📦 Scraping Amazon...")
            amazon_products = await self._scrape_amazon()
            results['amazon']['products'] = amazon_products
            logger.info(f"✅ Amazon: {len(amazon_products)} products")
        
        # Scrape from JioMart
        logger.info("\n🛒 Scraping JioMart...")
        jiomart_products, jiomart_category_stats = await self._scrape_jiomart()
        results['jiomart']['products'] = jiomart_products
        results['jiomart']['categories'] = jiomart_category_stats
        logger.info(f"✅ JioMart: {len(jiomart_products)} products")
        
        # Scrape from BigBasket
        logger.info("\n🥬 Scraping BigBasket...")
        bigbasket_products, bigbasket_category_stats = await self._scrape_bigbasket()
        results['bigbasket']['products'] = bigbasket_products
        results['bigbasket']['categories'] = bigbasket_category_stats
        logger.info(f"✅ BigBasket: {len(bigbasket_products)} products")
        
        # Combine and deduplicate
        all_products = (
            flipkart_products + 
            amazon_products + 
            jiomart_products + 
            bigbasket_products
        )
        
        logger.info(f"\n📊 Total products scraped: {len(all_products)}")
        
        # Normalize data
        logger.info("\n🔄 Normalizing and deduplicating...")
        normalized_products = [
            CatalogDataNormalizer.normalize(p) 
            for p in all_products
        ]
        
        # Remove duplicates by SKU (keep highest confidence)
        dedup_products = self._deduplicate_by_sku(normalized_products)
        logger.info(f"✅ After deduplication: {len(dedup_products)} unique products")
        
        # Save to database
        logger.info("\n💾 Saving to database...")
        async with self.session_maker() as session:
            catalog_service = CatalogService(session)
            db_stats = await catalog_service.upsert_products(
                dedup_products,
                replace_existing=full_sync
            )
            results['total_stats'] = db_stats
            await session.commit()
        
        logger.info("\n" + "=" * 80)
        logger.info(f"✨ Catalog Population Complete!")
        logger.info(f"   Inserted: {db_stats['inserted']}")
        logger.info(f"   Updated: {db_stats['updated']}")
        logger.info(f"   Duplicates: {db_stats['duplicates']}")
        logger.info(f"   Errors: {db_stats['errors']}")
        logger.info("=" * 80 + "\n")
        
        return results
    
    async def _scrape_flipkart(self) -> List[Dict]:
        """Scrape multiple categories from Flipkart."""
        products = []
        queries = [
            'smartphone', 'laptop', 'tablet',
            'electronics', 'gadgets',
            'TShirt', 'jeans', 'saree',
            'shoes'
        ]
        
        try:
            async with FlipkartScraper(self.flipkart_token) as scraper:
                for query in queries:
                    try:
                        page_products = await scraper.search(query, limit=50)
                        products.extend(page_products)
                        await asyncio.sleep(1)  # Rate limiting
                    except Exception as e:
                        logger.error(f"Error scraping Flipkart for '{query}': {e}")
                        continue
        
        except Exception as e:
            logger.error(f"Fatal error in Flipkart scraper: {e}")
        
        return products
    
    async def _scrape_amazon(self) -> List[Dict]:
        """Scrape multiple categories from Amazon."""
        products = []
        queries = [
            'smartphone', 'laptop',
            'electronics', 'gadgets',
            'TShirt', 'jeans',
            'shoes'
        ]
        
        try:
            scraper = AmazonScraper(self.amazon_rapidapi_key)
            for query in queries:
                try:
                    page_products = await scraper.search(query, limit=30)
                    products.extend(page_products)
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Error scraping Amazon for '{query}': {e}")
                    continue
        
        except Exception as e:
            logger.error(f"Fatal error in Amazon scraper: {e}")
        
        return products
    
    async def _scrape_jiomart(self) -> tuple[List[Dict], Dict[str, int]]:
        """Scrape multiple categories from JioMart."""
        products = []
        categories = ['groceries', 'fresh', 'electronics', 'fashion']
        category_stats: Dict[str, int] = {c: 0 for c in categories}
        
        try:
            async with JioMartScraper() as scraper:
                for category in categories:
                    try:
                        cat_products = await scraper.search_category(category, limit=100)
                        products.extend(cat_products)
                        category_stats[category] = len(cat_products)
                        await asyncio.sleep(2)  # Be respectful with rate limiting
                    except Exception as e:
                        logger.error(f"Error scraping JioMart {category}: {e}")
                        category_stats[category] = 0
                        continue
        
        except Exception as e:
            logger.error(f"Fatal error in JioMart scraper: {e}")
        
        return products, category_stats
    
    async def _scrape_bigbasket(self) -> tuple[List[Dict], Dict[str, int]]:
        """Scrape multiple categories from BigBasket."""
        products = []
        categories = ['vegetables', 'fruits', 'dairy', 'pantry']
        category_stats: Dict[str, int] = {c: 0 for c in categories}
        
        try:
            async with BigBasketScraper() as scraper:
                for category in categories:
                    try:
                        cat_products = await scraper.search_category(category, limit=100)
                        products.extend(cat_products)
                        category_stats[category] = len(cat_products)
                        await asyncio.sleep(2)
                    except Exception as e:
                        logger.error(f"Error scraping BigBasket {category}: {e}")
                        category_stats[category] = 0
                        continue
        
        except Exception as e:
            logger.error(f"Fatal error in BigBasket scraper: {e}")
        
        return products, category_stats
    
    @staticmethod
    def _deduplicate_by_sku(products: List[Dict]) -> List[Dict]:
        """
        Remove duplicate SKUs, keeping highest confidence sources.
        
        Preference order: Flipkart > Amazon > JioMart > BigBasket
        """
        source_priority = {
            DataSource.FLIPKART: 4,
            DataSource.AMAZON: 3,
            DataSource.JIOMART: 2,
            DataSource.BIGBASKET: 1,
        }
        
        sku_map = {}
        for product in products:
            sku = product.get('sku')
            if not sku:
                continue
            
            if sku not in sku_map:
                sku_map[sku] = product
            else:
                # Keep product with higher priority source or confidence
                existing = sku_map[sku]
                existing_priority = source_priority.get(existing.get('data_source'), 0)
                new_priority = source_priority.get(product.get('data_source'), 0)
                
                if new_priority > existing_priority:
                    sku_map[sku] = product
                elif new_priority == existing_priority:
                    # Same priority, keep higher confidence
                    if product.get('confidence_score', 0) > existing.get('confidence_score', 0):
                        sku_map[sku] = product
        
        return list(sku_map.values())


async def main():
    """Example usage of CatalogPopulator."""
    
    # Configuration (use environment variables in production)
    DATABASE_URL = "postgresql+asyncpg://user:password@localhost/nearshop"
    FLIPKART_TOKEN = "your_flipkart_affiliate_token"  # Get from Flipkart Affiliate
    AMAZON_RAPIDAPI_KEY = "your_rapidapi_key"  # Get from RapidAPI
    
    try:
        async with CatalogPopulator(
            database_url=DATABASE_URL,
            flipkart_token=FLIPKART_TOKEN,
            amazon_rapidapi_key=AMAZON_RAPIDAPI_KEY
        ) as populator:
            results = await populator.populate_all(full_sync=False)
            
            # Save results to file for analysis
            with open('catalog_population_results.json', 'w') as f:
                json.dump({
                    'timestamp': datetime.now().isoformat(),
                    'stats': {
                        'flipkart_count': len(results['flipkart']['products']),
                        'amazon_count': len(results['amazon']['products']),
                        'jiomart_count': len(results['jiomart']['products']),
                        'bigbasket_count': len(results['bigbasket']['products']),
                        'total_inserted': results['total_stats']['inserted'],
                        'total_updated': results['total_stats']['updated'],
                    }
                }, f, indent=2)
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())
