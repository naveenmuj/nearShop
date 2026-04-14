"""Test script to verify scrapers are working before full population."""

import asyncio
import os
import logging

from app.catalog.scrapers import (
    FlipkartScraper, AmazonScraper, JioMartScraper, BigBasketScraper
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_flipkart():
    """Test Flipkart scraper."""
    token = os.getenv('FLIPKART_AFFILIATE_TOKEN')
    if not token:
        logger.warning("⏭️  Skipping Flipkart test (no API token)")
        return
    
    logger.info("\n📱 Testing Flipkart Scraper...")
    try:
        async with FlipkartScraper(token) as scraper:
            products = await scraper.search("smartphone", limit=10)
            logger.info(f"✅ Flipkart: Found {len(products)} products")
            if products:
                logger.info(f"   Sample: {products[0]['name']}")
    except Exception as e:
        logger.error(f"❌ Flipkart test failed: {e}")


async def test_amazon():
    """Test Amazon scraper."""
    key = os.getenv('AMAZON_RAPIDAPI_KEY')
    if not key:
        logger.warning("⏭️  Skipping Amazon test (no API key)")
        return
    
    logger.info("\n📦 Testing Amazon Scraper...")
    try:
        scraper = AmazonScraper(key)
        products = await scraper.search("smartphone", limit=10)
        logger.info(f"✅ Amazon: Found {len(products)} products")
        if products:
            logger.info(f"   Sample: {products[0]['name']}")
    except Exception as e:
        logger.error(f"❌ Amazon test failed: {e}")


async def test_jiomart():
    """Test JioMart scraper."""
    logger.info("\n🛒 Testing JioMart Scraper...")
    try:
        async with JioMartScraper() as scraper:
            products = await scraper.search_category('groceries', limit=10)
            logger.info(f"✅ JioMart: Found {len(products)} products")
            if products:
                logger.info(f"   Sample: {products[0]['name']}")
    except Exception as e:
        logger.error(f"❌ JioMart test failed: {e}")


async def test_bigbasket():
    """Test BigBasket scraper."""
    logger.info("\n🥬 Testing BigBasket Scraper...")
    try:
        async with BigBasketScraper() as scraper:
            products = await scraper.search_category('vegetables', limit=10)
            logger.info(f"✅ BigBasket: Found {len(products)} products")
            if products:
                logger.info(f"   Sample: {products[0]['name']}")
    except Exception as e:
        logger.error(f"❌ BigBasket test failed: {e}")


async def main():
    """Run all scraper tests."""
    logger.info("=" * 60)
    logger.info("🧪 Scraper Tests")
    logger.info("=" * 60)
    
    await test_flipkart()
    await test_amazon()
    await test_jiomart()
    await test_bigbasket()
    
    logger.info("\n" + "=" * 60)
    logger.info("✅ All tests completed!")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
