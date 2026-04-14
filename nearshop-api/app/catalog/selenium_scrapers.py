#!/usr/bin/env python3
"""
Advanced web scrapers for Indian e-commerce sites using Selenium.
Handles JavaScript-rendered content and dynamic product loading.
"""

import asyncio
import logging
import json
from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum
import time
import re

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from bs4 import BeautifulSoup
import aiohttp

logger = logging.getLogger(__name__)


class DataSource(str, Enum):
    JIOMART = "jiomart"
    BIGBASKET = "bigbasket"
    FLIPKART = "flipkart"
    AMAZON = "amazon"


class JioMartSeleniumScraper:
    """Scrape JioMart using Selenium for JavaScript-rendered content."""
    
    BASE_URL = "https://www.jiomart.com"
    
    CATEGORIES = {
        'groceries': ('/c/groceries', 'Groceries'),
        'fresh': ('/c/fresh', 'Fresh Produce'),
        'snacks': ('/c/snacks-bakery/snacks', 'Snacks'),
        'beverages': ('/c/beverages', 'Beverages'),
        'personal-care': ('/c/personal-care', 'Personal Care'),
    }
    
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.driver = None
        
    def _setup_driver(self):
        """Setup Chrome WebDriver with stealth options."""
        chrome_options = Options()
        
        if self.headless:
            chrome_options.add_argument("--headless=new")
        
        # Make browser look less like a bot
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-extensions")
        chrome_options.add_argument("--disable-plugins")
        chrome_options.add_argument("--disable-gpu")
        
        # Suppress logging
        chrome_options.add_argument("--log-level=3")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        
    def scrape_category(self, category: str, limit: int = 50) -> List[Dict]:
        """Scrape products from a category."""
        if category not in self.CATEGORIES:
            logger.warning(f"Unknown category: {category}")
            return []
        
        if not self.driver:
            self._setup_driver()
        
        path, display_name = self.CATEGORIES[category]
        url = f"{self.BASE_URL}{path}"
        products = []
        
        try:
            logger.info(f"Loading JioMart {display_name}...")
            self.driver.get(url)
            
            # Wait for products to load
            wait = WebDriverWait(self.driver, 10)
            
            # Try multiple selectors for product containers
            selectors = [
                (By.CLASS_NAME, "sc-1h3uyls-0"),  # JioMart product card
                (By.CSS_SELECTOR, "[data-testid='productCard']"),
                (By.CLASS_NAME, "productCard"),
                (By.CSS_SELECTOR, "a[href*='/p/']"),
            ]
            
            product_elements = []
            for by, selector in selectors:
                try:
                    logger.info(f"  Trying selector: {selector}")
                    elements = wait.until(EC.presence_of_all_elements_located((by, selector)))
                    if elements:
                        product_elements = elements[:limit]
                        logger.info(f"  Found {len(product_elements)} products with selector: {selector}")
                        break
                except:
                    continue
            
            # Scroll to load more products
            for i in range(min(3, limit // 10)):
                self.driver.execute_script("window.scrollBy(0, 500);")
                time.sleep(1)
            
            # Parse products
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            
            # More flexible parsing
            for elem in soup.find_all(['div', 'a'], class_=re.compile('product|card|item', re.I)):
                if len(products) >= limit:
                    break
                
                try:
                    # Extract name
                    name_elem = elem.find(['h2', 'h3', 'h4', 'span'], class_=re.compile('name|title', re.I))
                    name = name_elem.get_text(strip=True) if name_elem else None
                    
                    # Extract price
                    price_elem = elem.find(re.compile('span|div'), class_=re.compile('price|mrp', re.I), string=re.compile(r'₹|Rs'))
                    price_text = price_elem.get_text(strip=True) if price_elem else None
                    price = self._parse_price(price_text) if price_text else None
                    
                    # Extract image
                    img = elem.find('img')
                    image_url = img.get('src') or img.get('data-src') if img else None
                    
                    # Extract link
                    link = elem.find('a', href=True)
                    product_url = link['href'] if link else None
                    if product_url and not product_url.startswith('http'):
                        product_url = f"{self.BASE_URL}{product_url}"
                    
                    if name and price and price > 0:
                        product = {
                            'sku': name.lower().replace(' ', '-'),
                            'name': name,
                            'brand': 'Generic',
                            'category': display_name,
                            'price': price,
                            'compare_price': None,
                            'thumbnail_url': image_url,
                            'source_url': product_url,
                            'source_id': None,
                            'data_source': DataSource.JIOMART,
                            'description': name,
                            'avg_rating': None,
                            'num_reviews': 0,
                            'confidence_score': 0.80,  # Selenium scraping
                        }
                        products.append(product)
                        logger.debug(f"Scraped: {name} - ₹{price}")
                
                except Exception as e:
                    logger.debug(f"Error parsing product: {e}")
                    continue
        
        except Exception as e:
            logger.error(f"Error scraping JioMart {display_name}: {e}")
        
        logger.info(f"✅ JioMart: Scraped {len(products)} {display_name} products")
        return products
    
    @staticmethod
    def _parse_price(price_str: str) -> Optional[float]:
        """Extract numeric price from string."""
        match = re.search(r'[\d,]+\.?\d*', str(price_str).replace(',', '').replace('₹', '').replace('Rs', '').strip())
        return float(match.group()) if match else None
    
    def close(self):
        """Close the browser."""
        if self.driver:
            self.driver.quit()
            self.driver = None


class BigBasketSeleniumScraper:
    """Scrape BigBasket using Selenium for JavaScript-rendered content."""
    
    BASE_URL = "https://www.bigbasket.com"
    
    CATEGORIES = {
        'vegetables': ('/cl/vegetables/5', 'Vegetables'),
        'fruits': ('/cl/fruits/6', 'Fruits'),
        'groceries': ('/cl/foodgrains-oil-ghee/13', 'Groceries'),
        'dairy': ('/cl/dairy-bakery/8', 'Dairy & Bakery'),
        'snacks': ('/cl/snacks-munchies/9', 'Snacks'),
    }
    
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.driver = None
    
    def _setup_driver(self):
        """Setup Chrome WebDriver with stealth options."""
        chrome_options = Options()
        
        if self.headless:
            chrome_options.add_argument("--headless=new")
        
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--log-level=3")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
    
    def scrape_category(self, category: str, limit: int = 50) -> List[Dict]:
        """Scrape products from a category."""
        if category not in self.CATEGORIES:
            logger.warning(f"Unknown category: {category}")
            return []
        
        if not self.driver:
            self._setup_driver()
        
        path, display_name = self.CATEGORIES[category]
        url = f"{self.BASE_URL}{path}"
        products = []
        
        try:
            logger.info(f"Loading BigBasket {display_name}...")
            self.driver.get(url)
            
            # Wait for products to load
            wait = WebDriverWait(self.driver, 10)
            
            # Try to find product elements
            selectors = [
                (By.CLASS_NAME, "ProductCard"),
                (By.CSS_SELECTOR, "[class*='ProductCard']"),
                (By.CLASS_NAME, "productCard"),
                (By.CSS_SELECTOR, "li[class*='product']"),
            ]
            
            product_elements = []
            for by, selector in selectors:
                try:
                    logger.info(f"  Trying selector: {selector}")
                    elements = wait.until(EC.presence_of_all_elements_located((by, selector)), timeout=5)
                    if elements:
                        product_elements = elements[:limit]
                        logger.info(f"  Found {len(product_elements)} products")
                        break
                except:
                    continue
            
            # Scroll to load lazy images
            for i in range(min(3, limit // 10)):
                self.driver.execute_script("window.scrollBy(0, 500);")
                time.sleep(1)
            
            # Parse page source
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            
            # Find all product elements with flexible selectors
            for elem in soup.find_all(['div', 'li'], class_=re.compile('product|card', re.I)):
                if len(products) >= limit:
                    break
                
                try:
                    # Extract product name
                    name_elem = elem.find(['h3', 'h4', 'span'], class_=re.compile('name|title', re.I))
                    if not name_elem:
                        name_elem = elem.find('a', class_=re.compile('name|title', re.I))
                    name = name_elem.get_text(strip=True) if name_elem else None
                    
                    # Extract price
                    price_elem = elem.find(re.compile('span|div'), class_=re.compile('price|mrp', re.I))
                    if not price_elem:
                        # Look for ₹ symbol
                        for elem_candidate in elem.find_all('span'):
                            if '₹' in elem_candidate.get_text():
                                price_elem = elem_candidate
                                break
                    
                    price_text = price_elem.get_text(strip=True) if price_elem else None
                    price = self._parse_price(price_text) if price_text else None
                    
                    # Extract image
                    img = elem.find('img')
                    image_url = img.get('src') or img.get('data-src') if img else None
                    
                    if name and price and price > 0:
                        product = {
                            'sku': name.lower().replace(' ', '-'),
                            'name': name,
                            'brand': 'Generic',
                            'category': display_name,
                            'price': price,
                            'compare_price': None,
                            'thumbnail_url': image_url,
                            'source_url': url,
                            'source_id': None,
                            'data_source': DataSource.BIGBASKET,
                            'description': name,
                            'avg_rating': None,
                            'num_reviews': 0,
                            'confidence_score': 0.80,  # Selenium scraping
                        }
                        products.append(product)
                        logger.debug(f"Scraped: {name} - ₹{price}")
                
                except Exception as e:
                    logger.debug(f"Error parsing product: {e}")
                    continue
        
        except Exception as e:
            logger.error(f"Error scraping BigBasket {display_name}: {e}")
        
        logger.info(f"✅ BigBasket: Scraped {len(products)} {display_name} products")
        return products
    
    @staticmethod
    def _parse_price(price_str: str) -> Optional[float]:
        """Extract numeric price from string."""
        match = re.search(r'[\d,]+\.?\d*', str(price_str).replace(',', '').replace('₹', '').replace('Rs', '').strip())
        return float(match.group()) if match else None
    
    def close(self):
        """Close the browser."""
        if self.driver:
            self.driver.quit()
            self.driver = None


# Async wrappers for compatibility
class AsyncJioMartScraper:
    """Async wrapper for JioMart scraper."""
    
    def __init__(self):
        self.scraper = JioMartSeleniumScraper(headless=True)
    
    async def search_category(self, category: str, limit: int = 50) -> List[Dict]:
        """Async wrapper for scraping."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.scraper.scrape_category, category, limit)
    
    async def close(self):
        """Close browser."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.scraper.close)


class AsyncBigBasketScraper:
    """Async wrapper for BigBasket scraper."""
    
    def __init__(self):
        self.scraper = BigBasketSeleniumScraper(headless=True)
    
    async def search_category(self, category: str, limit: int = 50) -> List[Dict]:
        """Async wrapper for scraping."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.scraper.scrape_category, category, limit)
    
    async def close(self):
        """Close browser."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.scraper.close)
