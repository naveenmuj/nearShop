"""Catalog module - master product catalog system."""

from app.catalog.models import CatalogTemplate, ShopCatalogSelection
from app.catalog.service import CatalogService, CatalogDataNormalizer
from app.catalog.populator import CatalogPopulator

# Scraper dependencies are optional in some deployments. Avoid breaking
# API startup if scraping-only packages are not installed.
try:
    from app.catalog.scrapers import (
        FlipkartScraper,
        AmazonScraper,
        JioMartScraper,
        BigBasketScraper,
        DataSource,
    )
except Exception:  # pragma: no cover
    FlipkartScraper = None
    AmazonScraper = None
    JioMartScraper = None
    BigBasketScraper = None
    DataSource = None

__all__ = [
    'CatalogTemplate',
    'ShopCatalogSelection',
    'CatalogService',
    'CatalogDataNormalizer',
    'FlipkartScraper',
    'AmazonScraper',
    'JioMartScraper',
    'BigBasketScraper',
    'DataSource',
    'CatalogPopulator',
]
