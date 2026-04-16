# Razorpay Payment Integration - Quick Start Guide

## ⚡ Get Started in 10 Minutes

### Step 1: Configure Environment (2 min)

Create/update `.env` file:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_Se0IvnodYcJICB
RAZORPAY_KEY_SECRET=y6znuVjA3XtS9okM3Zel44gI
RAZORPAY_MODE=test

# Webhook Configuration
RAZORPAY_WEBHOOK_SECRET=webhook_secret_test_key
RAZORPAY_WEBHOOK_URL=https://api.nearshop.local/api/v1/payments/webhooks/razorpay

# Feature Flags
ENABLE_CARD_PAYMENTS=true
ENABLE_UPI_PAYMENTS=true
ENABLE_WALLET_PAYMENTS=true
ENABLE_NETBANKING=true

# Environment
ENVIRONMENT=development
```

### Step 2: Install Dependencies (1 min)

```bash
pip install razorpay
pip install pytest pytest-asyncio httpx  # For testing
```

### Step 3: Verify Configuration (1 min)

```bash
python -c "from app.payments.config import RazorpayConfig; print(RazorpayConfig.get_display_config())"
```

Expected output:
```
{'environment': 'development', 'is_production': False, 'key_id': 'rzp_test_Se0IvnodYcJ***', ...}
```

### Step 4: Run Tests (3 min)

```bash
# Run all tests
pytest tests/razorpay_e2e_tests.py -v

# Or specific scenario
pytest tests/razorpay_e2e_tests.py::TestRazorpayIntegration::test_razorpay_keys_configured -v
```

### Step 5: Start Server (2 min)

```bash
# Make sure main.py registers payment routes
# Then start the server
python -m uvicorn app.main:app --reload
```

### Step 6: Test API (1 min)

```bash
# Get payment configuration
curl http://localhost:8000/api/v1/payments/config

# Get test cards
curl http://localhost:8000/api/v1/payments/config | jq '.test_cards'
```

---

## 🎯 Key API Endpoints

### Payment Methods
```bash
# Save a card
POST /api/v1/payments/methods
{
  "type": "card",
  "card_token": "rzp_test_token_4111",
  "card_last4": "1111",
  "card_brand": "Visa",
  "card_expiry_month": 12,
  "card_expiry_year": 2025
}

# Save UPI
POST /api/v1/payments/methods
{
  "type": "upi",
  "upi_id": "testuser@okhdfcbank"
}

# List payment methods
GET /api/v1/payments/methods

# Get default payment
GET /api/v1/payments/methods/default
```

### Orders
```bash
# Create order
POST /api/v1/orders
{
  "items": [
    {"product_id": "1", "quantity": 2, "price": 299.99}
  ],
  "shipping_address_id": "addr_1",
  "billing_address_id": "addr_1",
  "total_amount": 599.98,
  "discount_amount": 50.00,
  "delivery_fee": 40.00
}

# List orders
GET /api/v1/orders

# Get order details
GET /api/v1/orders/{order_id}
```

### Configuration
```bash
# Get payment config (public)
GET /api/v1/payments/config
```

---

## 🧪 Test Cards

| Card Type | Number | Expiry | CVV | Status |
|-----------|--------|--------|-----|--------|
| Visa | 4111111111111111 | 12/25 | 123 | ✅ Success |
| Mastercard | 5555555555554444 | 12/25 | 123 | ✅ Success |
| Amex | 378282246310005 | 12/25 | 123 | ✅ Success |
| Declined | 4000000000000002 | 12/25 | 123 | ❌ Declined |

**Test UPI IDs**:
- `success@okhdfcbank`
- `testuser@okaxis`
- `customer@okhdfcbank`

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `RAZORPAY_INTEGRATION.md` | Complete setup and feature guide |
| `RAZORPAY_SETUP_CHECKLIST.md` | Detailed implementation checklist |
| `RAZORPAY_IMPLEMENTATION_SUMMARY.md` | Overview of all files and integration |
| `QUICKSTART.md` | This file - quick start guide |

---

## 🔧 Code Structure

```
app/payments/
├── __init__.py                    # Module initialization
├── razorpay_service.py           # Payment service (main logic)
├── routes.py                      # API endpoints
└── config.py                      # Configuration management

tests/
└── razorpay_e2e_tests.py         # End-to-end tests

examples/
└── razorpay_client_examples.py   # Client usage examples
```

---

## 📋 5 Ecommerce Scenarios Tested

### 1️⃣ Single Product with Card
- Save Visa card
- Create 1-item order
- Total: ₹299.99
- Expected: ✅ Success

### 2️⃣ Multiple Products with UPI
- Save UPI ID
- Create multi-item order
- Total: ~₹1100
- Expected: ✅ Success

### 3️⃣ Bulk Order with Discount
- Save payment
- Create 5+ item order
- Apply ₹100 discount
- Total: ₹899.95
- Expected: ✅ Success

### 4️⃣ Express Delivery
- Add express delivery fee
- Calculate total with delivery
- Total: ₹349.99
- Expected: ✅ Success

### 5️⃣ Saved Payment Reuse
- Save payment for future use
- Create second order faster
- Use default payment
- Expected: ✅ Success

---

## 🚀 Running Examples

### Example 1: Get Payment Config
```bash
python -c "
import asyncio
from examples.razorpay_client_examples import example_config_info
asyncio.run(example_config_info())
"
```

### Example 2: Card Payment Flow
```bash
python -c "
import asyncio
from examples.razorpay_client_examples import example_1_simple_card_payment
asyncio.run(example_1_simple_card_payment())
"
```

### Example 3: UPI Payment Flow
```bash
python -c "
import asyncio
from examples.razorpay_client_examples import example_2_multiple_products_with_upi
asyncio.run(example_2_multiple_products_with_upi())
"
```

---

## 🔍 Verify Installation

### Check Service Initialization
```python
from app.payments.razorpay_service import razorpay_service
print(razorpay_service.get_configuration())
```

### Check Routes Registration
```python
from app.payments.routes import router
print(f"Routes registered: {len(router.routes)}")
```

### Check Configuration
```python
from app.payments.config import RazorpayConfig
if RazorpayConfig.validate():
    print("✅ Configuration valid")
else:
    print("❌ Configuration invalid")
```

---

## ⚠️ Common Issues & Solutions

### Issue: "ModuleNotFoundError: No module named 'razorpay'"
**Solution**: Install package
```bash
pip install razorpay
```

### Issue: "RAZORPAY_KEY_ID not configured"
**Solution**: Update .env file
```bash
echo "RAZORPAY_KEY_ID=rzp_test_Se0IvnodYcJICB" >> .env
echo "RAZORPAY_KEY_SECRET=y6znuVjA3XtS9okM3Zel44gI" >> .env
```

### Issue: "404 Not Found" on payment endpoints
**Solution**: Register routes in main.py
```python
from app.payments import register_payment_routes
register_payment_routes(app)
```

### Issue: Tests failing with connection errors
**Solution**: Ensure server is running
```bash
python -m uvicorn app.main:app --reload
```

---

## 📊 Quick Reference

### Create Order Payload
```json
{
  "items": [
    {
      "product_id": "prod_123",
      "quantity": 2,
      "price": 299.99
    }
  ],
  "shipping_address_id": "addr_1",
  "billing_address_id": "addr_1",
  "total_amount": 599.98,
  "discount_amount": 50.00,
  "delivery_fee": 40.00,
  "delivery_type": "standard",
  "notes": "Gift delivery"
}
```

### Save Card Payload
```json
{
  "type": "card",
  "card_token": "rzp_test_token_4111",
  "card_last4": "1111",
  "card_brand": "Visa",
  "card_expiry_month": 12,
  "card_expiry_year": 2025,
  "display_name": "My Visa Card"
}
```

### Save UPI Payload
```json
{
  "type": "upi",
  "upi_id": "testuser@okhdfcbank",
  "display_name": "My UPI"
}
```

---

## 🎓 Next Steps

### Immediate (Day 1)
1. ✅ Copy test credentials
2. ✅ Create .env file
3. ✅ Install dependencies
4. ✅ Run tests to verify setup

### Short-term (Days 2-3)
1. Create database tables
2. Implement database queries
3. Test with real backend
4. Test webhook handling

### Medium-term (Days 4-7)
1. Set up webhook in Razorpay dashboard
2. Deploy to staging
3. Test end-to-end scenarios
4. Deploy to production

---

## 📞 Resources

- **Razorpay Dashboard**: https://dashboard.razorpay.com
- **Razorpay API Docs**: https://razorpay.com/docs/api/
- **Test Account**: Use credentials in .env
- **Support**: support@razorpay.com

---

## ✅ Verification Checklist

- [ ] .env file created with credentials
- [ ] `pip install razorpay` completed
- [ ] Configuration validates successfully
- [ ] Tests pass (pytest)
- [ ] Server starts without errors
- [ ] /api/v1/payments/config endpoint works
- [ ] Test cards are visible in response
- [ ] Documentation understood

---

## 🎉 You're Ready!

Your Razorpay payment integration is ready to use. Start with:

```bash
# 1. Verify configuration
python -c "from app.payments.config import RazorpayConfig; RazorpayConfig.validate()"

# 2. Run tests
pytest tests/razorpay_e2e_tests.py -v

# 3. Start server
python -m uvicorn app.main:app --reload

# 4. Test API
curl http://localhost:8000/api/v1/payments/config | jq .
```

For detailed information, see `RAZORPAY_INTEGRATION.md`.
