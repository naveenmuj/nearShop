# QUICK START: Register Phase 1 Routers

**Current Status**: All backend components ready (✅ 21 endpoints created)
**Next Step**: Register routers in main.py and run migration

---

## Step 1: Update main.py (30 seconds)

Find your app initialization in `nearshop-api/app/main.py`:

```python
# Add these imports at the top
from app.addresses.router import router as addresses_router
from app.payments.router import router as payments_router
from app.profiles.router import router as profiles_router

# In the FastAPI app setup, add these lines:
# (Usually after existing app.include_router() calls)

app.include_router(addresses_router)
app.include_router(payments_router)
app.include_router(profiles_router)
```

---

## Step 2: Run Database Migration (1 minute)

```bash
cd nearshop-api
alembic upgrade head
```

**What this does**:
- Creates 8 new tables in PostgreSQL
- Adds indexes for fast queries
- Sets up foreign key relationships
- Enables soft deletes

---

## Step 3: Test the APIs (5 minutes)

### Using curl to test Address creation:

```bash
# Create an address
curl -X POST http://localhost:8000/api/v1/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "street": "123 Main Street",
    "city": "New Delhi",
    "state": "Delhi",
    "postal_code": "110001",
    "phone": "+919876543210",
    "label": "Home"
  }'

# Should return:
{
  "id": "uuid...",
  "user_id": "uuid...",
  "street": "123 Main Street",
  "city": "New Delhi",
  "state": "Delhi",
  "postal_code": "110001",
  "phone": "+919876543210",
  "label": "Home",
  "is_default": true,  // First address auto-defaults
  "is_billing": false,
  "created_at": "2026-04-16T...",
  "deleted_at": null
}
```

### Using curl to test Payment Method creation:

```bash
# Add a card
curl -X POST http://localhost:8000/api/v1/payments/methods \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "type": "card",
    "card_token": "tok_RAZORPAY_TOKEN_HERE",
    "card_last4": "4111",
    "card_brand": "visa",
    "card_expiry_month": 12,
    "card_expiry_year": 2026
  }'

# Add UPI
curl -X POST http://localhost:8000/api/v1/payments/methods \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "type": "upi",
    "upi_id": "user@okhdfcbank"
  }'
```

### Using curl to test Profile:

```bash
# Get your profile
curl http://localhost:8000/api/v1/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update profile
curl -X PUT http://localhost:8000/api/v1/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "display_name": "John Doe",
    "bio": "Coffee enthusiast",
    "preferred_language": "en",
    "timezone": "Asia/Kolkata"
  }'
```

---

## Step 4: Verify with Postman (Optional)

1. Open Postman
2. Create collection "NearShop Phase 1"
3. Add these folders:
   - Addresses (7 endpoints)
   - Payment Methods (7 endpoints)
   - User Profile (7 endpoints)

4. For each request:
   - Set Authorization header with your JWT token
   - Use the curl examples above to build requests

---

## ✅ VERIFICATION CHECKLIST

After following these steps:

- [ ] main.py has 3 new router imports
- [ ] main.py includes all 3 routers
- [ ] Database migration ran successfully (check PostgreSQL)
- [ ] At least one test address created
- [ ] At least one test payment method created
- [ ] Profile GET returns user data
- [ ] All endpoints return proper JSON responses

---

## 🚀 What's Next?

Once you've verified the APIs are working:

1. **Build Mobile UI**
   - Create AddressListScreen
   - Create PaymentMethodsScreen
   - Create enhanced ProfileScreen

2. **Integrate with Checkout**
   - Load saved addresses on checkout
   - Load saved payments on checkout
   - Add selectors for users to pick

3. **Test Full Flow**
   - Create address → Select in checkout
   - Create payment → Select in checkout
   - Complete order with saved data

---

## 📚 File Reference

**New Backend Files**:
- `app/models_missing_features.py` - 8 ORM models
- `app/schemas_missing_features.py` - 30+ Pydantic schemas
- `app/addresses/service.py` - 9 address methods
- `app/addresses/router.py` - 7 address endpoints
- `app/payments/service.py` - 7 payment methods
- `app/payments/router.py` - 7 payment endpoints
- `app/profiles/service.py` - 9 profile methods
- `app/profiles/router.py` - 7 profile endpoints
- `migrations/versions/2026_04_16_add_missing_features_tables.py` - Database migration

**Documentation**:
- `PHASE1_IMPLEMENTATION_STATUS.md` - Full status and next steps
- `PHASE1_BACKEND_COMPLETE.md` - Completion summary
- `QUICK_START.md` - This file

---

## ⚠️ IMPORTANT NOTES

1. **JWT Token Required**: All endpoints except `/api/v1/profile/public/{id}` require authentication
2. **Database Migration**: Run `alembic upgrade head` before testing
3. **Razorpay Tokens**: Card endpoints expect real Razorpay tokenized values
4. **Owner Verification**: Users can only see/modify their own addresses, payments, profiles

---

**Time to complete**: ~10 minutes
**Ready to proceed?** Run the 3 steps above!
