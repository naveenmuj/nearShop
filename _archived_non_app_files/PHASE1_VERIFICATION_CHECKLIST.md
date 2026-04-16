# Phase 1 Implementation Verification Checklist

**Quick Verification**: Follow these steps to confirm Phase 1 is fully working.

**Estimated Time**: 45 minutes for complete verification  
**Success Criteria**: All checkboxes should be ✓

---

## 🔧 SETUP PHASE (10 minutes)

### Pre-Flight Checks

- [ ] PostgreSQL is running
  ```bash
  # Check PostgreSQL status
  pg_isready
  # Expected: accepting connections
  ```

- [ ] Python 3.10+ installed
  ```bash
  python --version
  # Expected: Python 3.10.x or higher
  ```

- [ ] Node.js 16+ installed
  ```bash
  node --version
  # Expected: v16.x or higher
  ```

- [ ] Dependencies installed (Backend)
  ```bash
  cd nearshop-api
  pip install -r requirements.txt
  # Check for: Successfully installed
  ```

- [ ] Dependencies installed (Mobile)
  ```bash
  cd nearshop-mobile
  npm install
  # Check for: added XX packages
  ```

---

## 📦 BACKEND VERIFICATION (15 minutes)

### 1. Database Migration

```bash
cd nearshop-api

# Run migration
alembic upgrade head

# Expected output:
# INFO [alembic.runtime.migration] Running upgrade ... 
# INFO [alembic.runtime.migration] Running upgrade ... 
# (should see 8+ migrations)
```

- [ ] Migration completed without errors
- [ ] All tables created:
  ```bash
  psql $DATABASE_URL
  \dt
  # Should see: user_addresses, saved_payment_methods, user_profiles, etc.
  ```

### 2. Start Backend Server

```bash
cd nearshop-api
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- [ ] Server started successfully
  ```
  Expected: Uvicorn running on http://127.0.0.1:8000
  ```

### 3. Verify API Health

```bash
# In new terminal
curl http://localhost:8000/api/v1/health

# Expected response:
# {"status": "healthy", "version": "1.0.0"}
```

- [ ] Health check returns 200 OK

### 4. Check Swagger Documentation

```bash
# Open in browser
http://localhost:8000/docs

# Look for these endpoint groups:
# - /api/v1/addresses (8 endpoints)
# - /api/v1/payments/methods (6 endpoints)
# - /api/v1/profile (6 endpoints)
```

- [ ] Swagger UI loads
- [ ] Addresses endpoints visible
- [ ] Payment Methods endpoints visible
- [ ] Profile endpoints visible

### 5. Test Routers Registration

In `nearshop-api/app/main.py`, verify these lines exist:

```python
# Check imports
from app.addresses import router as addresses_router
from app.payments import router as payments_router
from app.profiles import router as profiles_router

# Check registrations
app.include_router(addresses_router)
app.include_router(payments_router)
app.include_router(profiles_router)
```

- [ ] All 3 imports present in main.py
- [ ] All 3 include_router calls present in main.py

### 6. Run Backend Tests

```bash
cd nearshop-api

# Run all tests
pytest tests/test_phase1_features.py -v

# Should see: 45+ passed
```

- [ ] All tests pass
  ```
  Expected: ======================== 45 passed in ~20s ========================
  ```

---

## 📱 MOBILE VERIFICATION (15 minutes)

### 1. Start Mobile Development Server

```bash
cd nearshop-mobile
npm start
```

- [ ] Expo development server started
  ```
  Expected: Metro bundler ready, press a/i to open
  ```

### 2. Verify File Existence

Check these files were created:

- [ ] `nearshop-mobile/app/(customer)/addresses.jsx` exists
  ```bash
  ls -la nearshop-mobile/app/\(customer\)/addresses.jsx
  ```

- [ ] `nearshop-mobile/app/(customer)/payment-methods.jsx` exists
  ```bash
  ls -la nearshop-mobile/app/\(customer\)/payment-methods.jsx
  ```

- [ ] `nearshop-mobile/lib/savedData.js` exists
  ```bash
  ls -la nearshop-mobile/lib/savedData.js
  ```

### 3. Launch App on Emulator/Device

```bash
# In Expo terminal, press:
# a (for Android) or i (for iOS)

# Or build APK
npm run android
npm run ios
```

- [ ] App launches successfully
- [ ] No red error screen

### 4. Navigate to Addresses Screen

In the app:
- [ ] Menu → Profile → Addresses (or direct route)
- [ ] Screen loads without errors
- [ ] Shows empty state: "No addresses saved"
- [ ] "Add Your First Address" button visible

### 5. Test Add Address

- [ ] Tap "Add Your First Address"
- [ ] Form opens with fields:
  - [ ] Label (with dropdown: Home, Work, Other)
  - [ ] Street address
  - [ ] City
  - [ ] State
  - [ ] Postal Code
  - [ ] Phone
- [ ] Fill in sample data:
  ```
  Label: Home
  Street: 123 Main Street
  City: New Delhi
  State: Delhi
  Postal Code: 110001
  Phone: +919876543210
  ```
- [ ] Tap "Add Address"
- [ ] Toast shows: "Address added successfully"
- [ ] Address appears in list
- [ ] Address shows "HOME" label and "Default" tag

### 6. Test Payment Methods Screen

- [ ] Navigate to: Menu → Profile → Payment Methods
- [ ] Screen loads with empty state: "No payment methods saved"
- [ ] "Add Payment Method" button visible
- [ ] Tap "Add Payment Method"
- [ ] Modal shows tabs: Card, UPI, Wallet
- [ ] Switch to UPI tab
- [ ] Enter: `user@okhdfcbank`
- [ ] Tap "Add UPI"
- [ ] Toast shows: "Payment method added"
- [ ] UPI appears in list with:
  - [ ] UPI icon
  - [ ] UPI ID displayed
  - [ ] Delete button
  - [ ] Star (set default) button

### 7. Test Profile Screen

- [ ] Navigate to: Menu → Profile
- [ ] Shows current user info
- [ ] "Edit Profile" or pencil icon visible
- [ ] Stats visible (Orders, Spent, etc.)

---

## 🔗 API INTEGRATION VERIFICATION (10 minutes)

### 1. Test Address API Endpoint

```bash
# First, get an auth token
TOKEN="your_jwt_token_here"

# Create address
curl -X POST http://localhost:8000/api/v1/addresses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "street": "456 Oak Avenue",
    "city": "Bangalore",
    "state": "Karnataka",
    "postal_code": "560001",
    "phone": "+919876543210",
    "label": "work"
  }'

# Expected: 201 Created with address object
```

- [ ] API returns 201 with address object
- [ ] Response includes: id, user_id, is_default, created_at

### 2. Test List Addresses

```bash
curl http://localhost:8000/api/v1/addresses \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with array of addresses
```

- [ ] API returns 200
- [ ] Response includes array with both addresses
- [ ] Addresses ordered by is_default DESC

### 3. Test Payment Methods API

```bash
curl -X POST http://localhost:8000/api/v1/payments/methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "upi",
    "upi_id": "test@okaxis"
  }'

# Expected: 201 Created
```

- [ ] API returns 201 with payment method object
- [ ] Response includes: id, type, is_default

### 4. Test Profile API

```bash
curl http://localhost:8000/api/v1/profile \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with profile object
```

- [ ] API returns 200
- [ ] Profile includes: display_name, email, phone, avatar_url

---

## 📊 END-TO-END TEST (5 minutes)

### Complete User Flow

```
1. Open App
   └─ Select product
   
2. Add to Cart
   └─ Tap "Add to Cart" button
   
3. Open Cart
   └─ Tap Cart icon
   └─ See items
   
4. Checkout
   └─ Tap "Checkout"
   └─ See address selector
   └─ See payment selector
   └─ Address shows: "HOME" with default tag
   └─ Payment shows: UPI method
   
5. Complete Order
   └─ Tap "Place Order"
   └─ See confirmation
```

- [ ] Cart shows items correctly
- [ ] Checkout loads addresses and payments
- [ ] Default address displayed
- [ ] Default payment displayed
- [ ] Can switch address/payment
- [ ] Order can be placed (or fails gracefully)

---

## 🐛 TROUBLESHOOTING VERIFICATION

If any step fails, run these checks:

### Backend Not Starting

```bash
# Check error in terminal, common causes:
1. Port 8000 already in use
   → Kill: lsof -ti:8000 | xargs kill -9
   
2. PostgreSQL not running
   → Start: pg_ctl start
   
3. Environment not set
   → Check: echo $DATABASE_URL
   
4. Missing imports
   → Check: grep "import" app/main.py
```

- [ ] Backend starts after fix

### Mobile Not Connecting

```bash
# Common causes:
1. API_BASE_URL wrong
   → Check lib/savedData.js baseURL setting
   
2. Firewall blocking
   → Disable temporarily to test
   
3. Token expired
   → Login again to get fresh token
   
4. Emulator network
   → Use http://10.0.2.2:8000 on Android
   → Use http://localhost:8000 on iOS
```

- [ ] Mobile connects after fix

### Tests Failing

```bash
# Run with verbose output
pytest tests/test_phase1_features.py -v -s

# Look for specific failure
# Check test output for:
# 1. 404 errors → endpoint not registered
# 2. 401 errors → auth token issue
# 3. 422 errors → validation error
# 4. Database errors → migration not run
```

- [ ] All tests pass after fix

---

## ✅ FINAL CHECKLIST

### Code Changes
- [ ] main.py has 3 router imports
- [ ] main.py has 3 include_router calls
- [ ] addresses.jsx created (530 lines)
- [ ] payment-methods.jsx created (650 lines)
- [ ] savedData.js created (180 lines)
- [ ] e2e.test.js created (500+ lines)
- [ ] test_phase1_features.py created (400+ lines)

### Database
- [ ] 8 tables created
- [ ] All indexes in place
- [ ] Foreign keys configured
- [ ] Constraints working

### API
- [ ] 21 endpoints accessible
- [ ] Authentication working
- [ ] Validation working
- [ ] Error handling working
- [ ] Pagination working

### Mobile UI
- [ ] Addresses screen functional
- [ ] Payment Methods screen functional
- [ ] Profile screen functional
- [ ] Form validation working
- [ ] Toast notifications showing
- [ ] Navigation working

### Testing
- [ ] 45+ backend tests passing
- [ ] 12+ E2E scenarios covered
- [ ] Performance benchmarks met
- [ ] Error cases handled

---

## 🎯 SUCCESS CRITERIA

**Phase 1 is Complete When**:

✅ All backend tests pass  
✅ All API endpoints respond correctly  
✅ Mobile screens load and function  
✅ Address CRUD works end-to-end  
✅ Payment CRUD works end-to-end  
✅ Default assignment works  
✅ Soft delete works  
✅ Checkout integration ready  

---

## 📝 SIGN-OFF

**Run this final validation**:

```bash
# Terminal 1: Backend
cd nearshop-api
pytest tests/test_phase1_features.py -q

# Expected: 45 passed

# Terminal 2: Mobile
cd nearshop-mobile
npm test -- e2e.test.js

# Expected: All tests pass

# Terminal 3: Visual check
# Open http://localhost:8000/docs
# Verify all endpoints listed
```

When all of the above pass → **Phase 1 is Complete ✅**

Next: Phase 2 (Checkout Integration) or Phase 3 (Analytics Dashboard)

---

**Verification Date**: _______________  
**Verified By**: _______________  
**Status**: ☐ PASS ☐ FAIL  

---

For help with specific steps, see:
- **E2E_TESTING_GUIDE.md** - Detailed testing instructions
- **RAZORPAY_INTEGRATION_GUIDE.md** - Payment setup
- **IMPLEMENTATION_SUMMARY.md** - Full feature reference
