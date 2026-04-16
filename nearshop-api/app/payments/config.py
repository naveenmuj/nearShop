"""
Razorpay Configuration Module
Manages environment-specific settings and credentials
"""

import os
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class RazorpayConfig:
    """Razorpay configuration management"""
    
    # Environment settings
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
    IS_PRODUCTION = ENVIRONMENT == 'production'
    IS_TEST = ENVIRONMENT in ['test', 'development']
    
    # API Credentials
    KEY_ID = os.getenv('RAZORPAY_KEY_ID', 'rzp_test_Se0IvnodYcJICB')
    KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET', 'y6znuVjA3XtS9okM3Zel44gI')
    
    # Webhook Configuration
    WEBHOOK_SECRET = os.getenv('RAZORPAY_WEBHOOK_SECRET', 'webhook_secret_test_key')
    WEBHOOK_URL = os.getenv('RAZORPAY_WEBHOOK_URL', 'https://api.nearshop.local/api/v1/payments/webhooks/razorpay')
    
    # Payment Settings
    CURRENCY = 'INR'
    RECEIPT_PREFIX = 'nearshop_'
    TIMEOUT_SECONDS = 300
    
    # Feature Flags
    ENABLE_CARD_PAYMENTS = os.getenv('ENABLE_CARD_PAYMENTS', 'true').lower() == 'true'
    ENABLE_UPI_PAYMENTS = os.getenv('ENABLE_UPI_PAYMENTS', 'true').lower() == 'true'
    ENABLE_WALLET_PAYMENTS = os.getenv('ENABLE_WALLET_PAYMENTS', 'true').lower() == 'true'
    ENABLE_NETBANKING = os.getenv('ENABLE_NETBANKING', 'true').lower() == 'true'
    
    # Refund Settings
    ALLOW_PARTIAL_REFUNDS = True
    REFUND_TIMEOUT_DAYS = 180
    
    # Test Mode Settings
    TEST_CARDS = {
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
            'name': 'Declined Card'
        }
    }
    
    TEST_UPI_IDS = [
        'success@okhdfcbank',
        'testuser@okaxis',
        'customer@okhdfcbank',
    ]
    
    @classmethod
    def validate(cls) -> bool:
        """Validate configuration"""
        errors = []
        
        if not cls.KEY_ID:
            errors.append("RAZORPAY_KEY_ID not configured")
        
        if not cls.KEY_SECRET:
            errors.append("RAZORPAY_KEY_SECRET not configured")
        
        if not cls.WEBHOOK_SECRET:
            errors.append("RAZORPAY_WEBHOOK_SECRET not configured")
        
        if errors:
            logger.error("Configuration errors:")
            for error in errors:
                logger.error(f"  - {error}")
            return False
        
        logger.info("✅ Razorpay configuration validated")
        return True
    
    @classmethod
    def get_display_config(cls) -> Dict[str, str]:
        """Get configuration for display (safe for logging)"""
        return {
            'environment': cls.ENVIRONMENT,
            'is_production': cls.IS_PRODUCTION,
            'key_id': cls.KEY_ID[:20] + '***' if cls.KEY_ID else 'Not configured',
            'currency': cls.CURRENCY,
            'card_payments': cls.ENABLE_CARD_PAYMENTS,
            'upi_payments': cls.ENABLE_UPI_PAYMENTS,
            'wallet_payments': cls.ENABLE_WALLET_PAYMENTS,
            'netbanking': cls.ENABLE_NETBANKING,
            'test_mode': cls.IS_TEST
        }


# Validate on import
if not RazorpayConfig.validate():
    logger.warning("Razorpay configuration incomplete - payments may not work")
