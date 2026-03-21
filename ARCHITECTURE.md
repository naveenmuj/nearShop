# NearShop — Technical Architecture Specification

> **Single Source of Truth** for the NearShop hyperlocal commerce platform.
> Last updated: 2026-03-13

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Database Connection](#database-connection)
4. [User Roles](#user-roles)
5. [Database Schema](#database-schema)
6. [Indexes](#indexes)
7. [Project Structure — Backend](#project-structure--backend)
8. [Project Structure — Frontend](#project-structure--frontend)

---

## Overview

NearShop is a hyperlocal commerce platform that digitizes local shops, connecting neighborhood businesses with nearby customers. The platform enables product discovery via AI-powered cataloging and visual search, real-time haggling, community engagement, loyalty rewards (ShopCoins), and location-aware deal surfacing.

---

## Tech Stack

| Layer            | Technology                                                        |
| ---------------- | ----------------------------------------------------------------- |
| **Backend**      | Python 3.11, FastAPI, SQLAlchemy 2.0 (async), Alembic, Celery    |
| **Frontend**     | React 18, Vite, Tailwind CSS, React Router v6, Zustand, React Query |
| **Database**     | PostgreSQL 16 (self-hosted) with PostGIS and pgvector extensions  |
| **Cache**        | Redis 7                                                           |
| **Object Storage** | Cloudflare R2 (S3-compatible)                                   |
| **AI**           | Claude Vision API (product cataloging), Open CLIP (visual search), pgvector (similarity) |
| **Auth**         | Phone OTP + JWT (RS256)                                           |
| **Payments**     | Razorpay (V2)                                                     |

---

## Database Connection

| Parameter  | Value                          |
| ---------- | ------------------------------ |
| Host       | `localhost`                    |
| Port       | `5432`                         |
| Database   | `nearshop`                     |
| User       | `postgres`                     |
| Password   | Environment variable `DB_PASSWORD` |

Connection string pattern:

```
postgresql+asyncpg://postgres:${DB_PASSWORD}@localhost:5432/nearshop
```

---

## User Roles

The platform defines three roles. A single user account can hold **multiple roles** simultaneously and switch between them via the `active_role` field.

| # | Role         | Description                                                                                         |
| - | ------------ | --------------------------------------------------------------------------------------------------- |
| 1 | **Customer** | Browses shops, discovers products, places orders, haggles on prices, earns ShopCoins                |
| 2 | **Business** | Shop owner — manages shop profile, catalogs products via AI, handles orders, runs deals, views analytics |
| 3 | **Admin**    | Internal platform management                                                                        |

---

## Database Schema

22 tables total. All primary keys are `UUID` with `gen_random_uuid()` default. All timestamps are `TIMESTAMPTZ` with appropriate defaults.

### 1. users

| Column        | Type                     | Constraints                          |
| ------------- | ------------------------ | ------------------------------------ |
| id            | UUID                     | PK, DEFAULT gen_random_uuid()        |
| phone         | VARCHAR(15)              | UNIQUE, NOT NULL                     |
| name          | VARCHAR(100)             |                                      |
| email         | VARCHAR(255)             |                                      |
| avatar_url    | TEXT                     |                                      |
| roles         | TEXT[]                   | DEFAULT '{customer}'                 |
| active_role   | VARCHAR(20)              | DEFAULT 'customer'                   |
| location      | GEOGRAPHY(POINT, 4326)   |                                      |
| interests     | TEXT[]                   |                                      |
| referral_code | VARCHAR(10)              | UNIQUE                               |
| referred_by   | UUID                     | FK -> users(id)                      |
| is_active     | BOOLEAN                  | DEFAULT true                         |
| created_at    | TIMESTAMPTZ              | DEFAULT now()                        |
| updated_at    | TIMESTAMPTZ              | DEFAULT now()                        |

### 2. otp_codes

| Column     | Type        | Constraints                   |
| ---------- | ----------- | ----------------------------- |
| id         | UUID        | PK, DEFAULT gen_random_uuid() |
| phone      | VARCHAR(15) |                               |
| code       | VARCHAR(6)  |                               |
| expires_at | TIMESTAMPTZ |                               |
| attempts   | INT         | DEFAULT 0                     |
| created_at | TIMESTAMPTZ | DEFAULT now()                 |

### 3. shops

| Column           | Type                     | Constraints                          |
| ---------------- | ------------------------ | ------------------------------------ |
| id               | UUID                     | PK, DEFAULT gen_random_uuid()        |
| owner_id         | UUID                     | FK -> users(id), NOT NULL            |
| name             | VARCHAR(200)             | NOT NULL                             |
| slug             | VARCHAR(200)             | UNIQUE                               |
| description      | TEXT                     |                                      |
| category         | VARCHAR(50)              |                                      |
| subcategories    | TEXT[]                   |                                      |
| phone            | VARCHAR(15)              |                                      |
| whatsapp         | VARCHAR(15)              |                                      |
| email            | VARCHAR(255)             |                                      |
| address          | TEXT                     |                                      |
| location         | GEOGRAPHY(POINT, 4326)   | NOT NULL                             |
| opening_hours    | JSONB                    |                                      |
| cover_image      | TEXT                     |                                      |
| logo_url         | TEXT                     |                                      |
| gallery          | TEXT[]                   |                                      |
| is_verified      | BOOLEAN                  | DEFAULT false                        |
| is_active        | BOOLEAN                  | DEFAULT true                         |
| is_premium       | BOOLEAN                  | DEFAULT false                        |
| avg_rating       | DECIMAL(2,1)             | DEFAULT 0                            |
| total_reviews    | INT                      | DEFAULT 0                            |
| total_products   | INT                      | DEFAULT 0                            |
| delivery_options | TEXT[]                   | DEFAULT '{pickup}'                   |
| delivery_radius  | INT                      |                                      |
| min_order        | DECIMAL(10,2)            |                                      |
| metadata         | JSONB                    |                                      |
| created_at       | TIMESTAMPTZ              | DEFAULT now()                        |
| updated_at       | TIMESTAMPTZ              | DEFAULT now()                        |

### 4. products

| Column         | Type          | Constraints                          |
| -------------- | ------------- | ------------------------------------ |
| id             | UUID          | PK, DEFAULT gen_random_uuid()        |
| shop_id        | UUID          | FK -> shops(id), NOT NULL            |
| name           | VARCHAR(300)  | NOT NULL                             |
| description    | TEXT          |                                      |
| price          | DECIMAL(10,2) | NOT NULL                             |
| compare_price  | DECIMAL(10,2) |                                      |
| category       | VARCHAR(100)  |                                      |
| subcategory    | VARCHAR(100)  |                                      |
| attributes     | JSONB         |                                      |
| tags           | TEXT[]        |                                      |
| images         | TEXT[]        | NOT NULL                             |
| is_available   | BOOLEAN       | DEFAULT true                         |
| is_featured    | BOOLEAN       | DEFAULT false                        |
| view_count     | INT           | DEFAULT 0                            |
| wishlist_count | INT           | DEFAULT 0                            |
| inquiry_count  | INT           | DEFAULT 0                            |
| ai_generated   | BOOLEAN       | DEFAULT false                        |
| barcode        | VARCHAR(50)   |                                      |
| created_at     | TIMESTAMPTZ   | DEFAULT now()                        |
| updated_at     | TIMESTAMPTZ   | DEFAULT now()                        |

### 5. product_embeddings

| Column          | Type        | Constraints                          |
| --------------- | ----------- | ------------------------------------ |
| id              | UUID        | PK, DEFAULT gen_random_uuid()        |
| product_id      | UUID        | FK -> products(id), UNIQUE           |
| image_embedding | VECTOR(512) |                                      |
| text_embedding  | VECTOR(384) |                                      |
| updated_at      | TIMESTAMPTZ | DEFAULT now()                        |

### 6. categories

| Column        | Type         | Constraints                          |
| ------------- | ------------ | ------------------------------------ |
| id            | UUID         | PK, DEFAULT gen_random_uuid()        |
| name          | VARCHAR(100) |                                      |
| slug          | VARCHAR(100) | UNIQUE                               |
| parent_id     | UUID         | FK -> categories(id)                 |
| icon          | VARCHAR(50)  |                                      |
| display_order | INT          |                                      |
| is_active     | BOOLEAN      | DEFAULT true                         |

### 7. orders

| Column           | Type          | Constraints                          |
| ---------------- | ------------- | ------------------------------------ |
| id               | UUID          | PK, DEFAULT gen_random_uuid()        |
| order_number     | VARCHAR(20)   | UNIQUE                               |
| customer_id      | UUID          | FK -> users(id), NOT NULL            |
| shop_id          | UUID          | FK -> shops(id), NOT NULL            |
| items            | JSONB         | NOT NULL                             |
| subtotal         | DECIMAL(10,2) |                                      |
| delivery_fee     | DECIMAL(10,2) | DEFAULT 0                            |
| discount         | DECIMAL(10,2) | DEFAULT 0                            |
| total            | DECIMAL(10,2) | NOT NULL                             |
| status           | VARCHAR(20)   |                                      |
| delivery_type    | VARCHAR(20)   |                                      |
| delivery_address | TEXT          |                                      |
| payment_method   | VARCHAR(20)   |                                      |
| payment_status   | VARCHAR(20)   |                                      |
| payment_id       | VARCHAR(100)  |                                      |
| notes            | TEXT          |                                      |
| created_at       | TIMESTAMPTZ   | DEFAULT now()                        |
| updated_at       | TIMESTAMPTZ   | DEFAULT now()                        |

### 8. reviews

| Column          | Type        | Constraints                              |
| --------------- | ----------- | ---------------------------------------- |
| id              | UUID        | PK, DEFAULT gen_random_uuid()            |
| user_id         | UUID        | FK -> users(id), NOT NULL                |
| shop_id         | UUID        | FK -> shops(id), NOT NULL                |
| order_id        | UUID        | FK -> orders(id)                         |
| rating          | INT         | NOT NULL, CHECK (rating >= 1 AND rating <= 5) |
| comment         | TEXT        |                                          |
| images          | TEXT[]      |                                          |
| is_trusted      | BOOLEAN     | DEFAULT false                            |
| shop_reply      | TEXT        |                                          |
| shop_replied_at | TIMESTAMPTZ |                                          |
| created_at      | TIMESTAMPTZ | DEFAULT now()                            |

**Constraint:** UNIQUE(user_id, shop_id, order_id)

### 9. wishlists

| Column        | Type          | Constraints                          |
| ------------- | ------------- | ------------------------------------ |
| id            | UUID          | PK, DEFAULT gen_random_uuid()        |
| user_id       | UUID          | FK -> users(id), NOT NULL            |
| product_id    | UUID          | FK -> products(id), NOT NULL         |
| price_at_save | DECIMAL(10,2) |                                      |
| created_at    | TIMESTAMPTZ   | DEFAULT now()                        |

**Constraint:** UNIQUE(user_id, product_id)

### 10. haggle_sessions

| Column       | Type          | Constraints                          |
| ------------ | ------------- | ------------------------------------ |
| id           | UUID          | PK, DEFAULT gen_random_uuid()        |
| customer_id  | UUID          | FK -> users(id), NOT NULL            |
| shop_id      | UUID          | FK -> shops(id), NOT NULL            |
| product_id   | UUID          | FK -> products(id), NOT NULL         |
| status       | VARCHAR(20)   |                                      |
| listed_price | DECIMAL(10,2) |                                      |
| final_price  | DECIMAL(10,2) |                                      |
| created_at   | TIMESTAMPTZ   | DEFAULT now()                        |
| expires_at   | TIMESTAMPTZ   |                                      |

### 11. haggle_messages

| Column        | Type          | Constraints                          |
| ------------- | ------------- | ------------------------------------ |
| id            | UUID          | PK, DEFAULT gen_random_uuid()        |
| session_id    | UUID          | FK -> haggle_sessions(id)            |
| sender_role   | VARCHAR(10)   |                                      |
| offer_amount  | DECIMAL(10,2) |                                      |
| message       | TEXT          |                                      |
| ai_suggestion | JSONB         |                                      |
| created_at    | TIMESTAMPTZ   | DEFAULT now()                        |

### 12. deals

| Column          | Type          | Constraints                          |
| --------------- | ------------- | ------------------------------------ |
| id              | UUID          | PK, DEFAULT gen_random_uuid()        |
| shop_id         | UUID          | FK -> shops(id), NOT NULL            |
| product_id      | UUID          | FK -> products(id)                   |
| title           | VARCHAR(200)  |                                      |
| description     | TEXT          |                                      |
| discount_pct    | INT           |                                      |
| discount_amount | DECIMAL(10,2) |                                      |
| starts_at       | TIMESTAMPTZ   | NOT NULL                             |
| expires_at      | TIMESTAMPTZ   | NOT NULL                             |
| is_active       | BOOLEAN       | DEFAULT true                         |
| max_claims      | INT           |                                      |
| current_claims  | INT           | DEFAULT 0                            |
| views           | INT           | DEFAULT 0                            |
| created_at      | TIMESTAMPTZ   | DEFAULT now()                        |

### 13. stories

| Column       | Type        | Constraints                          |
| ------------ | ----------- | ------------------------------------ |
| id           | UUID        | PK, DEFAULT gen_random_uuid()        |
| shop_id      | UUID        | FK -> shops(id), NOT NULL            |
| media_url    | TEXT        | NOT NULL                             |
| media_type   | VARCHAR(10) |                                      |
| caption      | TEXT        |                                      |
| product_tags | UUID[]      |                                      |
| views        | INT         | DEFAULT 0                            |
| expires_at   | TIMESTAMPTZ |                                      |
| created_at   | TIMESTAMPTZ | DEFAULT now()                        |

### 14. shopcoins_ledger

| Column        | Type        | Constraints                          |
| ------------- | ----------- | ------------------------------------ |
| id            | UUID        | PK, DEFAULT gen_random_uuid()        |
| user_id       | UUID        | FK -> users(id), NOT NULL            |
| amount        | INT         | NOT NULL                             |
| balance_after | INT         | NOT NULL                             |
| reason        | VARCHAR(50) |                                      |
| reference_id  | UUID        |                                      |
| created_at    | TIMESTAMPTZ | DEFAULT now()                        |

### 15. badges

| Column      | Type        | Constraints                          |
| ----------- | ----------- | ------------------------------------ |
| id          | UUID        | PK, DEFAULT gen_random_uuid()        |
| user_id     | UUID        | FK -> users(id), NOT NULL            |
| badge_type  | VARCHAR(50) |                                      |
| badge_level | INT         | DEFAULT 1                            |
| earned_at   | TIMESTAMPTZ | DEFAULT now()                        |

**Constraint:** UNIQUE(user_id, badge_type)

### 16. community_posts

| Column        | Type                   | Constraints                          |
| ------------- | ---------------------- | ------------------------------------ |
| id            | UUID                   | PK, DEFAULT gen_random_uuid()        |
| user_id       | UUID                   | FK -> users(id), NOT NULL            |
| post_type     | VARCHAR(20)            |                                      |
| title         | VARCHAR(300)           |                                      |
| body          | TEXT                   |                                      |
| images        | TEXT[]                 |                                      |
| location      | GEOGRAPHY(POINT, 4326) |                                      |
| upvotes       | INT                    | DEFAULT 0                            |
| answers_count | INT                    | DEFAULT 0                            |
| is_resolved   | BOOLEAN                | DEFAULT false                        |
| created_at    | TIMESTAMPTZ            | DEFAULT now()                        |
| updated_at    | TIMESTAMPTZ            | DEFAULT now()                        |

### 17. community_answers

| Column          | Type        | Constraints                          |
| --------------- | ----------- | ------------------------------------ |
| id              | UUID        | PK, DEFAULT gen_random_uuid()        |
| post_id         | UUID        | FK -> community_posts(id)            |
| user_id         | UUID        | FK -> users(id)                      |
| shop_id         | UUID        | FK -> shops(id)                      |
| body            | TEXT        |                                      |
| is_ai_generated | BOOLEAN     | DEFAULT false                        |
| upvotes         | INT         | DEFAULT 0                            |
| created_at      | TIMESTAMPTZ | DEFAULT now()                        |

### 18. follows

| Column     | Type        | Constraints                          |
| ---------- | ----------- | ------------------------------------ |
| id         | UUID        | PK, DEFAULT gen_random_uuid()        |
| user_id    | UUID        | FK -> users(id), NOT NULL            |
| shop_id    | UUID        | FK -> shops(id), NOT NULL            |
| created_at | TIMESTAMPTZ | DEFAULT now()                        |

**Constraint:** UNIQUE(user_id, shop_id)

### 19. user_events

| Column      | Type                   | Constraints                          |
| ----------- | ---------------------- | ------------------------------------ |
| id          | UUID                   | PK, DEFAULT gen_random_uuid()        |
| user_id     | UUID                   | FK -> users(id)                      |
| event_type  | VARCHAR(30)            |                                      |
| entity_type | VARCHAR(20)            |                                      |
| entity_id   | UUID                   |                                      |
| metadata    | JSONB                  |                                      |
| location    | GEOGRAPHY(POINT, 4326) |                                      |
| created_at  | TIMESTAMPTZ            | DEFAULT now()                        |

### 20. search_logs

| Column          | Type                   | Constraints                          |
| --------------- | ---------------------- | ------------------------------------ |
| id              | UUID                   | PK, DEFAULT gen_random_uuid()        |
| user_id         | UUID                   | FK -> users(id)                      |
| query_text      | TEXT                   |                                      |
| query_image_url | TEXT                   |                                      |
| search_type     | VARCHAR(20)            |                                      |
| location        | GEOGRAPHY(POINT, 4326) |                                      |
| results_count   | INT                    |                                      |
| clicked_ids     | UUID[]                 |                                      |
| created_at      | TIMESTAMPTZ            | DEFAULT now()                        |

### 21. reservations

| Column       | Type        | Constraints                          |
| ------------ | ----------- | ------------------------------------ |
| id           | UUID        | PK, DEFAULT gen_random_uuid()        |
| customer_id  | UUID        | FK -> users(id), NOT NULL            |
| product_id   | UUID        | FK -> products(id), NOT NULL         |
| shop_id      | UUID        | FK -> shops(id), NOT NULL            |
| status       | VARCHAR(20) | DEFAULT 'active'                     |
| expires_at   | TIMESTAMPTZ | NOT NULL                             |
| fulfilled_at | TIMESTAMPTZ |                                      |
| created_at   | TIMESTAMPTZ | DEFAULT now()                        |

### 22. notifications

| Column            | Type         | Constraints                          |
| ----------------- | ------------ | ------------------------------------ |
| id                | UUID         | PK, DEFAULT gen_random_uuid()        |
| user_id           | UUID         | FK -> users(id), NOT NULL            |
| title             | VARCHAR(200) |                                      |
| body              | TEXT         |                                      |
| notification_type | VARCHAR(30)  |                                      |
| reference_type    | VARCHAR(20)  |                                      |
| reference_id      | UUID         |                                      |
| is_read           | BOOLEAN      | DEFAULT false                        |
| created_at        | TIMESTAMPTZ  | DEFAULT now()                        |

---

## Indexes

### Spatial (GiST)

```sql
CREATE INDEX idx_shops_location ON shops USING GIST (location);
CREATE INDEX idx_user_events_location ON user_events USING GIST (location);
CREATE INDEX idx_search_logs_location ON search_logs USING GIST (location);
```

### Full-Text Search (GIN)

```sql
CREATE INDEX idx_products_fts ON products USING GIN (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);
```

### Vector Similarity (HNSW)

```sql
CREATE INDEX idx_product_embeddings_image ON product_embeddings
    USING hnsw (image_embedding vector_cosine_ops);
```

### Composite and Partial

```sql
CREATE INDEX idx_products_shop_category ON products (shop_id, category)
    WHERE is_available = true;

CREATE INDEX idx_products_price ON products (price)
    WHERE is_available = true;

CREATE INDEX idx_deals_expires ON deals (expires_at)
    WHERE is_active = true;
```

### JSONB

```sql
CREATE INDEX idx_products_attributes ON products USING GIN (attributes);
```

### B-Tree

```sql
CREATE INDEX idx_orders_customer ON orders (customer_id, created_at DESC);
CREATE INDEX idx_orders_shop_status ON orders (shop_id, status);
CREATE INDEX idx_user_events_user ON user_events (user_id, created_at DESC);
```

---

## Project Structure — Backend

```
nearshop-api/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   ├── auth/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── permissions.py
│   │   └── utils.py
│   ├── shops/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── products/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── orders/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── reviews/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── deals/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── stories/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── haggle/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── loyalty/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── community/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── feed/
│   │   ├── router.py
│   │   └── service.py
│   ├── ai/
│   │   ├── router.py
│   │   ├── cataloging.py
│   │   ├── visual_search.py
│   │   ├── smart_search.py
│   │   ├── pricing.py
│   │   └── recommendations.py
│   ├── notifications/
│   │   ├── service.py
│   │   └── templates.py
│   ├── analytics/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── events.py
│   ├── core/
│   │   ├── database.py
│   │   ├── redis.py
│   │   ├── storage.py
│   │   ├── security.py
│   │   └── exceptions.py
│   └── middleware/
│       ├── auth.py
│       ├── rate_limit.py
│       └── logging.py
├── migrations/
├── tasks/
│   ├── celery_app.py
│   ├── image_tasks.py
│   ├── notification_tasks.py
│   └── ai_tasks.py
├── tests/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── alembic.ini
└── .env.example
```

---

## Project Structure — Frontend

```
nearshop-web/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── api/
│   │   ├── client.js
│   │   ├── auth.js
│   │   ├── shops.js
│   │   ├── products.js
│   │   ├── orders.js
│   │   ├── ai.js
│   │   ├── deals.js
│   │   └── community.js
│   ├── store/
│   │   ├── authStore.js
│   │   ├── cartStore.js
│   │   └── locationStore.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useLocation.js
│   │   └── useCamera.js
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Card.jsx
│   │   │   └── Badge.jsx
│   │   ├── ShopCard.jsx
│   │   ├── ProductCard.jsx
│   │   ├── ProductGrid.jsx
│   │   ├── SearchBar.jsx
│   │   ├── MapView.jsx
│   │   ├── StoryCircle.jsx
│   │   ├── DealBanner.jsx
│   │   ├── RatingStars.jsx
│   │   └── CoinsBadge.jsx
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RoleSelectPage.jsx
│   │   │   ├── CustomerOnboard.jsx
│   │   │   └── BusinessOnboard.jsx
│   │   ├── customer/
│   │   │   ├── HomePage.jsx
│   │   │   ├── SearchPage.jsx
│   │   │   ├── ShopsMapPage.jsx
│   │   │   ├── ShopDetailPage.jsx
│   │   │   ├── ProductDetailPage.jsx
│   │   │   ├── CategoriesPage.jsx
│   │   │   ├── DealsPage.jsx
│   │   │   ├── WishlistPage.jsx
│   │   │   ├── OrdersPage.jsx
│   │   │   ├── HagglePage.jsx
│   │   │   ├── WalletPage.jsx
│   │   │   ├── CommunityPage.jsx
│   │   │   └── ProfilePage.jsx
│   │   └── business/
│   │       ├── DashboardPage.jsx
│   │       ├── CatalogPage.jsx
│   │       ├── SnapListPage.jsx
│   │       ├── OrdersPage.jsx
│   │       ├── DealsCreatorPage.jsx
│   │       ├── StoriesPage.jsx
│   │       ├── HaggleInboxPage.jsx
│   │       ├── AnalyticsPage.jsx
│   │       ├── MarketingPage.jsx
│   │       └── SettingsPage.jsx
│   ├── layouts/
│   │   ├── CustomerLayout.jsx
│   │   └── BusinessLayout.jsx
│   └── utils/
│       ├── formatters.js
│       ├── location.js
│       └── constants.js
├── public/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```
