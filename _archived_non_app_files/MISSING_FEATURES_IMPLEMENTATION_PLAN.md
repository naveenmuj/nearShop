# NearShop Missing Features - Implementation Plan v2.0

**Created**: April 16, 2026  
**Status**: Planning Phase  
**Scope**: High-Priority Missing Features (Phases 1-2)  
**Approach**: Database-Backed, Clean Architecture, No Hardcoding

---

## 📋 Implementation Roadmap

### Phase 1: Core Data Features (Week 1)
**Estimated**: 3-4 days  
**Priority**: HIGH (Directly impacts revenue & UX)

1. **Saved Addresses** - Checkout UX improvement
2. **Saved Payment Methods** - Faster repeat purchases
3. **User Profiles/Avatars** - Personalization foundation

### Phase 2: Smart Features (Week 2)
**Estimated**: 2-3 days  
**Priority**: MEDIUM (Engagement & AOV boost)

1. **Product Recommendations** - AI-powered "For You"
2. **Similar Products** - Cross-sell on detail page
3. **Search History** - Persistent user searches

### Phase 3: Communications (Week 3)
**Estimated**: 2-3 days  
**Priority**: MEDIUM (Engagement)

1. **Email Notifications** - Transactional & marketing
2. **SMS Notifications** - Order alerts
3. **Notification Preferences** - User control

---

## 🗄️ DATABASE SCHEMA DESIGN

### NEW TABLES TO CREATE

#### 1. `user_addresses`
```sql
CREATE TABLE user_addresses (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Address Details
  label VARCHAR(50),  -- "Home", "Office", "Other"
  street VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'India',
  
  -- Location
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Contact
  phone VARCHAR(20),
  alternate_phone VARCHAR(20),
  
  -- Flags
  is_default BOOLEAN DEFAULT FALSE,
  is_billing BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL,  -- Soft delete
  
  CONSTRAINT unique_default_address 
    UNIQUE (user_id, is_default) WHERE is_default = TRUE
);

CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
```

#### 2. `saved_payment_methods`
```sql
CREATE TABLE saved_payment_methods (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Payment Type: "razorpay_card", "upi", "wallet"
  payment_type VARCHAR(50),
  
  -- Card Data (encrypted)
  card_last_4 VARCHAR(4),
  card_brand VARCHAR(50),  -- "visa", "mastercard"
  card_expiry VARCHAR(5),
  card_token VARCHAR(500),  -- Tokenized (never store full card)
  
  -- UPI Data
  upi_id VARCHAR(255),
  
  -- Wallet Data
  wallet_id VARCHAR(255),
  wallet_balance DECIMAL(10, 2),
  
  -- Flags
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  display_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_default_payment 
    UNIQUE (user_id, is_default) WHERE is_default = TRUE
);

CREATE INDEX idx_saved_payments_user_id ON saved_payment_methods(user_id);
```

#### 3. `user_profiles`
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  
  -- Profile Info
  display_name VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(500),
  avatar_key VARCHAR(255),  -- S3 key for deletion
  
  -- Preferences
  preferred_language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  
  -- Stats
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(12, 2) DEFAULT 0,
  avg_rating DECIMAL(3, 2),
  badges JSONB,  -- Array of badge IDs earned
  
  -- Account
  phone_verified_at TIMESTAMP,
  email_verified_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
```

#### 4. `search_history`
```sql
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  
  search_query VARCHAR(500),
  search_type VARCHAR(20),  -- "product", "shop", "combined"
  
  -- Optional filters used
  filters JSONB,  -- {minPrice, maxPrice, category, rating}
  result_count INT,
  clicked_result_id UUID,  -- If user clicked a result
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Anonymous searches (no user_id)
  session_id VARCHAR(255) NULL,
  device_id VARCHAR(255) NULL
);

CREATE INDEX idx_search_history_user_id ON search_history(user_id);
CREATE INDEX idx_search_history_query ON search_history USING GIN(to_tsvector('english', search_query));
```

#### 5. `product_recommendations`
```sql
CREATE TABLE product_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID NOT NULL REFERENCES products(id),
  
  -- Recommendation Type
  reason VARCHAR(50),  -- "view_based", "purchase_based", "trending", "similar"
  
  -- Scoring
  score DECIMAL(5, 2),  -- 0-100 confidence score
  model_version VARCHAR(20),  -- For tracking ML model changes
  
  -- Engagement Tracking
  shown_at TIMESTAMP,
  clicked_at TIMESTAMP,
  purchased_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  CONSTRAINT unique_user_product_rec 
    UNIQUE (user_id, product_id, reason)
);

CREATE INDEX idx_recommendations_user_id ON product_recommendations(user_id);
CREATE INDEX idx_recommendations_expires ON product_recommendations(expires_at);
```

#### 6. `similar_products`
```sql
CREATE TABLE similar_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  similar_product_id UUID NOT NULL REFERENCES products(id),
  
  -- Similarity Reason
  similarity_reason VARCHAR(50),  -- "category", "price_range", "material", "brand"
  
  -- Scoring
  similarity_score DECIMAL(5, 2),  -- 0-100
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP,
  
  CONSTRAINT prevent_self_reference 
    CHECK (product_id != similar_product_id)
);

CREATE INDEX idx_similar_products_product_id ON similar_products(product_id);
```

#### 7. `notification_preferences`
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  
  -- Push Notifications
  push_orders BOOLEAN DEFAULT TRUE,
  push_deals BOOLEAN DEFAULT TRUE,
  push_messages BOOLEAN DEFAULT TRUE,
  push_news BOOLEAN DEFAULT FALSE,
  
  -- Email Notifications
  email_orders BOOLEAN DEFAULT TRUE,
  email_deals BOOLEAN DEFAULT TRUE,
  email_weekly_digest BOOLEAN DEFAULT FALSE,
  email_news BOOLEAN DEFAULT FALSE,
  
  -- SMS Notifications
  sms_orders BOOLEAN DEFAULT TRUE,
  sms_deals BOOLEAN DEFAULT FALSE,
  
  -- Quiet Hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,  -- e.g., "22:00"
  quiet_hours_end TIME,    -- e.g., "08:00"
  
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_prefs_user_id ON notification_preferences(user_id);
```

#### 8. `notifications` (Main notification log)
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Notification Content
  type VARCHAR(50),  -- "order_status", "price_drop", "message", "deal"
  title VARCHAR(255),
  body TEXT,
  data JSONB,  -- Contextual data: {orderId, productId, etc}
  
  -- Delivery Channels
  push_sent BOOLEAN DEFAULT FALSE,
  push_sent_at TIMESTAMP,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP,
  sms_sent BOOLEAN DEFAULT FALSE,
  sms_sent_at TIMESTAMP,
  
  -- Engagement
  read_at TIMESTAMP,
  clicked_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

---

## 🔌 API ENDPOINTS TO CREATE

### Phase 1: Addresses API

```
POST   /api/v1/addresses
  → Create new address
  ← { id, label, street, city, is_default }

GET    /api/v1/addresses
  → Get all user addresses
  ← [{ id, label, street, city, is_default, is_billing }]

GET    /api/v1/addresses/:id
  → Get single address details
  ← { id, label, street, city, state, postal_code, phone, latitude, longitude }

PUT    /api/v1/addresses/:id
  → Update address
  ← { id, ...updatedFields }

DELETE /api/v1/addresses/:id
  → Delete address (soft delete)
  ← { success: true }

POST   /api/v1/addresses/:id/set-default
  → Set as default shipping address
  ← { id, is_default: true }

POST   /api/v1/addresses/:id/set-billing
  → Set as billing address
  ← { id, is_billing: true }
```

### Phase 1: Saved Payment Methods API

```
POST   /api/v1/payments/methods
  → Add payment method (with tokenization)
  ← { id, card_last_4, card_brand, is_default }

GET    /api/v1/payments/methods
  → Get all saved payment methods
  ← [{ id, payment_type, card_last_4, upi_id, is_default }]

PUT    /api/v1/payments/methods/:id/set-default
  → Set as default payment method
  ← { id, is_default: true }

DELETE /api/v1/payments/methods/:id
  → Delete payment method
  ← { success: true }

POST   /api/v1/payments/validate
  → Validate card/payment method
  ← { valid: true, message: "Card verified" }
```

### Phase 1: User Profile API

```
GET    /api/v1/users/me/profile
  → Get current user profile
  ← { displayName, bio, avatarUrl, totalOrders, avgRating, badges }

PUT    /api/v1/users/me/profile
  → Update user profile
  ← { displayName, bio, avatarUrl }

POST   /api/v1/users/me/avatar
  → Upload new avatar (multipart/form-data)
  ← { avatarUrl, updatedAt }

DELETE /api/v1/users/me/avatar
  → Delete avatar
  ← { success: true }

GET    /api/v1/users/:userId/profile
  → Get public user profile
  ← { displayName, avatarUrl, totalOrders, avgRating }
```

### Phase 2: Product Recommendations API

```
GET    /api/v1/recommendations/for-you
  → Get "For You" recommendations
  ← [{ id, name, price, rating, score, reason }]

GET    /api/v1/recommendations/trending
  → Get trending products
  ← [{ id, name, price, rating, trendingScore }]

GET    /api/v1/products/:id/similar
  → Get similar products for a product
  ← [{ id, name, price, similarityReason, similarityScore }]
```

### Phase 2: Search History API

```
GET    /api/v1/search/history
  → Get user's search history
  ← [{ query, searchType, createdAt, filters }]

POST   /api/v1/search/history
  → Save search query
  ← { id, query }

DELETE /api/v1/search/history/:id
  → Delete search history item
  ← { success: true }

POST   /api/v1/search/history/clear
  → Clear all search history
  ← { deletedCount: 15 }
```

### Phase 3: Notifications API

```
POST   /api/v1/notifications/preferences
  → Update notification preferences
  ← { pushOrders, emailOrders, smsOrders, quietHours }

GET    /api/v1/notifications/preferences
  → Get notification preferences
  ← { pushOrders, emailOrders, smsOrders }

GET    /api/v1/notifications
  → Get user notifications (with pagination)
  ← [{ id, type, title, body, read, createdAt }]

POST   /api/v1/notifications/:id/mark-read
  → Mark notification as read
  ← { id, readAt }

POST   /api/v1/notifications/mark-all-read
  → Mark all notifications as read
  ← { markedCount: 5 }

DELETE /api/v1/notifications/:id
  → Delete notification
  ← { success: true }
```

---

## 🏗️ BACKEND IMPLEMENTATION STRUCTURE

### New Directories
```
nearshop-api/app/
├── addresses/
│   ├── models.py          # SQLAlchemy models
│   ├── schemas.py         # Pydantic request/response
│   ├── service.py         # Business logic
│   └── router.py          # API endpoints
│
├── payments/
│   ├── models.py          # Payment method models
│   ├── schemas.py         # Pydantic schemas
│   ├── service.py         # Payment logic
│   ├── tokens.py          # Tokenization service
│   └── router.py          # API endpoints
│
├── profiles/
│   ├── models.py          # User profile models
│   ├── schemas.py         # Pydantic schemas
│   ├── service.py         # Profile logic
│   ├── avatar.py          # Avatar upload/storage
│   └── router.py          # API endpoints
│
├── recommendations/
│   ├── models.py          # Recommendation models
│   ├── service.py         # ML-based recommendation logic
│   ├── engine.py          # Recommendation algorithm
│   └── router.py          # API endpoints
│
├── search/
│   ├── models.py          # Search history models
│   ├── service.py         # Search logic
│   └── router.py          # API endpoints
│
└── notifications/
    ├── models.py          # Notification models
    ├── schemas.py         # Pydantic schemas
    ├── service.py         # Notification logic
    ├── email_service.py   # Email sending (via SendGrid/Resend)
    ├── sms_service.py     # SMS sending (via Twilio)
    ├── push_service.py    # Push notifications (via FCM)
    └── router.py          # API endpoints
```

---

## 📱 MOBILE IMPLEMENTATION STRUCTURE

### New Screens/Components
```
nearshop-mobile/app/(customer)/
├── addresses.jsx          # View/manage addresses
├── payment-methods.jsx    # View/manage saved cards
├── profile.jsx            # User profile (enhanced)
│
app/(customer)/checkout/
├── address-selector.jsx   # Select address from saved
├── payment-selector.jsx   # Select from saved cards
│
components/
├── AddressCard.jsx        # Reusable address display
├── PaymentCard.jsx        # Reusable payment method display
├── AvatarUpload.jsx       # Avatar picker/uploader
└── ProfileBanner.jsx      # User profile header
```

---

## 🔐 SECURITY CONSIDERATIONS

### Payment Data
- ✅ **Never store raw card data** - Use tokenization (Razorpay tokens)
- ✅ **Encrypt sensitive fields** - Use column-level encryption for UPI IDs
- ✅ **PCI DSS compliant** - Delegate to Razorpay (they handle storage)
- ✅ **Audit logging** - Log all payment method modifications

### User Data
- ✅ **Address validation** - Verify lat/lng coordinates
- ✅ **Rate limiting** - Limit API calls per user
- ✅ **GDPR compliance** - Allow data export/deletion

### Notification Data
- ✅ **Preference enforcement** - Check user preferences before sending
- ✅ **Unsubscribe links** - All emails include opt-out

---

## 📊 DATA MIGRATION PLAN

### Existing User Migration
```python
# Pseudo-code for data migration

# 1. For all existing users, create default profile
for user in User.all():
    UserProfile.create(
        user_id=user.id,
        display_name=user.name,
        avatar_url=user.avatar_url or None,
        total_orders=len(user.orders),
        total_spent=sum(order.total for order in user.orders)
    )
    
    # 2. Create default notification preferences
    NotificationPreferences.create(
        user_id=user.id,
        push_orders=True,
        email_orders=True,
        sms_orders=True
    )

# 3. Migrate existing address if present
for user in User.all():
    if user.address:
        UserAddress.create(
            user_id=user.id,
            street=user.address.street,
            city=user.address.city,
            state=user.address.state,
            postal_code=user.address.postal_code,
            latitude=user.address.latitude,
            longitude=user.address.longitude,
            is_default=True
        )
```

---

## 🧪 TESTING STRATEGY

### Unit Tests
- Address CRUD operations
- Payment method validation
- Recommendation algorithm accuracy
- Search history filtering

### Integration Tests
- Checkout with saved address
- Payment with saved card
- Notification delivery pipeline

### E2E Tests
- Full checkout flow with saved data
- Profile update and avatar upload
- Search and recommendations

---

## 📅 TIMELINE

| Phase | Feature | Est. Time | Dependencies |
|-------|---------|-----------|--------------|
| 1 | Addresses | 1 day | None |
| 1 | Payment Methods | 1.5 days | Razorpay API |
| 1 | User Profiles | 1 day | Avatar storage |
| 2 | Recommendations | 2 days | Recommendation engine |
| 2 | Similar Products | 1 day | Product similarity logic |
| 3 | Email Notifications | 1.5 days | SendGrid/Resend API |
| 3 | SMS Notifications | 1 day | Twilio API |
| 3 | Notification Preferences | 0.5 days | None |

**Total**: ~10 days of focused development

---

## ✅ SUCCESS CRITERIA

### Phase 1 Complete When:
- [ ] All address CRUD APIs working
- [ ] Payment methods stored securely
- [ ] User can select saved address during checkout
- [ ] User can select saved payment method during checkout
- [ ] Profile page shows/edits all user info
- [ ] Avatar upload/delete works

### Phase 2 Complete When:
- [ ] "For You" recommendations appear on home
- [ ] Similar products show on product detail
- [ ] Search history persists and suggests

### Phase 3 Complete When:
- [ ] Email notifications sent for orders
- [ ] SMS sent for critical updates
- [ ] User can control preferences
- [ ] Notifications appear in app

---

## 🚨 RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Payment data breach | Use Razorpay tokenization, never store raw cards |
| Slow recommendations | Cache results, run async, use Redis |
| High API latency | Paginate results, lazy load features |
| User confusion with new features | Add onboarding, tooltips, help text |

---

**Next Step**: Approve this plan, then begin Phase 1 implementation with Saved Addresses.
