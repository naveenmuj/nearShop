#!/usr/bin/env python
"""
Quick-start script to populate catalog from e-commerce sources.

Usage:
    python populate_catalog.py
    python populate_catalog.py --full-sync
    python populate_catalog.py --flipkart --jiomart
"""

import asyncio
import sys
import os
import logging
import json
from pathlib import Path
import argparse
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.config import get_settings
from app.catalog.populator import CatalogPopulator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('catalog_population.log')
    ]
)
logger = logging.getLogger(__name__)


async def main():
    """Main entry point for catalog population."""
    
    parser = argparse.ArgumentParser(
        description='Populate NearShop product catalog from e-commerce sources'
    )
    parser.add_argument(
        '--full-sync',
        action='store_true',
        help='Replace all existing products (otherwise merge/update)'
    )
    parser.add_argument(
        '--flipkart',
        action='store_true',
        help='Include Flipkart scraping'
    )
    parser.add_argument(
        '--amazon',
        action='store_true',
        help='Include Amazon scraping'
    )
    parser.add_argument(
        '--jiomart',
        action='store_true',
        help='Include JioMart scraping'
    )
    parser.add_argument(
        '--bigbasket',
        action='store_true',
        help='Include BigBasket scraping'
    )
    parser.add_argument(
        '--all-sources',
        action='store_true',
        help='Include all available sources (default)'
    )
    
    args = parser.parse_args()
    
    # Get settings
    settings = get_settings()
    
    logger.info("=" * 80)
    logger.info("🚀 NearShop Catalog Population Tool")
    logger.info("=" * 80)
    logger.info(f"Database: {settings.DATABASE_URL}")
    logger.info(f"Full sync: {args.full_sync}")
    logger.info("")
    
    try:
        async with CatalogPopulator(
            database_url=settings.DATABASE_URL,
            flipkart_token=os.getenv('FLIPKART_AFFILIATE_TOKEN'),
            amazon_rapidapi_key=os.getenv('AMAZON_RAPIDAPI_KEY')
        ) as populator:
            
            # Determine which sources to scrape
            all_sources = args.all_sources or not any([
                args.flipkart, args.amazon, args.jiomart, args.bigbasket
            ])
            
            if all_sources:
                logger.info("📚 Scraping from all available sources...")
            else:
                sources = []
                if args.flipkart:
                    sources.append("Flipkart")
                if args.amazon:
                    sources.append("Amazon")
                if args.jiomart:
                    sources.append("JioMart")
                if args.bigbasket:
                    sources.append("BigBasket")
                logger.info(f"📚 Scraping from: {', '.join(sources)}")
            
            logger.info("")
            
            # Run population
            results = await populator.populate_all(full_sync=args.full_sync)
            
            # Print summary
            logger.info("")
            logger.info("=" * 80)
            logger.info("✨ SUMMARY")
            logger.info("=" * 80)
            logger.info(f"Flipkart products: {len(results['flipkart']['products'])}")
            logger.info(f"Amazon products: {len(results['amazon']['products'])}")
            logger.info(f"JioMart products: {len(results['jiomart']['products'])}")
            logger.info(f"BigBasket products: {len(results['bigbasket']['products'])}")
            logger.info(f"Total scraped: {sum(len(r['products']) for r in results.values() if isinstance(r, dict) and 'products' in r)}")
            logger.info("")
            logger.info(f"Database changes:")
            logger.info(f"  ✅ Inserted: {results['total_stats']['inserted']}")
            logger.info(f"  🔄 Updated: {results['total_stats']['updated']}")
            logger.info(f"  ⚠️  Duplicates: {results['total_stats']['duplicates']}")
            logger.info(f"  ❌ Errors: {results['total_stats']['errors']}")
            logger.info("=" * 80)
            logger.info("")
            logger.info("✅ Catalog population completed!")
            logger.info("Log saved to: catalog_population.log")

            report_payload = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "database": settings.DATABASE_URL,
                "full_sync": args.full_sync,
                "source_counts": {
                    "flipkart": len(results["flipkart"]["products"]),
                    "amazon": len(results["amazon"]["products"]),
                    "jiomart": len(results["jiomart"]["products"]),
                    "bigbasket": len(results["bigbasket"]["products"]),
                },
                "category_fetch_status": {
                    "jiomart": results["jiomart"].get("categories", {}),
                    "bigbasket": results["bigbasket"].get("categories", {}),
                },
                "db_changes": results["total_stats"],
            }
            report_path = Path("docs") / "live_scrape_report.json"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(json.dumps(report_payload, indent=2), encoding="utf-8")
            logger.info(f"JSON report saved to: {report_path}")
        
        return 0
    
    except KeyboardInterrupt:
        logger.warning("Population cancelled by user")
        return 130
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
