"""
Payment Module Initialization
Initializes Razorpay payment service and registers routes
"""

import logging
from fastapi import FastAPI
from app.payments.config import RazorpayConfig

logger = logging.getLogger(__name__)

try:
    from app.payments.routes import router
except ImportError:
    from app.payments.router import router

__all__ = ["router", "init_payment_service", "register_payment_routes"]


def init_payment_service():
    """Initialize payment service"""
    try:
        # Validate configuration
        if not RazorpayConfig.validate():
            logger.warning("⚠️  Razorpay configuration incomplete")
        
        # Log configuration
        config = RazorpayConfig.get_display_config()
        logger.info("✅ Payment Service Initialized")
        logger.info(f"   Environment: {config['environment']}")
        logger.info(f"   Mode: {'Production' if config['is_production'] else 'Test'}")
        logger.info(f"   Card Payments: {config['card_payments']}")
        logger.info(f"   UPI Payments: {config['upi_payments']}")
        logger.info(f"   Wallet Payments: {config['wallet_payments']}")
        
        return True
    except Exception as e:
        logger.error(f"❌ Failed to initialize payment service: {str(e)}")
        return False


def register_payment_routes(app: FastAPI):
    """Register payment routes with FastAPI app"""
    try:
        app.include_router(router)
        logger.info("✅ Payment routes registered")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to register payment routes: {str(e)}")
        return False
