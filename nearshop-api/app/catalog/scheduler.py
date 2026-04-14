"""Scheduler for periodic catalog population."""

import logging
from datetime import datetime, time
import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.catalog.populator import CatalogPopulator
from app.catalog.config import catalog_config

logger = logging.getLogger(__name__)


class CatalogScheduler:
    """Manages periodic catalog updates."""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.scheduler = None
    
    async def start(self):
        """Start the scheduler."""
        if not catalog_config.ENABLE_SCHEDULER:
            logger.info("Catalog scheduler is disabled")
            return
        
        self.scheduler = AsyncIOScheduler()
        
        # Parse schedule time
        try:
            schedule_time = time.fromisoformat(catalog_config.SCHEDULE_TIME)
            hour = schedule_time.hour
            minute = schedule_time.minute
        except ValueError:
            logger.error(f"Invalid SCHEDULE_TIME format: {catalog_config.SCHEDULE_TIME}")
            hour, minute = 3, 0  # Default to 3 AM
        
        # Add job
        self.scheduler.add_job(
            self._run_population,
            CronTrigger(hour=hour, minute=minute),
            id='catalog_population',
            name='Catalog Population',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info(f"Catalog scheduler started. Next run at {hour:02d}:{minute:02d}")
    
    async def stop(self):
        """Stop the scheduler."""
        if self.scheduler:
            self.scheduler.shutdown()
            logger.info("Catalog scheduler stopped")
    
    async def _run_population(self):
        """Run catalog population."""
        logger.info("Starting scheduled catalog population...")
        
        try:
            async with CatalogPopulator(
                database_url=self.database_url,
                flipkart_token=catalog_config.FLIPKART_AFFILIATE_TOKEN,
                amazon_rapidapi_key=catalog_config.AMAZON_RAPIDAPI_KEY
            ) as populator:
                await populator.populate_all(full_sync=False)
            
            logger.info("Scheduled catalog population completed successfully")
        
        except Exception as e:
            logger.error(f"Error in scheduled catalog population: {e}", exc_info=True)
    
    async def run_now(self):
        """Run population immediately (for testing/manual trigger)."""
        logger.info("Running catalog population manually...")
        await self._run_population()
