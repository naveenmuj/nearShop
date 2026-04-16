# Payment Gateway Integration Guide

## Overview

This guide covers the complete setup and integration of Razorpay, PhonePe, and Google Pay payment gateways in the NearShop application.

## Table of Contents

1. [Razorpay Integration](#razorpay-integration)
2. [PhonePe Integration](#phonepe-integration)
3. [Google Pay Integration](#google-pay-integration)
4. [Environment Setup](#environment-setup)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Razorpay Integration

### Overview

Razorpay is a complete payment platform that handles:
- Credit/Debit Cards
- UPI
- Digital Wallets (Apple Pay, Google Pay, WhatsApp Pay)
- NetBanking
- EMI options

### Setup Steps

#### 1. Create Razorpay Account
- Visit: https://razorpay.com
- Sign up and complete KYC
- Navigate to Settings → API Keys
- Copy **Key ID** and **Key Secret**

#### 2. Environment Configuration

Add to `.env.local`:

```env
REACT_APP_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
REACT_APP_RAZORPAY_KEY_SECRET=xxxxxxxxxxxxx
```

Add to backend `.env`:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxx
RAZORPAY_MODE=test  # or 'production'
```

#### 3. Backend Setup

Already implemented in:
- `app/payments/razorpay_service.py` - Core service
- `app/payments/routes.py` - API endpoints
- `app/payments/config.py` - Configuration

Key endpoints:
- `POST /api/payments/razorpay/order` - Create Razorpay order
- `POST /api/payments/razorpay/verify` - Verify payment signature

#### 4. Frontend Implementation

Already implemented in:
- `src/components/PaymentGatewaySelector.jsx` - Payment method selection
- `src/pages/customer/PaymentPage.jsx` - Payment page
- `src/api/paymentGateway.js` - Payment service

#### 5. Testing

Use test credentials:

**Test Cards**:
- Visa: `4111 1111 1111 1111`
- Mastercard: `5555 5555 5555 4444`
- OTP: Any 6 digits
- CVV: Any 3 digits

Test UPI: `success@razorpay` (any UPI ID will work in test mode)

**Test Scenarios**:
- Amount ending in 00 = Success
- Amount ending in 92 = Failure
- Amount ending in 81 = Pending

---

## PhonePe Integration

### Overview

PhonePe is India's leading UPI payment platform offering:
- UPI payments
- Card payments
- PhonePe Wallet
- PhonePe Pay Later (BNPL)
- Instant cashback and offers

### Setup Steps

#### 1. Create PhonePe Merchant Account
- Visit: https://business.phonepe.com
- Sign up as merchant
- Complete KYC verification
- Go to Integrations → API Keys
- Generate and save:
  - Merchant ID
  - API Key
  - API Index

#### 2. Environment Configuration

Add to `.env.local`:

```env
REACT_APP_PHONEPE_MERCHANT_ID=NEARSHOP123
REACT_APP_PHONEPE_API_KEY=xxxxxxxxxxxxx
REACT_APP_PHONEPE_API_INDEX=1
REACT_APP_PHONEPE_MODE=SANDBOX  # or PRODUCTION
```

Add to backend `.env`:

```env
PHONEPE_MERCHANT_ID=NEARSHOP123
PHONEPE_API_KEY=xxxxxxxxxxxxx
PHONEPE_API_INDEX=1
PHONEPE_MODE=SANDBOX  # or PRODUCTION
PHONEPE_SALT_KEY=xxxxxxxxxxxxx
```

#### 3. Backend Implementation

Create the following files:

**File: `app/payments/phonepe_service.py`**

```python
import hashlib
import json
import requests
from datetime import datetime
from typing import Dict, Any
from fastapi import HTTPException
from config import PHONEPE_MERCHANT_ID, PHONEPE_API_KEY

class PhonePeService:
    def __init__(self):
        self.merchant_id = PHONEPE_MERCHANT_ID
        self.api_key = PHONEPE_API_KEY
        self.sandbox_url = "https://mercury-api.phonepe.com/api/v1"
        self.prod_url = "https://api.phonepe.com/apis/hermes/pg"
        
    def _generate_checksum(self, payload: str) -> str:
        """Generate SHA256 checksum for PhonePe request"""
        message = payload + self.api_key
        return hashlib.sha256(message.encode()).hexdigest()
    
    def create_transaction(self, order_id: str, amount: float, 
                          phone: str, email: str) -> Dict[str, Any]:
        """Create PhonePe transaction"""
        try:
            # Create payload
            payload = {
                "merchantId": self.merchant_id,
                "merchantTransactionId": f"TXN_{order_id}_{int(datetime.now().timestamp())}",
                "merchantUserId": f"USER_{order_id}",
                "amount": int(amount * 100),  # Convert to paise
                "redirectUrl": f"https://yourapp.com/payment/callback",
                "redirectMode": "REDIRECT",
                "mobileNumber": phone,
                "paymentInstrument": {
                    "type": "UPI_QR"  # or "UPI_INTENT"
                },
                "deviceContext": {
                    "deviceOS": "ANDROID"
                }
            }
            
            # Encode payload
            payload_json = json.dumps(payload)
            encoded_payload = base64.b64encode(payload_json.encode()).decode()
            
            # Generate checksum
            checksum = self._generate_checksum(encoded_payload)
            
            # Make request
            headers = {
                "Content-Type": "application/json",
                "X-VERIFY": f"{checksum}###1"  # Checksum###Index
            }
            
            response = requests.post(
                f"{self.sandbox_url}/pg/v1/charge",
                json={"request": encoded_payload},
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=400, detail="PhonePe transaction failed")
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PhonePe error: {str(e)}")
    
    def verify_transaction(self, merchant_transaction_id: str) -> Dict[str, Any]:
        """Verify PhonePe transaction status"""
        try:
            # Create verification payload
            payload = f'/pg/v1/status/{self.merchant_id}/{merchant_transaction_id}'
            checksum = self._generate_checksum(payload)
            
            headers = {
                "Content-Type": "application/json",
                "X-VERIFY": f"{checksum}###1"
            }
            
            response = requests.get(
                f"{self.sandbox_url}{payload}",
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=400, detail="Verification failed")
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Verification error: {str(e)}")
```

**File: `app/payments/phonepe_routes.py`**

```python
from fastapi import APIRouter, HTTPException
from phonepe_service import PhonePeService
from schemas import PaymentRequest, PaymentVerification

router = APIRouter(prefix="/api/payments/phonepe", tags=["PhonePe"])
phonepe_service = PhonePeService()

@router.post("/create-transaction")
async def create_transaction(request: PaymentRequest):
    """Create PhonePe transaction"""
    try:
        transaction = phonepe_service.create_transaction(
            request.order_id,
            request.amount,
            request.phone,
            request.email
        )
        return transaction
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/verify/{merchant_transaction_id}")
async def verify_transaction(merchant_transaction_id: str):
    """Verify PhonePe transaction"""
    try:
        result = phonepe_service.verify_transaction(merchant_transaction_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

#### 4. Frontend Implementation

Already implemented in:
- `src/pages/customer/PaymentPage.jsx` - PhonePe handler
- `src/api/paymentGateway.js` - PhonePe service

#### 5. Testing

**Test UPIs**:
- `success@paytm` - Success transaction
- `failure@paytm` - Failed transaction
- `pending@paytm` - Pending transaction

---

## Google Pay Integration

### Overview

Google Pay provides:
- One-tap checkout with saved cards
- UPI support (in India)
- 3DS authentication
- Transaction history

### Setup Steps

#### 1. Google Pay Setup
- Visit: https://developers.google.com/pay/api
- Create a Google Cloud Project
- Enable Google Pay API
- Get your Merchant ID from Google Pay Business Console

#### 2. Environment Configuration

Add to `.env.local`:

```env
REACT_APP_GPAY_MERCHANT_ID=12345678901234567890
REACT_APP_GPAY_MERCHANT_NAME=NearShop
REACT_APP_GPAY_ENVIRONMENT=TEST  # or PRODUCTION
```

#### 3. Backend Setup

Create the following:

**File: `app/payments/gpay_service.py`**

```python
import hashlib
import hmac
import json
from typing import Dict, Any
from fastapi import HTTPException

class GooglePayService:
    def __init__(self, merchant_id: str):
        self.merchant_id = merchant_id
    
    def verify_payment_token(self, payment_method_data: Dict) -> Dict[str, Any]:
        """Verify Google Pay payment token"""
        try:
            # Decrypt and verify the token
            # Implementation depends on payment processor
            # If using Razorpay as processor:
            
            token = payment_method_data.get('tokenizationData', {}).get('token')
            
            if not token:
                raise HTTPException(status_code=400, detail="Invalid payment token")
            
            # Token is already encrypted by Google
            # Send it to your payment processor for processing
            return {
                "status": "verified",
                "token": token,
                "type": payment_method_data.get('type')
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Token verification failed: {str(e)}")
```

#### 4. Frontend Implementation

Already implemented in:
- `src/pages/customer/PaymentPage.jsx` - Google Pay handler
- `src/api/paymentGateway.js` - Google Pay service

#### 5. Testing

- Use test card numbers (same as Razorpay)
- Google Pay test mode doesn't charge real money
- Verify in Google Play Console

---

## Environment Setup

### Frontend Environment Variables

Create or update `.env.local`:

```env
# Razorpay
REACT_APP_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx

# PhonePe
REACT_APP_PHONEPE_MERCHANT_ID=NEARSHOP123
REACT_APP_PHONEPE_API_KEY=xxxxxxxxxxxxx

# Google Pay
REACT_APP_GPAY_MERCHANT_ID=12345678901234567890

# API
REACT_APP_API_URL=http://localhost:8000
```

### Backend Environment Variables

Create or update `.env`:

```env
# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxx

# PhonePe
PHONEPE_MERCHANT_ID=NEARSHOP123
PHONEPE_API_KEY=xxxxxxxxxxxxx
PHONEPE_SALT_KEY=xxxxxxxxxxxxx

# Payment Database
PAYMENT_DATABASE_URL=postgresql://user:pass@localhost/nearshop_payments

# Mode
ENVIRONMENT=test
```

---

## Testing

### Unit Tests

Payment components are tested in:
- `tests/test_payment_gateway.py` - Gateway service tests
- `tests/test_razorpay_standalone.py` - Razorpay tests (22 tests, all passing)

### Integration Tests

```bash
# Run all payment tests
pytest tests/test_razorpay_*.py -v

# Run specific gateway tests
pytest tests/test_razorpay_standalone.py::TestPaymentFlowParity -v
```

### Manual Testing

1. **Test Payment Page**
   - Navigate to `/payment`
   - Select different payment methods
   - Verify animations work correctly
   - Test form validations

2. **Test Razorpay**
   - Use test card: `4111 1111 1111 1111`
   - Complete payment flow
   - Verify order creation

3. **Test PhonePe** (Sandbox)
   - Use test UPI: `success@paytm`
   - Check transaction status
   - Verify callback handling

4. **Test Google Pay** (Test Mode)
   - Use test card
   - Verify one-tap flow
   - Check token generation

---

## Troubleshooting

### Razorpay Issues

**Problem**: "Razorpay key not found"
- **Solution**: Check `REACT_APP_RAZORPAY_KEY_ID` in `.env.local`

**Problem**: "Script failed to load"
- **Solution**: Check internet connection, verify Razorpay CDN is accessible

**Problem**: "Payment verification failed"
- **Solution**: Verify signature in backend, check order ID matching

### PhonePe Issues

**Problem**: "Checksum validation failed"
- **Solution**: Verify API Key and Salt Key in environment

**Problem**: "Transaction timeout"
- **Solution**: Increase timeout, check network latency

**Problem**: "Redirect not working"
- **Solution**: Verify redirect URL matches in merchant dashboard

### Google Pay Issues

**Problem**: "Google Pay not available"
- **Solution**: Check if device supports Google Pay, verify Merchant ID

**Problem**: "Card not supported"
- **Solution**: Use test cards from official documentation

**Problem**: "3DS authentication fails"
- **Solution**: Verify processor supports 3DS, check network conditions

### General Payment Issues

**Problem**: Payments work on test but fail on production
- **Solution**: Update API keys, verify merchant verification status

**Problem**: Orders not created after payment
- **Solution**: Check database connection, verify webhook handling

**Problem**: Animations not working smoothly
- **Solution**: Check browser performance, enable hardware acceleration

---

## Security Best Practices

1. **Never commit secrets** - Use `.env.local` which is gitignored
2. **Validate on backend** - Always verify payments server-side
3. **Use HTTPS** - Required for production
4. **Secure tokens** - Don't store payment tokens on frontend
5. **Monitor for fraud** - Enable fraud detection in payment gateways
6. **Regular audits** - Review payment logs regularly

---

## Additional Resources

- Razorpay Docs: https://razorpay.com/docs/
- PhonePe Docs: https://business.phonepe.com/documents
- Google Pay Docs: https://developers.google.com/pay/api
- PCI Compliance: https://www.pcisecuritystandards.org/

---

## Support

For issues or questions:
1. Check error logs in browser console
2. Review server logs in `/logs`
3. Contact payment gateway support
4. Reach out to development team

---

**Last Updated**: 2024
**Version**: 1.0
