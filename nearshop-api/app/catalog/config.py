"""Configuration for catalog scraping and population."""

import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class CatalogConfig(BaseSettings):
    """Catalog configuration settings."""
    
    # API Credentials
    FLIPKART_AFFILIATE_TOKEN: Optional[str] = Field(
        default=None,
        description="Flipkart Affiliate API token"
    )
    AMAZON_RAPIDAPI_KEY: Optional[str] = Field(
        default=None,
        description="RapidAPI key for Amazon scraper"
    )
    
    # Scraping Settings
    SCRAPE_FLIPKART: bool = Field(
        default=True,
        description="Enable Flipkart scraping"
    )
    SCRAPE_AMAZON: bool = Field(
        default=False,
        description="Enable Amazon scraping (requires API key)"
    )
    SCRAPE_JIOMART: bool = Field(
        default=True,
        description="Enable JioMart web scraping"
    )
    SCRAPE_BIGBASKET: bool = Field(
        default=True,
        description="Enable BigBasket web scraping"
    )
    
    # Rate Limiting
    REQUEST_TIMEOUT: int = Field(
        default=30,
        description="HTTP request timeout in seconds"
    )
    DELAY_BETWEEN_REQUESTS: float = Field(
        default=1.0,
        description="Delay between requests in seconds"
    )
    DELAY_BETWEEN_CATEGORIES: float = Field(
        default=2.0,
        description="Delay between category scrapes in seconds"
    )
    
    # Scheduler
    ENABLE_SCHEDULER: bool = Field(
        default=False,
        description="Enable periodic catalog updates"
    )
    SCHEDULE_INTERVAL_HOURS: int = Field(
        default=24,
        description="Interval between catalog updates in hours"
    )
    SCHEDULE_TIME: str = Field(
        default="03:00",
        description="Time to run scheduled updates (HH:MM format)"
    )
    
    # Product Limits
    MAX_PRODUCTS_PER_CATEGORY: int = Field(
        default=100,
        description="Maximum products to scrape per category"
    )
    
    # Data Processing
    DEDUPLICATE_PRODUCTS: bool = Field(
        default=True,
        description="Remove duplicate products after scraping"
    )
    MIN_CONFIDENCE_SCORE: float = Field(
        default=0.7,
        description="Minimum confidence score to accept product (0-1)"
    )
    
    class Config:
        env_file = ".env"
        env_prefix = "CATALOG_"


# Create global config instance
catalog_config = CatalogConfig()
