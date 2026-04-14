"""Web scraper for Indian e-commerce sites - Flipkart, Amazon, JioMart."""

import asyncio
import logging
import json
from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum

import aiohttp
import httpx
from bs4 import BeautifulSoup
import re

logger = logging.getLogger(__name__)


class DataSource(str, Enum):
    FLIPKART = "flipkart"
    AMAZON = "amazon"
    JIOMART = "jiomart"
    BIGBASKET = "bigbasket"


class FlipkartScraper:
    """Scrape products from Flipkart using affiliate API."""
    
    BASE_URL = "https://affiliate-api.flipkart.net/rest/searchV3"
    
    def __init__(self, affiliate_token: str):
        self.affiliate_token = affiliate_token
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def search(self, query: str, limit: int = 100, page: int = 1) -> List[Dict]:
        """
        Search Flipkart using affiliate API.
        
        Args:
            query: Search term (e.g., "iPhone", "FMCG", "T-shirt")
            limit: Number of results
            page: Page number
        
        Returns:
            List of product dictionaries
        """
        if not self.session:
            raise RuntimeError("Session not initialized. Use async context manager.")
        
        try:
            headers = {
                "Fk-Affiliate-Id": self.affiliate_token,
                "User-Agent": "Mozilla/5.0"
            }
            
            params = {
                "affExtension": "AppAffiliate",
                "externalQuery": query,
                "method": "GET.searchResults",
                "resultCount": limit,
                "pageNumber": page
            }
            
            async with self.session.get(
                self.BASE_URL, 
                headers=headers, 
                params=params,
                timeout=10
            ) as response:
                if response.status != 200:
                    logger.warning(f"Flipkart API returned {response.status}")
                    return []
                
                data = await response.json()
                products = self._parse_flipkart_response(data)
                logger.info(f"Scraped {len(products)} products from Flipkart for '{query}'")
                return products
        
        except Exception as e:
            logger.error(f"Error scraping Flipkart: {e}")
            return []
    
    def _parse_flipkart_response(self, data: dict) -> List[Dict]:
        """Parse Flipkart API response."""
        products = []
        
        try:
            product_list = data.get('productList', {}).get('PRODUCTS', [])
            
            for item in product_list:
                product = {
                    'sku': item.get('productId', ''),
                    'name': item.get('productTitle', ''),
                    'brand': item.get('productBrand', 'Generic'),
                    'category': 'Electronics',  # Default, parse from data if available
                    'price': self._parse_price(item.get('productPrice', '0')),
                    'compare_price': self._parse_price(item.get('productOriginalPrice', '')),
                    'thumbnail_url': item.get('productImageUrl', ''),
                    'source_url': item.get('productUrl', ''),
                    'source_id': item.get('productId', ''),
                    'data_source': DataSource.FLIPKART,
                    'description': item.get('productDescription', ''),
                    'avg_rating': item.get('productRating', 0),
                    'num_reviews': item.get('productReviewCount', 0),
                    'confidence_score': 0.95,  # High confidence from official API
                }
                products.append(product)
        
        except Exception as e:
            logger.error(f"Error parsing Flipkart response: {e}")
        
        return products
    
    @staticmethod
    def _parse_price(price_str: str) -> Optional[float]:
        """Extract numeric price from string."""
        if not price_str:
            return None
        match = re.search(r'[\d,]+\.?\d*', price_str.replace(',', ''))
        return float(match.group()) if match else None


class AmazonScraper:
    """Scrape products from Amazon India (using RapidAPI or web scraping)."""
    
    def __init__(self, rapidapi_key: str = None):
        """
        Initialize Amazon scraper.
        
        Args:
            rapidapi_key: API key for rapid API Amazon scraper
        """
        self.rapidapi_key = rapidapi_key
        self.base_url = "https://amazon100-in.p.rapidapi.com/search"
    
    async def search(self, query: str, limit: int = 50) -> List[Dict]:
        """
        Search Amazon using RapidAPI wrapper.
        
        Args:
            query: Search term
            limit: Number of results
        
        Returns:
            List of product dictionaries
        """
        if not self.rapidapi_key:
            logger.warning("Amazon RapidAPI key not configured, skipping")
            return []
        
        try:
            headers = {
                "X-RapidAPI-Key": self.rapidapi_key,
                "X-RapidAPI-Host": "amazon100-in.p.rapidapi.com"
            }
            
            params = {"q": query, "p": "1"}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.base_url, 
                    headers=headers, 
                    params=params,
                    timeout=10
                ) as response:
                    if response.status != 200:
                        logger.warning(f"Amazon API returned {response.status}")
                        return []
                    
                    data = await response.json()
                    products = self._parse_amazon_response(data)
                    logger.info(f"Scraped {len(products)} products from Amazon for '{query}'")
                    return products
        
        except Exception as e:
            logger.error(f"Error scraping Amazon: {e}")
            return []
    
    def _parse_amazon_response(self, data: dict) -> List[Dict]:
        """Parse Amazon API response."""
        products = []
        
        try:
            results = data.get('results', [])
            
            for item in results[:50]:  # Limit results
                price = item.get('price', 0)
                if isinstance(price, str):
                    price = self._parse_price(price)
                
                product = {
                    'sku': item.get('asin', ''),
                    'name': item.get('title', ''),
                    'brand': item.get('brand', 'Generic'),
                    'category': 'Electronics',
                    'price': price,
                    'compare_price': None,
                    'thumbnail_url': item.get('image', ''),
                    'source_url': f"https://www.amazon.in/dp/{item.get('asin', '')}",
                    'source_id': item.get('asin', ''),
                    'data_source': DataSource.AMAZON,
                    'description': item.get('title', ''),
                    'avg_rating': item.get('rating', 0),
                    'num_reviews': item.get('reviews', 0),
                    'confidence_score': 0.90,
                }
                products.append(product)
        
        except Exception as e:
            logger.error(f"Error parsing Amazon response: {e}")
        
        return products
    
    @staticmethod
    def _parse_price(price_str: str) -> Optional[float]:
        """Extract numeric price."""
        match = re.search(r'[\d,]+\.?\d*', str(price_str).replace(',', '').replace('₹', ''))
        return float(match.group()) if match else None


class JioMartScraper:
    """Scrape products from JioMart using web scraping."""
    
    BASE_URL = "https://www.jiomart.com"
    
    CATEGORIES = {
        'groceries': '/c/groceries',
        'fresh': '/c/fresh',
        'electronics': '/c/electronics',
        'fashion': '/c/fashion',
        'home': '/c/home-and-kitchen',
    }
    
    def __init__(self):
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def search_category(self, category: str, limit: int = 100) -> List[Dict]:
        """
        Scrape products from JioMart category.
        
        Args:
            category: Category key from CATEGORIES
            limit: Number of products to scrape
        
        Returns:
            List of product dictionaries
        """
        if not self.session:
            raise RuntimeError("Session not initialized. Use async context manager.")
        
        if category not in self.CATEGORIES:
            logger.warning(f"Unknown category: {category}")
            return []
        
        url = f"{self.BASE_URL}{self.CATEGORIES[category]}"
        products = []
        
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Referer": f"{self.BASE_URL}/",
            }
            
            async with self.session.get(url, headers=headers, timeout=15, ssl=False) as response:
                if response.status != 200:
                    logger.warning(f"JioMart returned {response.status}")
                    return []
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # Find product containers - more flexible selectors
                product_cards = soup.find_all('div', {'class': re.compile('product-card|productCard|col-md-3')})
                if not product_cards:
                    product_cards = soup.find_all('a', {'class': re.compile('product')})
                
                for card in product_cards[:limit]:
                    try:
                        product = self._parse_jiomart_card(card, category)
                        if product:
                            products.append(product)
                    except Exception as e:
                        logger.debug(f"Failed to parse JioMart card: {e}")
                        continue
                
                logger.info(f"Scraped {len(products)} products from JioMart {category}")
        
        except Exception as e:
            logger.error(f"Error scraping JioMart: {e}")
        
        return products
    
    def _parse_jiomart_card(self, card, category: str) -> Optional[Dict]:
        """Parse individual JioMart product card."""
        try:
            # Extract data from card
            name_elem = card.find('h2') or card.find('a', {'title': True})
            name = name_elem.get_text(strip=True) if name_elem else None
            
            price_elem = card.find('span', {'class': re.compile('price|mrp')})
            price_text = price_elem.get_text(strip=True) if price_elem else '0'
            price = self._parse_price(price_text)
            
            img_elem = card.find('img')
            image_url = img_elem.get('src') or img_elem.get('data-src') if img_elem else None
            
            link_elem = card.find('a', {'href': True})
            source_url = link_elem['href'] if link_elem else None
            if source_url and not source_url.startswith('http'):
                source_url = f"{self.BASE_URL}{source_url}"
            
            if not name or not price:
                return None
            
            return {
                'sku': name.lower().replace(' ', '-'),
                'name': name,
                'brand': 'Generic',
                'category': self._map_category(category),
                'price': price,
                'compare_price': None,
                'thumbnail_url': image_url,
                'source_url': source_url,
                'source_id': None,
                'data_source': DataSource.JIOMART,
                'description': name,
                'avg_rating': None,
                'num_reviews': 0,
                'confidence_score': 0.75,  # Web scraping has lower confidence
            }
        
        except Exception as e:
            logger.debug(f"Error parsing JioMart card: {e}")
            return None
    
    @staticmethod
    def _map_category(jiomart_cat: str) -> str:
        """Map JioMart category to standard category."""
        mapping = {
            'groceries': 'Groceries',
            'fresh': 'Fresh Produce',
            'electronics': 'Electronics',
            'fashion': 'Clothing',
            'home': 'Home & Kitchen',
        }
        return mapping.get(jiomart_cat, 'Miscellaneous')
    
    @staticmethod
    def _parse_price(price_str: str) -> Optional[float]:
        """Extract numeric price."""
        match = re.search(r'[\d,]+\.?\d*', str(price_str).replace(',', '').replace('₹', ''))
        return float(match.group()) if match else None


class BigBasketScraper:
    """Scrape products from BigBasket."""
    
    BASE_URL = "https://www.bigbasket.com"
    
    CATEGORIES = {
        'vegetables': '/cl/vegetables/5',
        'fruits': '/cl/fruits/6',
        'dairy': '/cl/dairy-bakery/8',
        'pantry': '/cl/staples-spices-dry-fruits/7',
    }
    
    def __init__(self):
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def search_category(self, category: str, limit: int = 100) -> List[Dict]:
        """Scrape BigBasket category products."""
        if not self.session:
            raise RuntimeError("Session not initialized. Use async context manager.")
        
        if category not in self.CATEGORIES:
            logger.warning(f"Unknown category: {category}")
            return []
        
        url = f"{self.BASE_URL}{self.CATEGORIES[category]}"
        products = []
        
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Referer": f"{self.BASE_URL}/",
            }
            
            async with self.session.get(url, headers=headers, timeout=15, ssl=False) as response:
                if response.status != 200:
                    logger.warning(f"BigBasket returned {response.status}")
                    return []
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # Find product containers - more flexible selectors
                product_cards = soup.find_all('div', {'class': re.compile('ProductCard|productCard|col-md-3')})
                if not product_cards:
                    product_cards = soup.find_all('li', {'class': re.compile('product')})
                
                for card in product_cards[:limit]:
                    try:
                        product = self._parse_bigbasket_card(card, category)
                        if product:
                            products.append(product)
                    except Exception as e:
                        logger.debug(f"Failed to parse BigBasket card: {e}")
                        continue
                
                logger.info(f"Scraped {len(products)} products from BigBasket {category}")
        
        except Exception as e:
            logger.error(f"Error scraping BigBasket: {e}")
        
        return products
    
    def _parse_bigbasket_card(self, card, category: str) -> Optional[Dict]:
        """Parse BigBasket product card."""
        try:
            name = card.find('h2') or card.find('a')
            name = name.get_text(strip=True) if name else None
            
            price_elem = card.find('span', {'class': re.compile('Price|price')})
            price_text = price_elem.get_text(strip=True) if price_elem else '0'
            price = self._parse_price(price_text)
            
            img_elem = card.find('img')
            image_url = img_elem.get('src') or img_elem.get('data-src') if img_elem else None
            
            if not name or not price:
                return None
            
            return {
                'sku': name.lower().replace(' ', '-'),
                'name': name,
                'brand': 'Generic',
                'category': 'Groceries',
                'price': price,
                'compare_price': None,
                'thumbnail_url': image_url,
                'source_url': None,
                'source_id': None,
                'data_source': DataSource.BIGBASKET,
                'description': name,
                'avg_rating': None,
                'num_reviews': 0,
                'confidence_score': 0.75,
            }
        
        except Exception as e:
            logger.debug(f"Error parsing BigBasket card: {e}")
            return None
    
    @staticmethod
    def _parse_price(price_str: str) -> Optional[float]:
        """Extract price."""
        match = re.search(r'[\d,]+\.?\d*', str(price_str).replace(',', '').replace('₹', ''))
        return float(match.group()) if match else None
