"""Catalog module - master product catalog system."""

from app.catalog.models import CatalogTemplate, ShopCatalogSelection
from app.catalog.service import CatalogService, CatalogDataNormalizer
from app.catalog.scrapers import (
    FlipkartScraper, AmazonScraper, JioMartScraper, 
    BigBasketScraper, DataSource
)
from app.catalog.populator import CatalogPopulator

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
