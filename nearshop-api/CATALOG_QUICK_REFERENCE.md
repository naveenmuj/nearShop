# Catalog System - Quick Reference Guide

## 📁 File Structure

```
nearshop-api/
├── app/catalog/
│   ├── __init__.py                 # Module exports
│   ├── models.py                   # Database models
│   │   ├── CatalogTemplate         # Master products table
│   │   └── ShopCatalogSelection    # Shop's selected products
│   │
│   ├── scrapers.py                 # Web scrapers for e-commerce sites
│   │   ├── FlipkartScraper        # Uses official API
│   │   ├── AmazonScraper          # Uses RapidAPI wrapper
│   │   ├── JioMartScraper         # Web scraping
│   │   └── BigBasketScraper       # Web scraping
│   │
│   ├── service.py                  # Database operations
│   │   ├── CatalogDataNormalizer  # Normalize raw data
│   │   └── CatalogService         # DB CRUD operations
│   │
│   ├── populator.py                # Main orchestrator
│   │   └── CatalogPopulator       # Coordinates all scrapers
│   │
│   ├── scheduler.py                # Automatic updates
│   │   └── CatalogScheduler       # Periodic scraping
│   │
│   └── config.py                   # Configuration settings
│
├── migrations/versions/
│   └── 0001_add_catalog_templates_table.py  # DB migration
│
├── populate_catalog.py             # Quick-start script
├── CATALOG_SETUP.md                # Full setup guide
└── requirements-catalog.txt        # Dependencies
```

## 🚀 Quick Start (5 Minutes)

### 1. Install dependencies
```bash
pip install -r requirements-catalog.txt
```

### 2. Configure API keys (.env file)
```env
CATALOG_FLIPKART_AFFILIATE_TOKEN=YOUR_TOKEN
CATALOG_AMAZON_RAPIDAPI_KEY=YOUR_KEY  # Optional
```

### 3. Run migration
```bash
alembic upgrade head
```

### 4. Populate catalog (30-60 minutes)
```bash
python populate_catalog.py
```

Or with specific sources:
```bash
python populate_catalog.py --flipkart --jiomart
```

Done! ✅

---

## 📊 Database Schema

### `catalog_templates` (Master Products)
```sql
-- Master list of products from all sources
id              UUID PRIMARY KEY
sku             VARCHAR(100) UNIQUE        -- ELECTronics-Apple-iPhone15
name            VARCHAR(300)               -- "Apple iPhone 15 Pro"
brand           VARCHAR(150)               -- "Apple"
category        VARCHAR(100)               -- "Electronics"
subcategory     VARCHAR(100)               -- "Mobile Phones"
description     TEXT                       -- Full description
image_urls      TEXT[]                     -- Array of image URLs
attributes      JSONB                      -- {color: ["red", "blue"], size: ["128GB", "256GB"]}
data_source     VARCHAR(50)                -- "flipkart", "amazon", "jiomart"
base_price_inr  NUMERIC(10,2)              -- Baseline price
avg_rating      FLOAT                      -- Customer rating
confidence_score FLOAT (0-1)                -- How sure we are (API=0.95, web=0.75)
popularity_score INTEGER                   -- How many shops have it
num_shops_using  INTEGER                   -- Count of shops
created_at      TIMESTAMP
```

### `shop_catalog_selections` (Shop's Selections)
```sql
-- Junction table: which shops have which products
id              UUID PRIMARY KEY
shop_id         UUID (FK to shops)         -- Reference to shop
catalog_id      UUID (FK to catalog_templates)
local_price     NUMERIC(10,2)              -- Shop's custom price
stock_quantity  INTEGER                    -- Available stock
local_description TEXT                     -- Shop's custom notes
is_active       BOOLEAN                    -- Is this product active for shop?
selected_at     TIMESTAMP
```

---

## 🔄 Data Flow

### Single Scraping Cycle

```
START
  │
  ├─→ FlipkartScraper    (Flipkart API)      → ✓ 95% confidence
  ├─→ AmazonScraper      (RapidAPI)          → ✓ 90% confidence  
  ├─→ JioMartScraper     (Web scraping)      → ✓ 75% confidence
  ├─→ BigBasketScraper   (Web scraping)      → ✓ 75% confidence
  │
  ├─→ NORMALIZE           (standard schema)   → SKU generation
  ├─→ DEDUPLICATE         (by SKU)            → Keep best sources
  │
  └─→ DATABASE INSERT     (upsert)            → ✓ Updated catalog
      │
      └─→ READY FOR SHOP SELECTION
```

### Shop Selection Flow

```
SHOP OWNER VIEWS CATALOG
  │
  ├─→ Browse by category         (query: category=Electronics)
  ├─→ Search by name             (query: "iPhone 15")
  ├─→ Filter by price            (query: min_price=10000&max_price=100000)
  │
  └─→ SELECT PRODUCT             (add to shop inventory)
      │
      ├─→ Set custom price       (₹79,999 instead of ₹80,000)
      ├─→ Set stock quantity     (50 units)
      ├─→ Optional custom description
      │
      └─→ SAVED TO shop_catalog_selections
          │
          └─→ Now visible in shop's product list
```

---

## 🔑 Key Classes

### `FlipkartScraper`
```python
async with FlipkartScraper(token) as scraper:
    products = await scraper.search("iPhone", limit=50)
    # Returns: [{name, price, brand, image_urls, ...}]
```

### `CatalogDataNormalizer`
```python
normalized = CatalogDataNormalizer.normalize(raw_product)
# Input: raw dict from any scraper
# Output: standardized dict with all fields
```

### `CatalogService`
```python
service = CatalogService(db_session)

# Search
products = await service.search_catalog(
    query="iPhone",
    category="Electronics",
    min_price=50000,
    limit=50
)

# Add to shop
selection = await service.add_to_shop(
    shop_id=shop_uuid,
    catalog_id=product_uuid,
    local_price=75000,
    stock_quantity=10
)

# Get shop's products
shop_products = await service.get_shop_catalog(shop_id)
```

### `CatalogPopulator`
```python
async with CatalogPopulator(db_url, flipkart_token, amazon_key) as pop:
    results = await pop.populate_all(full_sync=False)
    # Returns: {flipkart: {...}, amazon: {...}, stats: {...}}
```

---

## ⚙️ Configuration Options

All in `.env` file:

```env
# Which sources to scrape
CATALOG_SCRAPE_FLIPKART=true
CATALOG_SCRAPE_AMAZON=false
CATALOG_SCRAPE_JIOMART=true
CATALOG_SCRAPE_BIGBASKET=true

# Rate limiting (seconds)
CATALOG_DELAY_BETWEEN_REQUESTS=1.0
CATALOG_DELAY_BETWEEN_CATEGORIES=2.0

# Limits
CATALOG_MAX_PRODUCTS_PER_CATEGORY=100

# Automatic updates
CATALOG_ENABLE_SCHEDULER=true
CATALOG_SCHEDULE_TIME=03:00    # Daily at 3 AM

# Data quality
CATALOG_MIN_CONFIDENCE_SCORE=0.7
CATALOG_DEDUPLICATE_PRODUCTS=true
```

---

## 📈 Expected Results

### Initial Population
- **Time**: 30-60 minutes
- **Products**: 2,000-3,500
- **Sources**: Flipkart + JioMart + BigBasket
- **Quality**: 500-1000 unique products, 1000-2500 duplicates removed

### By Category (Approximate)
| Category | Count | Prime Source |
|----------|-------|--------------|
| Electronics | 400 | Flipkart |
| Clothing | 600 | JioMart + Flipkart |
| Groceries | 800 | BigBasket + JioMart |
| Home & Kitchen | 400 | JioMart |
| **Total** | **~2,200** | Mixed |

### Daily Updates
- **Time**: 20-30 minutes
- **New products**: 50-100
- **Updated prices**: 200-300
- **Removed products**: 10-20

---

## 🛠️ Common Tasks

### Get all products in a category
```python
products = await service.search_catalog(category="Electronics")
```

### Find a specific product
```python
products = await service.search_catalog(query="iPhone 15")
```

### Add product to shop
```python
await service.add_to_shop(
    shop_id=shop_uuid,
    catalog_id=product_uuid,
    local_price=79999,
    stock_quantity=50
)
```

### Trigger manual update
```python
async with CatalogPopulator(db_url, flipkart_token, amazon_key) as pop:
    await pop.populate_all(full_sync=False)
```

### Check product sources
```python
products = await db.execute(
    select(
        CatalogTemplate.data_source,
        func.count()
    ).group_by(CatalogTemplate.data_source)
)
# Output: {flipkart: 400, jiomart: 600, bigbasket: 800, ...}
```

---

## 🐛 Debugging

### Enable verbose logging
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check scraper output
```bash
tail -f catalog_population.log
```

### Verify database
```sql
SELECT COUNT(*) FROM catalog_templates;
SELECT data_source, COUNT(*) FROM catalog_templates 
GROUP BY data_source;
```

### Test individual scraper
```python
async with JioMartScraper() as scraper:
    products = await scraper.search_category('groceries', limit=10)
    print(f"Found {len(products)} products")
```

---

## 📚 Next Steps

1. ✅ Install dependencies
2. ✅ Configure API keys
3. ✅ Run migration
4. ✅ Populate catalog
5. ⏳ Create API endpoints (for browsing)
6. ⏳ Create mobile UI (for shop owners)
7. ⏳ Add analytics (popular products)

---

## 🆘 Support

If you get stuck:
1. Check `CATALOG_SETUP.md` for detailed guide
2. Review logs: `catalog_population.log`
3. Check the database migration ran: `alembic current`
4. Verify API keys are correct
5. Try scraping single source first

Good luck! 🚀
