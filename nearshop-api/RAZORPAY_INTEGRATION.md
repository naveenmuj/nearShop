# Razorpay Payment Integration Guide

## Overview

This guide explains how to set up and use Razorpay payment integration in NearShop API. The integration supports:

- **Card Payments** (Visa, Mastercard, Amex)
- **UPI Payments** (Multiple banks)
- **Wallet Payments**
- **Net Banking**
- **Card Tokenization** for saved payments
- **Webhook Handling** for real-time payment updates
- **Refund Processing**

---

## 1. Setup and Configuration

### 1.1 Razorpay Account Setup

1. Create account at [https://razorpay.com](https://razorpay.com)
2. Go to Dashboard → Settings → API Keys
3. Copy your **Key ID** and **Key Secret**

### 1.2 Environment Variables

Create `.env` file in project root:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_Se0IvnodYcJICB
RAZORPAY_KEY_SECRET=y6znuVjA3XtS9okM3Zel44gI
RAZORPAY_MODE=test

# Webhook Configuration
RAZORPAY_WEBHOOK_URL=https://api.nearshop.local/api/v1/payments/webhooks/razorpay
RAZORPAY_WEBHOOK_SECRET=webhook_secret_test_key

# Feature Flags
ENABLE_CARD_PAYMENTS=true
ENABLE_UPI_PAYMENTS=true
ENABLE_WALLET_PAYMENTS=true
ENABLE_NETBANKING=true

# Environment
ENVIRONMENT=development
```

### 1.3 Install Dependencies

```bash
pip install razorpay
```

### 1.4 Verify Configuration

```bash
python -c "from app.payments.config import RazorpayConfig; print(RazorpayConfig.get_display_config())"
```

Expected output:
```
{
  'environment': 'development',
  'is_production': False,
  'key_id': 'rzp_test_Se0IvnodYcJ***',
  'currency': 'INR',
  'card_payments': True,
  'upi_payments': True,
  'wallet_payments': True,
  'netbanking': True,
  'test_mode': True
}
```

---

## 2. API Endpoints

### 2.1 Payment Methods

#### Save Card Payment
```bash
POST /api/v1/payments/methods
Content-Type: application/json
Authorization: Bearer {token}

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

#### Save UPI Payment
```bash
POST /api/v1/payments/methods
Content-Type: application/json
Authorization: Bearer {token}

{
  "type": "upi",
  "upi_id": "testuser@okhdfcbank",
  "display_name": "My UPI"
}
```

#### List Payment Methods
```bash
GET /api/v1/payments/methods
Authorization: Bearer {token}
```

#### Get Default Payment
```bash
GET /api/v1/payments/methods/default
Authorization: Bearer {token}
```

#### Set Default Payment
```bash
POST /api/v1/payments/methods/{payment_id}/set-default
Authorization: Bearer {token}
```

#### Validate Payment
```bash
POST /api/v1/payments/methods/{payment_id}/validate
Authorization: Bearer {token}
```

#### Delete Payment
```bash
DELETE /api/v1/payments/methods/{payment_id}
Authorization: Bearer {token}
```

### 2.2 Orders

#### Create Order
```bash
POST /api/v1/orders
Content-Type: application/json
Authorization: Bearer {token}

{
  "items": [
    {
      "product_id": "prod_123",
      "quantity": 2,
      "price": 299.99
    }
  ],
  "shipping_address_id": "addr_123",
  "billing_address_id": "addr_123",
  "payment_method_id": "pm_card_1",
  "total_amount": 599.98,
  "discount_amount": 50.00,
  "delivery_type": "standard",
  "delivery_fee": 40.00,
  "notes": "Gift delivery"
}
```

Response:
```json
{
  "id": "local_order_1704800400",
  "razorpay_order_id": "order_1234567890abcd",
  "user_id": "user_123",
  "items": [...],
  "total_amount": 599.98,
  "discount_amount": 50.00,
  "delivery_fee": 40.00,
  "final_amount": 589.98,
  "shipping_address_id": "addr_123",
  "billing_address_id": "addr_123",
  "delivery_type": "standard",
  "status": "pending_payment",
  "created_at": "2024-01-09T10:30:00Z",
  "notes": "Gift delivery"
}
```

#### Get Order
```bash
GET /api/v1/orders/{order_id}
Authorization: Bearer {token}
```

#### List Orders
```bash
GET /api/v1/orders?skip=0&limit=10
Authorization: Bearer {token}
```

### 2.3 Payments

#### Get Payment Configuration
```bash
GET /api/v1/payments/config
```

Response (in test mode):
```json
{
  "razorpay_enabled": true,
  "razorpay_key": "rzp_test_Se0IvnodYcJ***",
  "test_mode": true,
  "supported_methods": ["card", "upi", "wallet", "netbanking"],
  "test_cards": {
    "visa_success": {
      "number": "4111111111111111",
      "expiry": "12/25",
      "cvv": "123",
      "name": "Test Visa"
    },
    ...
  }
}
```

### 2.4 Refunds

#### Create Refund
```bash
POST /api/v1/payments/refunds
Content-Type: application/json
Authorization: Bearer {token}

{
  "payment_id": "pay_1234567890",
  "amount": 299.99,
  "reason": "Product damaged"
}
```

#### Get Refund
```bash
GET /api/v1/payments/refunds/{refund_id}
Authorization: Bearer {token}
```

---

## 3. Testing

### 3.1 Run E2E Tests

```bash
# Run all Razorpay tests
pytest tests/razorpay_e2e_tests.py -v

# Run specific test scenario
pytest tests/razorpay_e2e_tests.py::TestRazorpayIntegration::test_ecommerce_scenario_1 -v

# Run with logging output
pytest tests/razorpay_e2e_tests.py -v -s
```

### 3.2 Test Scenarios

#### Scenario 1: Single Product with Card
- Create order with 1 product
- Use card payment
- Expected: ₹299.99

#### Scenario 2: Multiple Products with UPI
- Create order with 2-3 products
- Use UPI payment
- Expected: ~₹1100

#### Scenario 3: Bulk Order with Discount
- Create order with 5+ items
- Apply ₹100 discount
- Expected: ₹899.95

#### Scenario 4: Express Delivery
- Order with express delivery fee
- Expected: ₹349.99

#### Scenario 5: Save Payment for Future
- Save card/UPI
- Use for subsequent orders
- Expected: Faster checkout

### 3.3 Test Cards (Development Only)

| Card Type | Number | Expiry | CVV | Result |
|-----------|--------|--------|-----|--------|
| Visa | 4111111111111111 | 12/25 | 123 | Success |
| Mastercard | 5555555555554444 | 12/25 | 123 | Success |
| Amex | 378282246310005 | 12/25 | 123 | Success |
| Declined | 4000000000000002 | 12/25 | 123 | Declined |

### 3.4 Test UPI IDs

```
success@okhdfcbank
testuser@okaxis
customer@okhdfcbank
```

---

## 4. Features

### 4.1 Card Tokenization

Securely store card tokens for future purchases:

```python
from app.payments.razorpay_service import razorpay_service

# Tokenize card
result = await razorpay_service.tokenize_card(
    card_token='rzp_test_token_4111',
    card_last4='1111',
    card_brand='Visa'
)

# Use tokenized card for payment
payment = await razorpay_service.create_order(
    amount=299.99,
    user_id='user_123',
    order_id='order_123'
)
```

### 4.2 Order Creation

Create orders with Razorpay:

```python
# Create order
order = await razorpay_service.create_order(
    amount=599.98,
    user_id='user_123',
    order_id='order_123',
    notes={'items': 2, 'delivery': 'express'}
)

print(f"Razorpay Order ID: {order['razorpay_order_id']}")
print(f"Amount: ₹{order['amount']}")
```

### 4.3 Payment Verification

Verify payment authenticity:

```python
# Verify payment
result = await razorpay_service.verify_payment(
    payment_id='pay_1234567890',
    order_id='order_1234567890abcd',
    signature='signature_hash'
)

if result['success']:
    print("Payment verified!")
```

### 4.4 Webhook Handling

Process real-time payment updates:

```python
# POST /api/v1/payments/webhooks/razorpay

# Events handled:
# - payment.authorized: Payment authorized
# - payment.failed: Payment failed
# - payment.captured: Payment captured
# - refund.created: Refund created
```

### 4.5 Refunds

Process refunds:

```python
# Full refund
result = await razorpay_service.process_refund(
    payment_id='pay_1234567890',
    reason='Customer requested'
)

# Partial refund
result = await razorpay_service.process_refund(
    payment_id='pay_1234567890',
    amount=100.00,
    reason='Damaged product'
)
```

---

## 5. Error Handling

### 5.1 Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `INVALID_CARD_NUMBER` | Invalid card | Use test card numbers |
| `CARD_DECLINED` | Card declined | Use different test card |
| `INVALID_SIGNATURE` | Wrong webhook signature | Check webhook secret |
| `INSUFFICIENT_FUNDS` | Low balance | Increase test amount |
| `ORDER_CREATION_FAILED` | Invalid amount | Amount must be > 0 |

### 5.2 Error Responses

```json
{
  "success": false,
  "error": "Card number is invalid",
  "error_code": "INVALID_CARD_NUMBER"
}
```

---

## 6. Security

### 6.1 Best Practices

1. **Never log sensitive data**
   - Avoid logging card numbers
   - Avoid logging CVV
   - Avoid logging secrets

2. **Use HTTPS only**
   - All API calls must use HTTPS
   - Webhook endpoints must be HTTPS

3. **Validate signatures**
   - Always verify webhook signatures
   - Check payment authenticity before processing

4. **Tokenize cards**
   - Never store full card numbers
   - Use Razorpay tokens only

5. **Rotate secrets**
   - Rotate webhook secrets regularly
   - Update API keys quarterly

### 6.2 PCI Compliance

- Never handle raw card data
- Use Razorpay's tokenization
- Let Razorpay manage encryption

---

## 7. Webhook Setup

### 7.1 Register Webhook

In Razorpay Dashboard:

1. Go to Settings → Webhooks
2. Add webhook URL: `https://api.nearshop.local/api/v1/payments/webhooks/razorpay`
3. Select events:
   - `payment.authorized`
   - `payment.failed`
   - `payment.captured`
   - `refund.created`
4. Copy webhook secret to `.env`

### 7.2 Test Webhook

```bash
curl -X POST http://localhost:8000/api/v1/payments/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: test_signature" \
  -d '{
    "event": "payment.authorized",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_test_123",
          "amount": 29999,
          "status": "authorized"
        }
      }
    }
  }'
```

---

## 8. Database Schema

### 8.1 Payment Methods Table

```sql
CREATE TABLE payment_methods (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  type VARCHAR(20),  -- card, upi, wallet
  card_token VARCHAR(255),
  card_last4 VARCHAR(4),
  card_brand VARCHAR(20),
  card_expiry VARCHAR(10),
  upi_id VARCHAR(100),
  wallet_id VARCHAR(100),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 8.2 Orders Table

```sql
CREATE TABLE orders (
  id VARCHAR(50) PRIMARY KEY,
  razorpay_order_id VARCHAR(50),
  user_id VARCHAR(50) NOT NULL,
  total_amount DECIMAL(10, 2),
  discount_amount DECIMAL(10, 2),
  delivery_fee DECIMAL(10, 2),
  final_amount DECIMAL(10, 2),
  status VARCHAR(20),  -- pending_payment, confirmed, shipped, delivered
  payment_method_id VARCHAR(50),
  shipping_address_id VARCHAR(50),
  billing_address_id VARCHAR(50),
  delivery_type VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 8.3 Order Items Table

```sql
CREATE TABLE order_items (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  product_id VARCHAR(50),
  quantity INT,
  price DECIMAL(10, 2),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

### 8.4 Payments Table

```sql
CREATE TABLE payments (
  id VARCHAR(50) PRIMARY KEY,
  razorpay_payment_id VARCHAR(50),
  order_id VARCHAR(50),
  user_id VARCHAR(50),
  amount DECIMAL(10, 2),
  status VARCHAR(20),  -- authorized, captured, failed, refunded
  method VARCHAR(20),
  created_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 9. Troubleshooting

### 9.1 "Invalid API Key"

```bash
# Check environment variables
echo $RAZORPAY_KEY_ID
echo $RAZORPAY_KEY_SECRET

# Verify in .env file
cat .env | grep RAZORPAY
```

### 9.2 "Webhook Signature Mismatch"

```bash
# Verify webhook secret is correct
# Check X-Razorpay-Signature header
# Ensure raw body is used, not parsed JSON
```

### 9.3 "Connection Timeout"

```bash
# Check internet connection
# Verify Razorpay API is accessible
curl https://api.razorpay.com/v1/ping

# Check network firewall
```

### 9.4 Enable Debug Logging

```bash
# Add to app initialization
import logging
logging.getLogger('razorpay').setLevel(logging.DEBUG)

# Run with verbose output
pytest tests/razorpay_e2e_tests.py -v -s --log-cli-level=DEBUG
```

---

## 10. Production Checklist

- [ ] Switch to live API keys
- [ ] Update environment variables
- [ ] Register webhook with live URL
- [ ] Enable HTTPS only
- [ ] Set up error monitoring
- [ ] Configure logging
- [ ] Test with real payments
- [ ] Document payment support contact
- [ ] Set up refund procedures
- [ ] Configure transaction alerts
- [ ] Review security settings
- [ ] Set up backup payment gateway

---

## 11. Support and Resources

- **Razorpay Docs**: https://razorpay.com/docs
- **API Reference**: https://razorpay.com/docs/api/
- **Support**: support@razorpay.com
- **Dashboard**: https://dashboard.razorpay.com

---

## Appendix: Integration Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| Setup | 1 day | Create account, get keys, configure env |
| Integration | 2-3 days | Implement payment service, routes |
| Testing | 1-2 days | Run E2E tests, test scenarios |
| Deployment | 1 day | Setup webhook, switch to live, monitor |
| **Total** | **5-7 days** | |
