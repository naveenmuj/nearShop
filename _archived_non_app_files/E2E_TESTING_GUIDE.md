# Phase 1: Complete E2E Integration & Testing Guide

**Date**: April 16, 2026  
**Status**: Ready for Full Testing  
**Estimated Testing Time**: 4-6 hours

---

## 📋 TABLE OF CONTENTS

1. [Quick Start](#quick-start)
2. [Backend Setup](#backend-setup)
3. [API Testing](#api-testing)
4. [Mobile UI Testing](#mobile-ui-testing)
5. [End-to-End Scenarios](#end-to-end-scenarios)
6. [Performance Benchmarks](#performance-benchmarks)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 QUICK START

### Prerequisites
- PostgreSQL running and configured
- Python 3.10+
- Node.js 16+
- npm/yarn
- Postman or curl

### 1. Backend Activation (5 minutes)

```bash
# Navigate to API directory
cd nearshop-api

# Install dependencies (if not already done)
pip install -r requirements.txt

# Create database migration
alembic upgrade head

# Start backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Verify it's running
curl http://localhost:8000/api/v1/health
# Expected: {"status": "healthy", "version": "1.0.0"}
```

### 2. Mobile Setup (5 minutes)

```bash
# Navigate to mobile directory
cd nearshop-mobile

# Install dependencies
npm install

# Start Expo development server
npm start

# Or run on Android/iOS emulator
npm run android  # or npm run ios
```

### 3. Verify Routes Are Registered

```bash
# Check Swagger UI
curl http://localhost:8000/docs

# Look for these new endpoints:
# - POST /api/v1/addresses
# - GET /api/v1/addresses
# - POST /api/v1/payments/methods
# - GET /api/v1/payments/methods
# - GET /api/v1/profile
```

---

## 🔧 BACKEND SETUP

### Database Schema Verification

```bash
# Connect to PostgreSQL and verify new tables exist
psql $DATABASE_URL

# List tables
\dt

# Should see:
# - user_addresses
# - saved_payment_methods
# - user_profiles
# - search_history
# - product_recommendations
# - similar_products
# - notification_preferences
# - notifications
```

### Environment Configuration

Add to `.env`:
```env
# Addresses & Payments Features
FEATURE_SAVED_ADDRESSES=true
FEATURE_SAVED_PAYMENTS=true
FEATURE_USER_PROFILES=true

# Razorpay (get from dashboard)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# API Configuration
API_BASE_URL=http://localhost:8000
API_TIMEOUT=10
```

---

## 🧪 API TESTING

### Option 1: Using Pytest (Recommended)

```bash
# Navigate to API directory
cd nearshop-api

# Install testing dependencies
pip install pytest pytest-asyncio httpx

# Run all Phase 1 tests
pytest tests/test_phase1_features.py -v

# Run specific test class
pytest tests/test_phase1_features.py::TestAddressesAPI -v

# Run with coverage
pytest tests/test_phase1_features.py --cov=app --cov-report=html
```

**Expected Output**:
```
tests/test_phase1_features.py::TestAddressesAPI::test_create_address PASSED    [5%]
tests/test_phase1_features.py::TestAddressesAPI::test_list_addresses PASSED    [10%]
...
======================== 45 passed in 12.34s ========================
```

### Option 2: Using Postman

1. **Create Collection**: "NearShop Phase 1"

2. **Add Requests**:

```
GET /api/v1/health
├── Headers: 
│   └── Accept: application/json
├── Expected: {"status": "healthy"}

POST /api/v1/addresses
├── Headers:
│   ├── Authorization: Bearer YOUR_JWT_TOKEN
│   └── Content-Type: application/json
├── Body:
│   {
│     "street": "123 Main Street",
│     "city": "New Delhi",
│     "state": "Delhi",
│     "postal_code": "110001",
│     "phone": "+919876543210",
│     "label": "home",
│     "lat": 28.7041,
│     "lng": 77.1025
│   }
├── Expected: 201 Created with address object

GET /api/v1/addresses
├── Headers:
│   └── Authorization: Bearer YOUR_JWT_TOKEN
├── Params:
│   ├── skip: 0
│   └── limit: 10
├── Expected: 200 OK with list of addresses

POST /api/v1/payments/methods
├── Headers:
│   ├── Authorization: Bearer YOUR_JWT_TOKEN
│   └── Content-Type: application/json
├── Body (Card):
│   {
│     "type": "card",
│     "card_token": "tok_123",
│     "card_last4": "4111",
│     "card_brand": "Visa",
│     "card_expiry_month": 12,
│     "card_expiry_year": 2026
│   }
├── Body (UPI):
│   {
│     "type": "upi",
│     "upi_id": "user@okhdfcbank"
│   }
├── Expected: 201 Created

GET /api/v1/profile
├── Headers:
│   └── Authorization: Bearer YOUR_JWT_TOKEN
├── Expected: 200 OK with profile object
```

### Option 3: Using Curl

```bash
# Get authentication token first
TOKEN="your_jwt_token_here"

# Create address
curl -X POST http://localhost:8000/api/v1/addresses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "street": "123 Main Street",
    "city": "New Delhi",
    "state": "Delhi",
    "postal_code": "110001",
    "phone": "+919876543210",
    "label": "home"
  }'

# List addresses
curl http://localhost:8000/api/v1/addresses \
  -H "Authorization: Bearer $TOKEN"

# Create payment method
curl -X POST http://localhost:8000/api/v1/payments/methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "upi",
    "upi_id": "user@okhdfcbank"
  }'

# Get profile
curl http://localhost:8000/api/v1/profile \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📱 MOBILE UI TESTING

### Test Addresses Screen

```bash
# 1. Navigate to Addresses
# Menu → Profile → Addresses (or direct URL)

# 2. Test empty state
# Should see: "No addresses saved" with "Add Your First Address" button

# 3. Test add address
# Tap "Add Your First Address"
# Fill in:
#   - Label: Home (should auto-select)
#   - Street: 123 Main Street
#   - City: New Delhi
#   - State: Delhi
#   - Postal Code: 110001
#   - Phone: +919876543210
# Tap "Add Address"
# Expected: Toast "Address added" + return to list showing new address

# 4. Test address display
# Should see address card with:
#   - "HOME" label
#   - Full address
#   - Phone number
#   - "Default" tag
#   - Edit, Delete buttons

# 5. Test add second address
# Tap "+" FAB or "Add" button
# Fill with Work address
# Tap "Add Address"
# Expected: Two addresses shown, first still marked "Default"

# 6. Test set as default
# Tap star icon on Work address
# Expected: Toast "Set as default" + Work address now shows "Default" tag

# 7. Test edit address
# Tap edit icon
# Change city to "Bangalore"
# Tap "Update Address"
# Expected: Address updated in list

# 8. Test delete address
# Tap delete icon
# Confirm deletion
# Expected: Toast "Address deleted" + address removed from list
```

### Test Payment Methods Screen

```bash
# 1. Navigate to Payment Methods
# Menu → Profile → Payment Methods

# 2. Test empty state
# Should see: "No payment methods saved" + "Add Payment Method" button

# 3. Test add UPI
# Tap "Add Payment Method"
# Or tap "+" FAB
# Select UPI (bottom tab)
# Enter: user@okhdfcbank
# Tap "Add UPI"
# Expected: Toast "Payment method added" + UPI card shown

# 4. Test payment display
# Should see:
#   - "UPI" label
#   - UPI ID
#   - Delete button
#   - If first method: "Default" tag

# 5. Test add card
# Tap "+" FAB
# Select Card tab
# Tap "Link Card with Razorpay"
# Expected: Razorpay modal opens (or in test: simulates card linking)
# Simulated response: VISA ••• 4111 shown
# Tap "Add Card"
# Expected: Card method added

# 6. Test set as default
# If card is not default, tap star
# Expected: Toast "Set as default" + card now shows "Default"

# 7. Test delete payment
# Tap delete icon on UPI
# Confirm
# Expected: Toast "Payment method removed" + UPI deleted
```

### Test Profile Screen

```bash
# 1. Navigate to Profile
# Menu → Profile

# 2. Test view profile
# Should see:
#   - User avatar (or placeholder)
#   - Display name
#   - Stats: Orders, Spent, Rating
#   - Any badges earned
#   - Edit profile button

# 3. Test update profile
# Tap "Edit Profile" or pencil icon
# Change display name to "John Updated"
# Change bio to "Coffee enthusiast"
# Change timezone to "Asia/Kolkata"
# Tap "Update"
# Expected: Profile updated + displayed name changes

# 4. Test upload avatar
# Tap avatar area
# Select image from gallery or camera
# Expected: Avatar uploaded + displayed

# 5. Test stats
# Should show:
#   - Total Orders: Number of orders
#   - Amount Spent: Total amount
#   - Avg Rating: User's average rating
#   - Badges: Any achievements unlocked
```

---

## 🔗 END-TO-END SCENARIOS

### Scenario 1: Complete Checkout with Saved Data

**Duration**: 5 minutes  
**Expected Success Rate**: 100%

```
1. App Start
   └─ Load user data
   
2. Navigate to Product
   └─ View product details
   └─ Tap "Add to Cart"
   
3. Open Cart
   └─ See items
   └─ Tap "Checkout"
   
4. Checkout Screen
   └─ Load default address
   └─ Load default payment
   └─ Load saved address list
   └─ Load saved payment methods
   
5. Address Selection
   └─ Tap "Change Address"
   └─ Select from saved addresses
   └─ Or add new address
   
6. Payment Selection
   └─ Tap "Change Payment"
   └─ Select saved payment method
   └─ Or add new payment
   
7. Confirm Order
   └─ Tap "Place Order"
   └─ Process payment
   └─ Show order confirmation
   
✅ SUCCESS: Order placed with saved address and payment
```

### Scenario 2: Multiple Addresses Management

**Duration**: 10 minutes

```
1. Go to Addresses Screen
2. Add 3 addresses: Home, Work, Parent's House
3. List should show all 3
4. Mark Work as default
   └─ Work should show "Default" tag
   └─ Home should lose "Default" tag
5. Mark Home as billing
   └─ Home should show "Billing" tag
6. Go to checkout
   └─ Shipping address should be Work
   └─ Billing address should be Home
7. Switch to Parent's House as shipping
   └─ Checkout updates immediately
8. Delete Work address
   └─ Parent's House becomes default
   
✅ SUCCESS: All address operations work seamlessly
```

### Scenario 3: Payment Method Transitions

**Duration**: 10 minutes

```
1. Go to Payment Methods Screen
2. Add: Card, UPI, Wallet (3 methods)
3. List shows all 3, Card is default
4. Go to Checkout
   └─ Card is pre-selected
5. Switch to UPI
   └─ UPI shows selected
6. Place order
   └─ Payment goes through UPI
7. Go back to Payment Methods
8. Change default to Wallet
9. Go to Checkout
   └─ Wallet is now default
10. Delete Wallet
    └─ UPI becomes default
    
✅ SUCCESS: Payment switching works without friction
```

---

## 📊 PERFORMANCE BENCHMARKS

Run these performance tests and record results:

### API Performance

```bash
# Run performance tests
pytest tests/test_phase1_features.py::TestPerformance -v

# Expected Results:
# - List 50 addresses: < 1000ms
# - Create address: < 500ms
# - Set default address: < 300ms
# - Get default address: < 200ms
```

### Mobile Performance

```bash
# On physical device or emulator
# Open DevTools (press 'd' in Expo terminal)
# Go to Performance tab

# Measure:
# - Addresses screen load: < 2 seconds
# - Add address form: < 1 second
# - Payment methods list: < 1.5 seconds
# - Checkout integration: < 2 seconds
```

### Database Queries

```bash
# Check query performance with EXPLAIN ANALYZE
psql $DATABASE_URL

EXPLAIN ANALYZE
SELECT * FROM user_addresses 
WHERE user_id = 'xxx' 
AND deleted_at IS NULL 
ORDER BY is_default DESC, created_at DESC;

# Should use index and complete in < 10ms
```

---

## 📋 TEST CHECKLIST

### Backend Tests
- [ ] All 45 Pytest tests passing
- [ ] No SQL errors in database
- [ ] All migrations applied successfully
- [ ] Soft deletes working (deleted_at set)
- [ ] Default assignment working (only one default per type)
- [ ] Owner verification working (403 when accessing others' data)
- [ ] Validation errors returning 422
- [ ] Error messages clear and actionable

### API Tests (Postman)
- [ ] Create address: 201 ✓
- [ ] List addresses: 200 ✓
- [ ] Update address: 200 ✓
- [ ] Set default: 200 ✓
- [ ] Get default address: 200 ✓
- [ ] Create payment: 201 ✓
- [ ] List payments: 200 ✓
- [ ] Set default payment: 200 ✓
- [ ] Get profile: 200 ✓
- [ ] Update profile: 200 ✓

### Mobile UI Tests
- [ ] Addresses screen loads
- [ ] Can add address
- [ ] Can edit address
- [ ] Can delete address
- [ ] Can set as default
- [ ] Can set as billing
- [ ] Payment methods screen loads
- [ ] Can add card
- [ ] Can add UPI
- [ ] Can add wallet
- [ ] Can set as default
- [ ] Can delete payment
- [ ] Profile screen shows stats
- [ ] Can update profile

### E2E Integration Tests
- [ ] Complete checkout with saved address
- [ ] Complete checkout with saved payment
- [ ] Address switching in checkout
- [ ] Payment switching in checkout
- [ ] Multiple addresses managed correctly
- [ ] Multiple payments managed correctly
- [ ] Default reassignment works
- [ ] Delete and re-add works
- [ ] No data leakage between users

### Performance Tests
- [ ] API endpoints < expected times
- [ ] Mobile screens load < 2s
- [ ] Database queries < 10ms
- [ ] No memory leaks after repeated operations
- [ ] Pagination works with large datasets

---

## 🐛 TROUBLESHOOTING

### Issue: 404 on address endpoints

**Solution**:
```bash
# Check routers are registered in main.py
grep "include_router" nearshop-api/app/main.py

# Should have:
# app.include_router(addresses_router)
# app.include_router(payments_router)
# app.include_router(profiles_router)

# Restart backend:
# Kill process and start again
```

### Issue: 401 Unauthorized on all endpoints

**Solution**:
```bash
# Get a valid JWT token first
# Use login endpoint to get token:
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "password": "password"}'

# Copy access_token from response
# Use it in Authorization header:
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Issue: Database migration fails

**Solution**:
```bash
# Check PostgreSQL is running
pg_isready

# Check DATABASE_URL is correct
echo $DATABASE_URL

# Try manual migration
alembic upgrade head -v

# If locked, reset:
alembic downgrade -1
alembic upgrade head

# Check new tables:
psql $DATABASE_URL
\dt user_addresses
```

### Issue: Mobile shows "Failed to load addresses"

**Solution**:
```bash
# 1. Check backend is running
curl http://localhost:8000/api/v1/health

# 2. Check network reachability from device
# On Android/iOS emulator, use:
# http://10.0.2.2:8000 (Android)
# http://localhost:8000 (iOS simulator)

# 3. Check CORS headers
curl -i http://localhost:8000/api/v1/addresses

# Should have:
# Access-Control-Allow-Origin: *

# 4. Check auth token is valid
# Print token in app console
console.log('Token:', authToken);
```

### Issue: "No default payment method set" on checkout

**Solution**:
```bash
# This is expected if user has no saved payments
# Handle in checkout:
if (!defaultPayment) {
  // Show payment form
} else {
  // Use saved payment
}

# Or implement auto-create:
if (!defaultPayment) {
  await createPaymentMethod(formData);
  await setDefaultPaymentMethod(methodId);
}
```

---

## ✅ SIGN-OFF CHECKLIST

When all tests pass, verify:

- [ ] Backend routers registered
- [ ] Database migration applied
- [ ] All 45 API tests passing
- [ ] All mobile UI screens working
- [ ] Checkout integration complete
- [ ] E2E scenarios passing
- [ ] Performance benchmarks met
- [ ] Error messages clear
- [ ] Documentation updated

**Ready for**: Mobile beta testing, Production deployment

---

## 📞 SUPPORT

### Common Questions

**Q: Can users delete their default address?**
A: Yes, the app will automatically assign the next address as default. If it's the last address, that address becomes default again.

**Q: Can users have multiple default addresses?**
A: No, the system enforces one default per type (shipping/billing). Attempting to set another as default unsets the previous one.

**Q: Is card data encrypted?**
A: Card data never touches our servers - we only store Razorpay tokens. Full encryption ready to implement.

**Q: How long does address validation take?**
A: < 200ms including Google Maps API call for coordinates.

**Q: Can users recover deleted addresses?**
A: Yes, soft deletes mean data is preserved. Admin dashboard can recover if needed.

---

**Status**: Ready for comprehensive testing  
**Last Updated**: April 16, 2026  
**Next Steps**: Run test suite and gather metrics
