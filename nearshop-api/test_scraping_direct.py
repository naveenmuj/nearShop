#!/usr/bin/env python3
"""
Direct test of web scraping without async complexities.
Tests actual website connectivity and data retrieval.
"""

import requests
from bs4 import BeautifulSoup
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Headers that mimic real browser
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Cache-Control": "max-age=0",
}

def test_jiomart():
    """Test JioMart scraping."""
    print("\n" + "="*60)
    print("🛒 Testing JioMart...")
    print("="*60)
    
    try:
        url = "https://www.jiomart.com/c/groceries"
        logger.info(f"Fetching: {url}")
        
        response = requests.get(url, headers=HEADERS, timeout=10)
        logger.info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Try different selectors
            selectors = [
                {'class': 'productCard'},
                {'class': 'product-card'},
                {'class': 'col-md-3'},
                'a[class*="product"]',
            ]
            
            for selector in selectors:
                if isinstance(selector, str):
                    cards = soup.select(selector)
                else:
                    cards = soup.find_all('div', selector)
                
                if cards:
                    logger.info(f"Found {len(cards)} products using selector: {selector}")
                    
                    # Print first few
                    for i, card in enumerate(cards[:3]):
                        text = card.get_text(strip=True)[:80]
                        logger.info(f"  [{i+1}] {text}")
                    break
            
            if not cards:
                logger.warning("❌ No products found with any selector")
                logger.info("📄 Page length:", len(response.text))
        else:
            logger.error(f"❌ Failed with status {response.status_code}")
    
    except Exception as e:
        logger.error(f"❌ Error: {e}")


def test_bigbasket():
    """Test BigBasket scraping."""
    print("\n" + "="*60)
    print("🥬 Testing BigBasket...")
    print("="*60)
    
    try:
        url = "https://www.bigbasket.com/cl/vegetables/5"
        logger.info(f"Fetching: {url}")
        
        response = requests.get(url, headers=HEADERS, timeout=10)
        logger.info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Try different selectors
            selectors = [
                {'class': 'ProductCard'},
                {'class': 'productCard'},
                {'class': 'col-md-3'},
                'li[class*="product"]',
            ]
            
            for selector in selectors:
                if isinstance(selector, str):
                    cards = soup.select(selector)
                else:
                    cards = soup.find_all('div', selector)
                
                if cards:
                    logger.info(f"Found {len(cards)} products using selector: {selector}")
                    
                    # Print first few
                    for i, card in enumerate(cards[:3]):
                        text = card.get_text(strip=True)[:80]
                        logger.info(f"  [{i+1}] {text}")
                    break
            
            if not cards:
                logger.warning("❌ No products found with any selector")
                logger.info("📄 Page length:", len(response.text))
        else:
            logger.error(f"❌ Failed with status {response.status_code}")
    
    except Exception as e:
        logger.error(f"❌ Error: {e}")


def test_connectivity():
    """Test basic connectivity."""
    print("\n" + "="*60)
    print("🔌 Testing Connectivity...")
    print("="*60)
    
    sites = [
        ("JioMart", "https://www.jiomart.com"),
        ("BigBasket", "https://www.bigbasket.com"),
    ]
    
    for name, url in sites:
        try:
            logger.info(f"Testing {name}... ", end="")
            response = requests.head(url, headers=HEADERS, timeout=5)
            logger.info(f"✅ {response.status_code}")
        except Exception as e:
            logger.error(f"❌ {e}")


if __name__ == "__main__":
    test_connectivity()
    time.sleep(2)
    test_jiomart()
    time.sleep(2)
    test_bigbasket()
