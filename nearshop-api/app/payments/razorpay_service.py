"""
Razorpay Payment Service Integration
Handles card tokenization, payment validation, and webhook processing
"""

import razorpay
import logging
from typing import Dict, Optional, Any
import hashlib
import hmac
from datetime import datetime
import os

logger = logging.getLogger(__name__)

# Razorpay Configuration
RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID', 'rzp_test_Se0IvnodYcJICB')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET', 'y6znuVjA3XtS9okM3Zel44gI')
RAZORPAY_MODE = os.getenv('RAZORPAY_MODE', 'test')


class RazorpayPaymentService:
    """
    Service for handling Razorpay payments
    
    Supports:
    - Card tokenization
    - Order creation
    - Payment verification
    - Webhook signature verification
    - Refunds
    """

    def __init__(self):
        """Initialize Razorpay client"""
        try:
            self.client = razorpay.Client(
                auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
            )
            self.mode = RAZORPAY_MODE
            logger.info(f"Razorpay client initialized in {self.mode} mode")
        except Exception as e:
            logger.error(f"Failed to initialize Razorpay client: {str(e)}")
            raise

    async def create_order(
        self,
        amount: float,
        user_id: str,
        order_id: str,
        receipt: Optional[str] = None,
        notes: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Create Razorpay order
        
        Args:
            amount: Order amount in rupees
            user_id: User identifier
            order_id: Internal order ID
            receipt: Receipt number (optional)
            notes: Additional notes (optional)
        
        Returns:
            Order details with Razorpay order ID
        """
        try:
            order_data = {
                'amount': int(amount * 100),  # Convert to paise
                'currency': 'INR',
                'receipt': receipt or f'order_{order_id}_{datetime.now().timestamp()}',
                'notes': notes or {
                    'user_id': str(user_id),
                    'order_id': str(order_id),
                    'mode': 'test' if self.mode == 'test' else 'live'
                }
            }
            
            response = self.client.order.create(data=order_data)
            
            logger.info(f"Order created: {response['id']} - Amount: ₹{amount}")
            
            return {
                'success': True,
                'razorpay_order_id': response['id'],
                'amount': amount,
                'currency': 'INR',
                'created_at': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to create order: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'ORDER_CREATION_FAILED'
            }

    async def tokenize_card(
        self,
        card_token: str,
        card_last4: Optional[str] = None,
        card_brand: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate and store card token
        
        Args:
            card_token: Token from Razorpay
            card_last4: Last 4 digits of card (optional)
            card_brand: Card brand (optional)
        
        Returns:
            Token validation result
        """
        try:
            # Verify token format
            if not card_token or len(card_token) < 10:
                raise ValueError("Invalid card token format")
            
            logger.info(f"Card token validated: {card_token[:10]}...")
            
            return {
                'success': True,
                'card_token': card_token,
                'card_last4': card_last4 or 'XXXX',
                'card_brand': card_brand or 'Unknown',
                'tokenized_at': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Card tokenization failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CARD_TOKENIZATION_FAILED'
            }

    async def verify_payment(
        self,
        payment_id: str,
        order_id: str,
        signature: str
    ) -> Dict[str, Any]:
        """
        Verify payment signature from Razorpay webhook
        
        Args:
            payment_id: Razorpay payment ID
            order_id: Razorpay order ID
            signature: HMAC signature from webhook
        
        Returns:
            Verification result
        """
        try:
            # Create signature string
            sig_string = f"{order_id}|{payment_id}"
            
            # Verify signature
            computed_sig = hmac.new(
                RAZORPAY_KEY_SECRET.encode(),
                sig_string.encode(),
                hashlib.sha256
            ).hexdigest()
            
            is_valid = computed_sig == signature
            
            if is_valid:
                logger.info(f"Payment verified: {payment_id}")
            else:
                logger.warning(f"Invalid signature for payment: {payment_id}")
            
            return {
                'success': is_valid,
                'payment_id': payment_id,
                'order_id': order_id,
                'verified_at': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Payment verification failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'PAYMENT_VERIFICATION_FAILED'
            }

    async def validate_payment_method(
        self,
        payment_type: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Validate payment method before checkout
        
        Args:
            payment_type: Type of payment (card, upi, wallet)
            **kwargs: Type-specific parameters
        
        Returns:
            Validation result
        """
        try:
            if payment_type == 'card':
                token = kwargs.get('card_token')
                if not token or len(token) < 10:
                    raise ValueError("Invalid card token")
                validation_type = 'Card Token'
            
            elif payment_type == 'upi':
                upi_id = kwargs.get('upi_id')
                if not upi_id or '@' not in upi_id:
                    raise ValueError("Invalid UPI format")
                validation_type = 'UPI ID'
            
            elif payment_type == 'wallet':
                wallet_id = kwargs.get('wallet_id')
                if not wallet_id:
                    raise ValueError("Invalid wallet ID")
                validation_type = 'Wallet'
            
            else:
                raise ValueError(f"Unknown payment type: {payment_type}")
            
            logger.info(f"{validation_type} validated successfully")
            
            return {
                'success': True,
                'payment_type': payment_type,
                'validated_at': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Payment validation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'PAYMENT_VALIDATION_FAILED'
            }

    async def process_refund(
        self,
        payment_id: str,
        amount: Optional[float] = None,
        reason: Optional[str] = None,
        notes: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Process refund for a payment
        
        Args:
            payment_id: Razorpay payment ID
            amount: Amount to refund in rupees (None = full refund)
            reason: Refund reason (optional)
            notes: Additional notes (optional)
        
        Returns:
            Refund result
        """
        try:
            refund_data = {
                'notes': notes or {'reason': reason or 'Customer requested refund'}
            }
            
            if amount:
                refund_data['amount'] = int(amount * 100)  # Convert to paise
            
            response = self.client.payment.refund(payment_id, refund_data)
            
            logger.info(f"Refund processed: {response['id']} for payment {payment_id}")
            
            return {
                'success': True,
                'refund_id': response['id'],
                'payment_id': payment_id,
                'amount': amount,
                'status': response.get('status', 'processed'),
                'refunded_at': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Refund processing failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'REFUND_PROCESSING_FAILED'
            }

    async def verify_webhook_signature(
        self,
        webhook_body: str,
        signature_header: str,
        webhook_secret: Optional[str] = None
    ) -> bool:
        """
        Verify webhook signature from Razorpay
        
        Args:
            webhook_body: Raw webhook body
            signature_header: X-Razorpay-Signature header
            webhook_secret: Webhook secret (optional)
        
        Returns:
            True if signature is valid
        """
        try:
            secret = webhook_secret or RAZORPAY_KEY_SECRET
            
            computed_sig = hmac.new(
                secret.encode(),
                webhook_body.encode(),
                hashlib.sha256
            ).hexdigest()
            
            is_valid = computed_sig == signature_header
            
            if is_valid:
                logger.info("Webhook signature verified successfully")
            else:
                logger.warning("Invalid webhook signature detected")
            
            return is_valid
        except Exception as e:
            logger.error(f"Webhook signature verification failed: {str(e)}")
            return False

    async def get_payment_details(self, payment_id: str) -> Dict[str, Any]:
        """
        Get payment details from Razorpay
        
        Args:
            payment_id: Razorpay payment ID
        
        Returns:
            Payment details
        """
        try:
            response = self.client.payment.fetch(payment_id)
            
            logger.info(f"Payment details fetched: {payment_id}")
            
            return {
                'success': True,
                'payment_id': payment_id,
                'amount': response.get('amount', 0) / 100,  # Convert from paise
                'currency': response.get('currency', 'INR'),
                'status': response.get('status', 'unknown'),
                'method': response.get('method', 'unknown'),
                'created_at': response.get('created_at')
            }
        except Exception as e:
            logger.error(f"Failed to fetch payment details: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'FETCH_PAYMENT_FAILED'
            }

    async def get_order_details(self, order_id: str) -> Dict[str, Any]:
        """
        Get order details from Razorpay
        
        Args:
            order_id: Razorpay order ID
        
        Returns:
            Order details
        """
        try:
            response = self.client.order.fetch(order_id)
            
            logger.info(f"Order details fetched: {order_id}")
            
            return {
                'success': True,
                'order_id': order_id,
                'amount': response.get('amount', 0) / 100,  # Convert from paise
                'currency': response.get('currency', 'INR'),
                'status': response.get('status', 'unknown'),
                'receipt': response.get('receipt'),
                'created_at': response.get('created_at')
            }
        except Exception as e:
            logger.error(f"Failed to fetch order details: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'FETCH_ORDER_FAILED'
            }

    def get_test_cards(self) -> Dict[str, Dict[str, str]]:
        """
        Get available test cards for development
        
        Returns:
            Dictionary of test cards
        """
        return {
            'visa_success': {
                'number': '4111111111111111',
                'expiry': '12/25',
                'cvv': '123',
                'name': 'Test Visa'
            },
            'mastercard_success': {
                'number': '5555555555554444',
                'expiry': '12/25',
                'cvv': '123',
                'name': 'Test Mastercard'
            },
            'amex_success': {
                'number': '378282246310005',
                'expiry': '12/25',
                'cvv': '123',
                'name': 'Test Amex'
            },
            'declined_card': {
                'number': '4000000000000002',
                'expiry': '12/25',
                'cvv': '123',
                'name': 'Test Declined'
            }
        }

    def get_configuration(self) -> Dict[str, str]:
        """
        Get current Razorpay configuration
        
        Returns:
            Configuration details
        """
        return {
            'mode': self.mode,
            'key_id': RAZORPAY_KEY_ID[:20] + '***' if RAZORPAY_KEY_ID else 'Not configured',
            'test_environment': self.mode == 'test',
            'initialized': True
        }


# Singleton instance
razorpay_service = RazorpayPaymentService()

logger.info(f"Razorpay Service initialized - Mode: {RAZORPAY_MODE}")
