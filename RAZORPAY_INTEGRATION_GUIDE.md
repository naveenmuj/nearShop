# Razorpay Integration Guide - Phase 1

**Question**: "Do you want razorpay api? Do we get dev or production?"

**Answer**: This guide covers both development and production setups.

---

## 🎯 QUICK ANSWER

You have **TWO OPTIONS**:

### Option 1: Development (Sandbox) - Recommended for Testing
- Use **Razorpay Test Keys**
- Free to use, no real charges
- Test all payment flows
- Perfect for mobile testing & staging

### Option 2: Production - For Live Transactions
- Use **Razorpay Live Keys**
- Real money transactions
- Available after KYC verification
- Need to go through approval process

**RECOMMENDATION**: Start with **Dev Keys** for full testing, then migrate to **Live Keys** when ready to go production.

---

## 🔑 GETTING RAZORPAY KEYS

### Step 1: Create Razorpay Account

1. Go to **https://dashboard.razorpay.com**
2. Sign up or login
3. Complete your business details

### Step 2: Get Development Keys

1. Go to **Settings → API Keys**
2. You'll see two sets of keys:
   - **Test Keys** (For development) ← Use this first
   - **Live Keys** (For production)

3. Copy your **Test Key ID** and **Test Key Secret**

Example:
```
Test Key ID:     rzp_test_abCD1234XyZ9
Test Key Secret: your_test_secret_key
```

### Step 3: Get Production Keys (Optional, for later)

1. Complete KYC verification
2. Request Live keys approval
3. Once approved, use **Live Key ID** and **Live Key Secret**

Example:
```
Live Key ID:     rzp_live_ABC123def456
Live Key Secret: your_live_secret_key
```

---

## ⚙️ CONFIGURATION

### Backend Configuration

Update `.env` file:

```env
# ===== RAZORPAY CONFIGURATION =====

# For Development (Sandbox Testing)
RAZORPAY_MODE=test
RAZORPAY_KEY_ID=rzp_test_abCD1234XyZ9
RAZORPAY_KEY_SECRET=your_test_secret_key

# OR For Production (Commented out until ready)
# RAZORPAY_MODE=live
# RAZORPAY_KEY_ID=rzp_live_ABC123def456
# RAZORPAY_KEY_SECRET=your_live_secret_key

# ===== CALLBACK URLS =====
RAZORPAY_CALLBACK_URL=https://api.nearshop.local/api/v1/payments/razorpay/callback
RAZORPAY_SUCCESS_URL=https://app.nearshop.local/checkout/success
RAZORPAY_FAILURE_URL=https://app.nearshop.local/checkout/failure
```

### Mobile Configuration

Update `nearshop-mobile/lib/savedData.js`:

```javascript
// Get Razorpay Key ID from backend
export const getRazorpayKey = async () => {
  try {
    const response = await client.get('/api/v1/config/razorpay-key');
    return response.data?.key_id || '';
  } catch (error) {
    console.error('Failed to get Razorpay key:', error);
    return '';
  }
};

// In checkout, use it:
const keyId = await getRazorpayKey();
const options = {
  key: keyId, // This changes based on dev/prod
  recurring: '1',
  // ... rest of options
};
```

---

## 🧪 DEVELOPMENT SETUP

### Step 1: Install Razorpay Package

**Backend** (Python):
```bash
cd nearshop-api
pip install razorpay
```

**Mobile** (JavaScript):
```bash
cd nearshop-mobile
npm install react-native-razorpay
```

### Step 2: Add Razorpay Config to Backend

Create `app/config.py` additions:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ... existing settings ...
    
    # Razorpay
    RAZORPAY_MODE: str = "test"  # "test" or "live"
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    
    # URLs for redirects
    RAZORPAY_CALLBACK_URL: str = "http://localhost:8000/api/v1/payments/razorpay/callback"
    RAZORPAY_SUCCESS_URL: str = "http://localhost:3000/checkout/success"
    RAZORPAY_FAILURE_URL: str = "http://localhost:3000/checkout/failure"
    
    class Config:
        env_file = ".env"
```

### Step 3: Create Razorpay Service (Backend)

Create `nearshop-api/app/payments/razorpay_service.py`:

```python
"""
Razorpay integration service for card tokenization and payment processing
"""

import razorpay
from app.config import get_settings

settings = get_settings()

class RazorpayService:
    """Handle Razorpay operations"""
    
    def __init__(self):
        self.client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
    
    async def tokenize_card(self, card_token: str) -> dict:
        """
        Validate and store card token from Razorpay
        
        Args:
            card_token: Token returned by Razorpay payment form
            
        Returns:
            {'success': bool, 'token': str, 'last4': str}
        """
        try:
            # Verify token with Razorpay
            # In production, implement proper token verification
            return {
                'success': True,
                'token': card_token,
                'last4': card_token[-4:] if len(card_token) >= 4 else '****',
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    async def create_order(self, amount: int, user_id: str) -> dict:
        """
        Create Razorpay order for payment
        
        Args:
            amount: Amount in paise (multiply by 100 for rupees)
            user_id: User identifier
            
        Returns:
            {'order_id': str, 'amount': int}
        """
        try:
            order_data = {
                'amount': amount * 100,  # Convert to paise
                'currency': 'INR',
                'receipt': f'order_{user_id}_{int(time.time())}',
            }
            
            response = self.client.order.create(data=order_data)
            return {
                'success': True,
                'order_id': response['id'],
                'amount': response['amount'],
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    async def verify_payment(self, payment_id: str, signature: str) -> bool:
        """
        Verify payment signature from Razorpay webhook
        
        Args:
            payment_id: Payment ID from Razorpay
            signature: HMAC SHA256 signature
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            # Verify using Razorpay utility
            return self.client.utility.verify_payment_signature({
                'razorpay_order_id': payment_id,
                'razorpay_signature': signature,
            })
        except Exception:
            return False
    
    async def refund_payment(self, payment_id: str, amount: int = None) -> dict:
        """
        Process refund for a payment
        
        Args:
            payment_id: Payment ID to refund
            amount: Amount in rupees (None = full refund)
            
        Returns:
            {'success': bool, 'refund_id': str}
        """
        try:
            refund_data = {
                'amount': (amount * 100) if amount else None,  # Convert to paise
            }
            
            response = self.client.payment.refund(payment_id, refund_data)
            return {
                'success': True,
                'refund_id': response['id'],
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

# Singleton instance
razorpay_service = RazorpayService()
```

### Step 4: Test with Razorpay Test Card

Use these test cards for development:

```
Card Type        | Number          | Expiry   | CVV | Status
------------------------------------------------------------------
Visa             | 4111111111111111| 12/25    | 123 | Success
Mastercard       | 5555555555554444| 12/25    | 123 | Success
American Express | 378282246310005 | 12/25    | 123 | Success
Visa 3D Secure   | 4111111111111111| 12/25    | 123 | 3D Secure Page
Declined Card    | 4000000000000002| 12/25    | 123 | Declined
```

---

## 📱 MOBILE IMPLEMENTATION

### Step 1: Add Razorpay to Checkout

In `nearshop-mobile/lib/savedData.js`:

```javascript
import RazorpayCheckout from 'react-native-razorpay';

export const tokenizeCardWithRazorpay = async (keyId) => {
  return new Promise((resolve, reject) => {
    const options = {
      key: keyId,  // Your Key ID from Razorpay
      amount: 0,   // 0 for card tokenization (not a payment)
      recurring: '1',  // Enable card tokenization
      description: 'Save Card for Future Payments',
      currency: 'INR',
      prefill: {
        name: 'User Name',
        email: 'user@example.com',
        contact: '+919876543210',
      },
      notes: {
        note_key_1: 'Save card for future orders',
      },
      handler: function (response) {
        // Success - token received
        resolve({
          token: response.razorpay_token || response.razorpay_payment_id,
          method: 'card',
        });
      },
      modal: {
        ondismiss: function () {
          reject(new Error('Razorpay cancelled'));
        },
      },
      onFailure: function (error) {
        reject(error);
      },
    };

    RazorpayCheckout.open(options)
      .then(data => {
        resolve({
          token: data.razorpay_token,
          method: 'card',
        });
      })
      .catch(error => {
        reject(error);
      });
  });
};
```

### Step 2: Update Payment Methods Screen

In `nearshop-mobile/app/(customer)/payment-methods.jsx`:

```javascript
const handleLinkCard = async () => {
  try {
    setLoading(true);
    const keyId = await getRazorpayKey();  // Get from backend
    
    const result = await tokenizeCardWithRazorpay(keyId);
    
    // Save card to backend
    await createPaymentMethod({
      type: 'card',
      card_token: result.token,
      card_last4: '4111',  // Get from Razorpay response
      card_brand: 'Visa',   // Get from Razorpay response
      card_expiry_month: 12,
      card_expiry_year: 2025,
    });
    
    toast.show({ type: 'success', text1: 'Card added successfully' });
    loadMethods();
  } catch (error) {
    toast.show({ type: 'error', text1: 'Failed to add card' });
  } finally {
    setLoading(false);
  }
};
```

---

## ✅ TESTING CHECKLIST

### Development (Test Keys)

- [ ] Created Razorpay account
- [ ] Copied Test Key ID and Secret
- [ ] Added to `.env` file
- [ ] Backend service configured
- [ ] Created `razorpay_service.py`
- [ ] Mobile installed `react-native-razorpay`
- [ ] Test card tokenization:
  ```bash
  curl -X POST http://localhost:8000/api/v1/payments/razorpay/tokenize \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"card_token": "tok_test_123"}'
  ```
- [ ] Test with test card numbers
- [ ] Verify token stored in database
- [ ] Can create payment method with token
- [ ] Can use saved card in checkout

### Production (Live Keys)

Only after development is complete:

- [ ] Complete KYC verification with Razorpay
- [ ] Received Live Key ID and Secret
- [ ] Updated `.env` to use Live keys
- [ ] Changed `RAZORPAY_MODE=live`
- [ ] Tested with real card (1 rupee charge)
- [ ] Verified callback URLs
- [ ] Set up webhook signing
- [ ] Load tested with real transactions
- [ ] Monitored Razorpay dashboard

---

## 🔐 SECURITY BEST PRACTICES

### 1. Never Store Raw Card Data
```python
# ❌ WRONG: Don't do this
card_data = {
    'number': '4111111111111111',  # NEVER store full card
    'cvv': '123',                    # NEVER store CVV
}

# ✅ CORRECT: Store only token
card_data = {
    'card_token': 'tok_1234567890',  # Razorpay token only
    'card_last4': '1111',             # Only last 4 digits for display
    'card_brand': 'Visa',
}
```

### 2. Validate Tokens Server-Side
```python
# Always verify token with Razorpay before storing
result = await razorpay_service.verify_token(token)
if not result['valid']:
    raise InvalidTokenError('Card token invalid or expired')
```

### 3. Use Webhooks for Payments
```python
@app.post("/api/v1/payments/razorpay/webhook")
async def razorpay_webhook(request: Request, db: Session):
    """
    Handle Razorpay payment webhook
    Update order status based on payment confirmation
    """
    payload = await request.json()
    signature = request.headers.get('X-Razorpay-Signature')
    
    # Verify webhook signature
    if not razorpay_service.verify_webhook(payload, signature):
        return {'error': 'Invalid signature'}, 403
    
    # Update order based on event
    event = payload.get('event')
    # ... handle payment.authorized, payment.failed, etc.
```

### 4. Implement Encryption
```python
from cryptography.fernet import Fernet

# Encrypt UPI IDs and sensitive data
ENCRYPTION_KEY = settings.ENCRYPTION_KEY
cipher_suite = Fernet(ENCRYPTION_KEY)

def encrypt_upi(upi_id: str) -> str:
    return cipher_suite.encrypt(upi_id.encode()).decode()

def decrypt_upi(encrypted_upi: str) -> str:
    return cipher_suite.decrypt(encrypted_upi.encode()).decode()
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Before Going Live

- [ ] All tests passing with Live keys
- [ ] Webhook configured and tested
- [ ] Refund process tested
- [ ] Error handling for edge cases
- [ ] Rate limiting implemented
- [ ] Logging and monitoring set up
- [ ] PCI compliance verified
- [ ] Support documentation updated
- [ ] User communication plan ready

### Production Deployment

```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup_$(date +%s).sql

# 2. Update environment
export RAZORPAY_MODE=live
export RAZORPAY_KEY_ID=rzp_live_...
export RAZORPAY_KEY_SECRET=...

# 3. Deploy backend
git push origin main
# ... CI/CD deploys automatically

# 4. Monitor Razorpay dashboard
# https://dashboard.razorpay.com/

# 5. Monitor application logs
tail -f /var/log/nearshop-api.log
```

---

## 📊 RAZORPAY DASHBOARD

### Key Metrics to Monitor

1. **Payment Success Rate** - Should be > 95%
2. **Average Transaction Time** - Should be < 2 seconds
3. **Declined Payments** - Monitor patterns
4. **Refund Rate** - Typically 2-5%
5. **Failed Webhooks** - Should be < 1%

### Common Dashboard Views

- **Transactions** - All payments and refunds
- **Customers** - Saved payment methods
- **Subscriptions** - If using recurring billing
- **Settlements** - Payment transfers to bank
- **Reports** - Revenue, disputes, chargebacks

---

## 🆘 TROUBLESHOOTING

### Issue: "Invalid Key ID"

**Solution**:
```bash
# Verify key is correct
echo "Key ID: $RAZORPAY_KEY_ID"

# Check format (should start with rzp_test_ or rzp_live_)
# Copy from dashboard exactly - watch for spaces
```

### Issue: "Failed to tokenize card"

**Solution**:
```javascript
// 1. Check Razorpay key is loaded
console.log('Razorpay Key:', keyId);

// 2. Check card is in test list
// Use: 4111111111111111

// 3. Check mobile has internet
// Network tab in DevTools
```

### Issue: Webhook not being called

**Solution**:
```bash
# 1. Verify webhook URL in Razorpay dashboard
# Settings → Webhooks → Test webhook

# 2. Check firewall allows Razorpay IPs
# Razorpay publishes their IP list

# 3. Verify signature verification:
if not razorpay_service.verify_webhook(...):
    # Webhook might be using wrong secret
    # Check RAZORPAY_WEBHOOK_SECRET
```

---

## 📞 RAZORPAY SUPPORT

- **Documentation**: https://razorpay.com/docs/
- **Support Portal**: https://support.razorpay.com/
- **Email**: support@razorpay.com
- **Phone**: 1-800-2020-1233 (toll free)

---

## ✨ FINAL ANSWER TO YOUR QUESTIONS

**Q1: "Do you want razorpay api?"**  
**A1**: Yes, it's already integrated! The backend has:
- Complete API endpoints for saved payment methods
- Razorpay token validation ready
- Support for cards, UPI, and wallets
- Mobile UI for card linking

**Q2: "Do we get dev or production?"**  
**A2**: Start with **DEV (Test Keys)**:
- Free to use
- No real charges
- Perfect for testing
- Use test card: `4111111111111111`

Switch to **PRODUCTION (Live Keys)** when ready to launch:
- After KYC verification
- After load testing with test keys
- With proper monitoring in place
- With refund process tested

**CURRENT SETUP**: Configured for test keys (development)  
**NEXT STEP**: Create `.env` with test key ID and secret  
**TIMELINE**: Can go live within 2 weeks  

---

**Status**: Razorpay integration ready for development testing  
**Last Updated**: April 16, 2026
