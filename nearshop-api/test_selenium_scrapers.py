#!/usr/bin/env python3
"""
Test Selenium-based scrapers for real product data.
This script tests if we can actually scrape products from JioMart and BigBasket.
"""

import asyncio
import logging
import time
from app.catalog.selenium_scrapers import AsyncJioMartScraper, AsyncBigBasketScraper

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_jiomart():
    """Test JioMart scraper."""
    print("\n" + "="*80)
    print("🛒 Testing JioMart Selenium Scraper")
    print("="*80)
    
    scraper = AsyncJioMartScraper()
    
    try:
        categories_to_test = ['groceries', 'snacks']
        total_products = 0
        
        for category in categories_to_test:
            logger.info(f"\nTesting category: {category}")
            products = await scraper.search_category(category, limit=10)
            total_products += len(products)
            
            if products:
                logger.info(f"✅ Found {len(products)} products!")
                for i, product in enumerate(products[:3], 1):
                    logger.info(f"   {i}. {product['name']} - ₹{product['price']}")
            else:
                logger.warning(f"⚠️ No products found for {category}")
            
            time.sleep(2)  # Be polite to server
        
        logger.info(f"\n✅ JioMart Total: {total_products} products found")
        return total_products > 0
        
    except Exception as e:
        logger.error(f"❌ JioMart test failed: {e}")
        return False
    finally:
        await scraper.close()


async def test_bigbasket():
    """Test BigBasket scraper."""
    print("\n" + "="*80)
    print("🥬 Testing BigBasket Selenium Scraper")
    print("="*80)
    
    scraper = AsyncBigBasketScraper()
    
    try:
        categories_to_test = ['vegetables', 'fruits']
        total_products = 0
        
        for category in categories_to_test:
            logger.info(f"\nTesting category: {category}")
            products = await scraper.search_category(category, limit=10)
            total_products += len(products)
            
            if products:
                logger.info(f"✅ Found {len(products)} products!")
                for i, product in enumerate(products[:3], 1):
                    logger.info(f"   {i}. {product['name']} - ₹{product['price']}")
            else:
                logger.warning(f"⚠️ No products found for {category}")
            
            time.sleep(2)  # Be polite to server
        
        logger.info(f"\n✅ BigBasket Total: {total_products} products found")
        return total_products > 0
        
    except Exception as e:
        logger.error(f"❌ BigBasket test failed: {e}")
        return False
    finally:
        await scraper.close()


async def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("🧪 SELENIUM-BASED SCRAPER TESTS")
    print("Testing real product extraction from Indian e-commerce sites")
    print("="*80)
    
    start = time.time()
    
    jiomart_ok = await test_jiomart()
    bigbasket_ok = await test_bigbasket()
    
    elapsed = time.time() - start
    
    # Results
    print("\n" + "="*80)
    print("📊 TEST RESULTS")
    print("="*80)
    print(f"JioMart:   {'✅ PASSED' if jiomart_ok else '❌ FAILED'}")
    print(f"BigBasket: {'✅ PASSED' if bigbasket_ok else '❌ FAILED'}")
    print(f"Time taken: {elapsed:.1f} seconds")
    
    if jiomart_ok or bigbasket_ok:
        print("\n✨ SUCCESS! At least one scraper is working.")
        print("Run: python populate_from_stores.py to import real products into database")
    else:
        print("\n⚠️  No scrapers working. Check logs above for details.")
    
    print("="*80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
