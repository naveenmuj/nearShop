# Razorpay Integration Setup Checklist

## 🎯 Quick Start

### Phase 1: Preparation (Day 1)
- [ ] Read Razorpay Integration Guide
- [ ] Create Razorpay account
- [ ] Get API test keys
- [ ] Copy keys to environment variables
- [ ] Review API endpoints documentation

### Phase 2: Local Setup (Day 2-3)
- [ ] Create `.env` file with Razorpay credentials
- [ ] Install razorpay Python package
- [ ] Run validation tests
- [ ] Test E2E scenarios locally
- [ ] Verify webhook signature verification
- [ ] Test card tokenization

### Phase 3: Integration (Day 4-5)
- [ ] Integrate payment service into main app
- [ ] Register payment routes
- [ ] Update FastAPI initialization
- [ ] Test all API endpoints
- [ ] Verify error handling
- [ ] Test refund processing

### Phase 4: Testing (Day 6)
- [ ] Run complete E2E test suite
- [ ] Test all 5 ecommerce scenarios
- [ ] Test error scenarios
- [ ] Test webhook handling
- [ ] Performance testing
- [ ] Load testing (if applicable)

### Phase 5: Deployment (Day 7)
- [ ] Set up webhook in Razorpay dashboard
- [ ] Switch to live API keys (production)
- [ ] Update environment variables
- [ ] Deploy to staging
- [ ] Test with staging database
- [ ] Deploy to production
- [ ] Monitor transactions

---

## 📋 Detailed Checklist

### Environment Setup

#### Prerequisites
- [ ] Python 3.8+ installed
- [ ] FastAPI framework set up
- [ ] SQLAlchemy for database
- [ ] Redis (optional, for caching)
- [ ] Docker (optional, for deployment)

#### Dependencies
```bash
pip install razorpay
pip install fastapi
pip install sqlalchemy
pip install pydantic
```

#### Environment Variables
- [ ] RAZORPAY_KEY_ID configured
- [ ] RAZORPAY_KEY_SECRET configured
- [ ] RAZORPAY_WEBHOOK_SECRET configured
- [ ] RAZORPAY_WEBHOOK_URL configured
- [ ] RAZORPAY_MODE set to 'test' or 'live'
- [ ] ENVIRONMENT variable set
- [ ] ENABLE_CARD_PAYMENTS set
- [ ] ENABLE_UPI_PAYMENTS set
- [ ] ENABLE_WALLET_PAYMENTS set
- [ ] ENABLE_NETBANKING set

### Code Structure

#### Files Created
- [ ] `app/payments/razorpay_service.py` - Service class
- [ ] `app/payments/routes.py` - API endpoints
- [ ] `app/payments/config.py` - Configuration management
- [ ] `tests/razorpay_e2e_tests.py` - E2E tests
- [ ] `RAZORPAY_INTEGRATION.md` - Documentation

#### Files Updated
- [ ] `app/payments/__init__.py` - Module initialization
- [ ] `app/main.py` - Register routes
- [ ] `.env` - Environment variables
- [ ] `requirements.txt` - Dependencies

### Database Schema

#### Tables to Create
- [ ] `payment_methods` - Store saved payment methods
- [ ] `orders` - Store order information
- [ ] `order_items` - Store order line items
- [ ] `payments` - Store payment transactions
- [ ] `refunds` - Store refund information

#### Database Indexes
- [ ] Create index on `payment_methods.user_id`
- [ ] Create index on `orders.user_id`
- [ ] Create index on `orders.razorpay_order_id`
- [ ] Create index on `payments.razorpay_payment_id`

### API Endpoints

#### Payment Methods
- [ ] POST `/api/v1/payments/methods` - Save payment
- [ ] GET `/api/v1/payments/methods` - List payments
- [ ] GET `/api/v1/payments/methods/default` - Get default
- [ ] POST `/api/v1/payments/methods/{id}/set-default` - Set default
- [ ] POST `/api/v1/payments/methods/{id}/validate` - Validate
- [ ] DELETE `/api/v1/payments/methods/{id}` - Delete payment

#### Orders
- [ ] POST `/api/v1/orders` - Create order
- [ ] GET `/api/v1/orders` - List orders
- [ ] GET `/api/v1/orders/{id}` - Get order details

#### Webhooks
- [ ] POST `/api/v1/payments/webhooks/razorpay` - Webhook handler

#### Refunds
- [ ] POST `/api/v1/payments/refunds` - Create refund
- [ ] GET `/api/v1/payments/refunds/{id}` - Get refund details

#### Configuration
- [ ] GET `/api/v1/payments/config` - Get payment config

### Feature Implementation

#### Payment Methods
- [ ] Card tokenization support
- [ ] UPI ID storage
- [ ] Wallet ID storage
- [ ] Net banking support
- [ ] Default payment method
- [ ] Payment method validation

#### Order Processing
- [ ] Create Razorpay order
- [ ] Calculate totals with discounts
- [ ] Add delivery fees
- [ ] Store order in database
- [ ] Fetch order details
- [ ] List user orders

#### Payment Processing
- [ ] Verify payment signature
- [ ] Handle payment success
- [ ] Handle payment failure
- [ ] Process refunds
- [ ] Full and partial refunds
- [ ] Refund status tracking

#### Webhook Handling
- [ ] Verify webhook signature
- [ ] Handle payment.authorized
- [ ] Handle payment.failed
- [ ] Handle payment.captured
- [ ] Handle refund.created
- [ ] Update order status
- [ ] Send notifications

### Testing

#### Unit Tests
- [ ] Test card tokenization
- [ ] Test UPI validation
- [ ] Test order creation
- [ ] Test payment verification
- [ ] Test refund processing
- [ ] Test error handling

#### Integration Tests
- [ ] Test with test database
- [ ] Test with test keys
- [ ] Test webhook processing
- [ ] Test payment flow end-to-end

#### E2E Tests (5 Scenarios)
- [ ] Scenario 1: Single product with card
  - [ ] Save card
  - [ ] Create order
  - [ ] Process payment
  - [ ] Verify order created
  - [ ] Check payment status
  
- [ ] Scenario 2: Multiple products with UPI
  - [ ] Save UPI
  - [ ] Create order with multiple items
  - [ ] Process UPI payment
  - [ ] Verify all items ordered
  
- [ ] Scenario 3: Bulk order with discount
  - [ ] Apply discount
  - [ ] Verify final amount
  - [ ] Process payment
  - [ ] Check discount applied
  
- [ ] Scenario 4: Express delivery
  - [ ] Set express delivery
  - [ ] Add delivery fee
  - [ ] Verify total amount
  - [ ] Process payment
  
- [ ] Scenario 5: Save payment for reuse
  - [ ] Save payment method
  - [ ] Create second order with saved payment
  - [ ] Verify faster checkout
  - [ ] Process payment

#### Error Scenario Tests
- [ ] Declined card handling
- [ ] Invalid UPI format
- [ ] Insufficient funds
- [ ] Invalid signature verification
- [ ] Webhook timeout
- [ ] Database connection failure
- [ ] Razorpay API failure

### Documentation

#### User Documentation
- [ ] API endpoint documentation
- [ ] Example requests/responses
- [ ] Error codes and meanings
- [ ] Webhook event types
- [ ] Test card information
- [ ] FAQ section

#### Developer Documentation
- [ ] Setup instructions
- [ ] Configuration guide
- [ ] Code structure explanation
- [ ] Database schema docs
- [ ] Security best practices
- [ ] Troubleshooting guide

#### Operational Documentation
- [ ] Monitoring setup
- [ ] Alert configuration
- [ ] Backup procedures
- [ ] Disaster recovery
- [ ] Performance tuning
- [ ] Support contact info

### Security

#### Configuration Security
- [ ] API keys in environment variables (not code)
- [ ] Webhook secret configured
- [ ] HTTPS enforced for all endpoints
- [ ] API key rotation planned

#### Data Security
- [ ] No card numbers stored in database
- [ ] Tokens used instead of card data
- [ ] Payment data encrypted in transit
- [ ] Webhook signatures verified
- [ ] Sensitive data not logged

#### Access Control
- [ ] Authentication required for all payment endpoints
- [ ] User can only see their own payments
- [ ] Admin can view all payments
- [ ] Rate limiting on API calls
- [ ] IP whitelisting (if applicable)

### Monitoring and Logging

#### Logging Setup
- [ ] Payment service logs to file
- [ ] Webhook events logged
- [ ] Failed transactions logged
- [ ] API errors logged
- [ ] Debug logging available

#### Monitoring Setup
- [ ] Transaction count monitoring
- [ ] Payment success rate monitoring
- [ ] Average payment amount monitoring
- [ ] Webhook delivery latency monitoring
- [ ] Error rate monitoring
- [ ] Database query performance

#### Alerts
- [ ] High failure rate alert
- [ ] Webhook delivery failure alert
- [ ] Database connection failure alert
- [ ] API timeout alert
- [ ] Unusual transaction pattern alert

### Performance

#### Database Performance
- [ ] Indexes created on frequently queried columns
- [ ] Query optimization for order listing
- [ ] Connection pooling configured
- [ ] Database query timeouts set

#### API Performance
- [ ] Response times < 500ms
- [ ] Webhook processing < 1s
- [ ] Payment method lookup cached
- [ ] Order creation optimized

#### Caching
- [ ] Payment configuration cached
- [ ] User payment methods cached
- [ ] Payment status cached
- [ ] Cache invalidation on updates

### Deployment

#### Staging Deployment
- [ ] Deploy to staging environment
- [ ] Run full test suite on staging
- [ ] Test webhook delivery to staging
- [ ] Performance test on staging
- [ ] Security audit on staging

#### Production Deployment
- [ ] Register webhook in Razorpay dashboard
- [ ] Switch to live API keys
- [ ] Update environment variables
- [ ] Run health checks
- [ ] Monitor first 24 hours
- [ ] Set up alerts and monitoring
- [ ] Prepare rollback plan
- [ ] Document deployment steps

#### Post-Deployment
- [ ] Verify all endpoints working
- [ ] Check webhook delivery
- [ ] Monitor transaction processing
- [ ] Review error logs
- [ ] Check payment success rate
- [ ] Verify customer notifications

### Maintenance

#### Regular Tasks
- [ ] Review error logs weekly
- [ ] Check transaction success rate weekly
- [ ] Verify webhook delivery weekly
- [ ] Rotate API keys quarterly
- [ ] Update dependencies monthly
- [ ] Review security settings monthly

#### Troubleshooting Guide
- [ ] Common error resolutions
- [ ] Webhook troubleshooting
- [ ] Payment failure diagnosis
- [ ] Database recovery procedures
- [ ] Rollback procedures

---

## 📊 Implementation Status

| Component | Status | Completion |
|-----------|--------|-----------|
| Razorpay Service | ✅ Complete | 100% |
| Payment Routes API | ✅ Complete | 100% |
| Configuration Module | ✅ Complete | 100% |
| E2E Tests | ✅ Complete | 100% |
| Documentation | ✅ Complete | 100% |
| Database Schema | ⏳ To Do | 0% |
| Integration with Main App | ⏳ To Do | 0% |
| Staging Deployment | ⏳ To Do | 0% |
| Production Deployment | ⏳ To Do | 0% |

---

## 🔧 Implementation Commands

### Setup Environment
```bash
# Copy environment variables
cp .env.example .env

# Edit .env with your Razorpay keys
nano .env

# Verify configuration
python -c "from app.payments.config import RazorpayConfig; print(RazorpayConfig.get_display_config())"
```

### Install Dependencies
```bash
# Install Razorpay SDK
pip install razorpay

# Install test dependencies
pip install pytest pytest-asyncio httpx
```

### Run Tests
```bash
# Run all tests
pytest tests/razorpay_e2e_tests.py -v

# Run specific scenario
pytest tests/razorpay_e2e_tests.py::TestRazorpayIntegration::test_ecommerce_scenario_1 -v -s

# Run with coverage
pytest tests/razorpay_e2e_tests.py --cov=app.payments
```

### Start Server
```bash
# Start FastAPI server with Razorpay service
python -m uvicorn app.main:app --reload

# Server will be at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Test Endpoints
```bash
# Get payment configuration
curl http://localhost:8000/api/v1/payments/config

# Create payment method (requires auth)
curl -X POST http://localhost:8000/api/v1/payments/methods \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## 📞 Support

### For Issues
- Check `RAZORPAY_INTEGRATION.md` documentation
- Review error logs in application
- Run diagnostic tests
- Check Razorpay dashboard status
- Contact Razorpay support

### Key Contacts
- **Razorpay Support**: support@razorpay.com
- **Razorpay Docs**: https://razorpay.com/docs
- **Dashboard**: https://dashboard.razorpay.com
- **Status Page**: https://status.razorpay.com

---

## ✅ Sign-Off

- [ ] All checklist items completed
- [ ] All tests passing
- [ ] Documentation reviewed
- [ ] Team trained on system
- [ ] Ready for production

**Implementation Date**: _______________
**Approved By**: _______________
**Notes**: 
```
_______________________________________________
_______________________________________________
```
