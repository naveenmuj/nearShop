"""
Payment API Endpoints
Handles payment methods, order creation, and webhook processing
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Body
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging
from datetime import datetime
import json

from app.payments.razorpay_service import razorpay_service
from app.auth.permissions import get_current_user
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])


# ============= Pydantic Models =============

class CardDetails(BaseModel):
    """Card payment details"""
    card_token: str
    card_last4: str
    card_brand: str
    card_expiry_month: int
    card_expiry_year: int
    display_name: Optional[str] = None


class UPIDetails(BaseModel):
    """UPI payment details"""
    upi_id: str
    display_name: Optional[str] = None


class PaymentMethod(BaseModel):
    """Payment method"""
    type: str = Field(..., description="card, upi, wallet, netbanking")
    card_token: Optional[str] = None
    card_last4: Optional[str] = None
    card_brand: Optional[str] = None
    card_expiry_month: Optional[int] = None
    card_expiry_year: Optional[int] = None
    upi_id: Optional[str] = None
    wallet_id: Optional[str] = None
    display_name: Optional[str] = None
    is_default: bool = False


class OrderItem(BaseModel):
    """Order line item"""
    product_id: str
    quantity: int
    price: float


class CreateOrderRequest(BaseModel):
    """Create order request"""
    items: List[OrderItem]
    shipping_address_id: str
    billing_address_id: str
    payment_method_id: Optional[str] = None
    total_amount: float
    discount_amount: Optional[float] = 0.0
    delivery_type: Optional[str] = "standard"
    delivery_fee: Optional[float] = 0.0
    notes: Optional[str] = None


class WebhookPayload(BaseModel):
    """Razorpay webhook payload"""
    event: str
    created_at: int
    contains: List[str]
    payload: Dict[str, Any]


# ============= Payment Methods =============

@router.post("/methods", status_code=201)
async def save_payment_method(
    payment: PaymentMethod,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Save payment method for user
    
    Supports: card, upi, wallet, netbanking
    """
    try:
        logger.info(f"Saving {payment.type} payment method for user {current_user.id}")
        
        # Validate payment type
        if payment.type == 'card':
            if not payment.card_token:
                raise ValueError("Card token is required")
            
            validation = await razorpay_service.tokenize_card(
                payment.card_token,
                payment.card_last4,
                payment.card_brand
            )
            if not validation['success']:
                raise ValueError(validation['error'])
        
        elif payment.type == 'upi':
            if not payment.upi_id:
                raise ValueError("UPI ID is required")
            
            if '@' not in payment.upi_id:
                raise ValueError("Invalid UPI format")
        
        # Store payment method in database
        # TODO: Implement database storage
        
        result = {
            'id': f"pm_{datetime.now().timestamp()}",
            'type': payment.type,
            'display_name': payment.display_name or f"My {payment.type.upper()}",
            'created_at': datetime.now().isoformat(),
            'user_id': current_user.id
        }
        
        if payment.type == 'card':
            result.update({
                'card_last4': payment.card_last4,
                'card_brand': payment.card_brand,
                'card_expiry': f"{payment.card_expiry_month}/{payment.card_expiry_year}"
            })
        elif payment.type == 'upi':
            result['upi_id'] = payment.upi_id
        
        logger.info(f"Payment method saved: {result['id']}")
        return result
    
    except Exception as e:
        logger.error(f"Failed to save payment method: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/methods")
async def list_payment_methods(
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """List all saved payment methods for user"""
    try:
        logger.info(f"Fetching payment methods for user {current_user.id}")
        
        # TODO: Fetch from database
        
        # Mock response with different payment types
        return [
            {
                'id': 'pm_card_1',
                'type': 'card',
                'card_brand': 'Visa',
                'card_last4': '1111',
                'display_name': 'My Visa Card',
                'is_default': True,
                'created_at': '2024-01-15T10:30:00Z'
            },
            {
                'id': 'pm_upi_1',
                'type': 'upi',
                'upi_id': 'testuser@okhdfcbank',
                'display_name': 'My UPI',
                'is_default': False,
                'created_at': '2024-01-16T14:20:00Z'
            }
        ]
    
    except Exception as e:
        logger.error(f"Failed to fetch payment methods: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/methods/default")
async def get_default_payment_method(
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get default payment method for user"""
    try:
        logger.info(f"Fetching default payment method for user {current_user.id}")
        
        # TODO: Fetch default from database
        
        return {
            'id': 'pm_card_1',
            'type': 'card',
            'card_brand': 'Visa',
            'card_last4': '1111',
            'display_name': 'My Visa Card',
            'is_default': True
        }
    
    except Exception as e:
        logger.error(f"Failed to fetch default payment: {str(e)}")
        raise HTTPException(status_code=404, detail="No default payment method found")


@router.post("/methods/{payment_id}/set-default")
async def set_default_payment_method(
    payment_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Set payment method as default"""
    try:
        logger.info(f"Setting payment {payment_id} as default for user {current_user.id}")
        
        # TODO: Update in database
        
        return {
            'success': True,
            'payment_id': payment_id,
            'is_default': True,
            'updated_at': datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to set default payment: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/methods/{payment_id}/validate")
async def validate_payment_method(
    payment_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Validate payment method"""
    try:
        logger.info(f"Validating payment method {payment_id}")
        
        # TODO: Get payment from database and validate
        
        return {
            'success': True,
            'payment_id': payment_id,
            'is_valid': True,
            'validated_at': datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Payment validation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/methods/{payment_id}")
async def delete_payment_method(
    payment_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete payment method"""
    try:
        logger.info(f"Deleting payment method {payment_id} for user {current_user.id}")
        
        # TODO: Delete from database
        
        return {
            'success': True,
            'payment_id': payment_id,
            'deleted_at': datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to delete payment method: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# ============= Orders =============

@router.post("/orders", status_code=201)
async def create_order(
    order: CreateOrderRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Create order and initiate payment
    
    Returns Razorpay order ID for payment processing
    """
    try:
        logger.info(f"Creating order for user {current_user.id} - Amount: ₹{order.total_amount}")
        
        # Validate order
        if order.total_amount <= 0:
            raise ValueError("Invalid order amount")
        
        if not order.items:
            raise ValueError("Order must contain at least one item")
        
        # Create Razorpay order
        razorpay_order = await razorpay_service.create_order(
            amount=order.total_amount,
            user_id=current_user.id,
            order_id=f"order_{datetime.now().timestamp()}",
            notes={
                'user_id': str(current_user.id),
                'items': len(order.items),
                'delivery': order.delivery_type
            }
        )
        
        if not razorpay_order['success']:
            raise Exception(razorpay_order['error'])
        
        # TODO: Store order in database
        
        result = {
            'id': f"local_order_{datetime.now().timestamp()}",
            'razorpay_order_id': razorpay_order['razorpay_order_id'],
            'user_id': current_user.id,
            'items': order.items,
            'total_amount': order.total_amount,
            'discount_amount': order.discount_amount,
            'delivery_fee': order.delivery_fee,
            'final_amount': order.total_amount - order.discount_amount + order.delivery_fee,
            'shipping_address_id': order.shipping_address_id,
            'billing_address_id': order.billing_address_id,
            'delivery_type': order.delivery_type,
            'status': 'pending_payment',
            'created_at': datetime.now().isoformat(),
            'notes': order.notes
        }
        
        logger.info(f"Order created: {result['id']}")
        return result
    
    except Exception as e:
        logger.error(f"Failed to create order: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders")
async def list_orders(
    skip: int = 0,
    limit: int = 10,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """List orders for user"""
    try:
        logger.info(f"Fetching orders for user {current_user.id}")
        
        # TODO: Fetch from database
        
        return []
    
    except Exception as e:
        logger.error(f"Failed to fetch orders: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get order details"""
    try:
        logger.info(f"Fetching order {order_id} for user {current_user.id}")
        
        # TODO: Fetch from database
        
        return HTTPException(status_code=404, detail="Order not found")
    
    except Exception as e:
        logger.error(f"Failed to fetch order: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= Webhooks =============

@router.post("/webhooks/razorpay")
async def handle_razorpay_webhook(
    payload: Dict[str, Any] = Body(...),
    x_razorpay_signature: Optional[str] = Header(None)
):
    """
    Handle Razorpay webhooks
    
    Processes payment updates from Razorpay
    """
    try:
        logger.info(f"Received webhook: {payload.get('event')}")
        
        # Verify webhook signature
        if x_razorpay_signature:
            webhook_body = json.dumps(payload)
            is_valid = await razorpay_service.verify_webhook_signature(
                webhook_body,
                x_razorpay_signature
            )
            
            if not is_valid:
                logger.warning("Invalid webhook signature")
                raise HTTPException(status_code=401, detail="Invalid signature")
        
        event = payload.get('event')
        event_payload = payload.get('payload', {})
        
        # Handle different event types
        if event == 'payment.authorized':
            payment_entity = event_payload.get('payment', {}).get('entity', {})
            logger.info(f"Payment authorized: {payment_entity.get('id')}")
            # TODO: Update order status to confirmed
        
        elif event == 'payment.failed':
            payment_entity = event_payload.get('payment', {}).get('entity', {})
            logger.warning(f"Payment failed: {payment_entity.get('id')} - {payment_entity.get('error_description')}")
            # TODO: Update order status to failed
        
        elif event == 'payment.captured':
            payment_entity = event_payload.get('payment', {}).get('entity', {})
            logger.info(f"Payment captured: {payment_entity.get('id')}")
            # TODO: Update order status to completed
        
        elif event == 'refund.created':
            refund_entity = event_payload.get('refund', {}).get('entity', {})
            logger.info(f"Refund created: {refund_entity.get('id')}")
            # TODO: Update refund status
        
        return {
            'success': True,
            'event': event,
            'processed_at': datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Webhook processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= Payment Configuration =============

@router.get("/config")
async def get_payment_config():
    """Get payment configuration (public)"""
    try:
        config = razorpay_service.get_configuration()
        
        return {
            'razorpay_enabled': True,
            'razorpay_key': config['key_id'],
            'test_mode': config['test_environment'],
            'supported_methods': ['card', 'upi', 'wallet', 'netbanking'],
            'test_cards': razorpay_service.get_test_cards() if config['test_environment'] else {}
        }
    
    except Exception as e:
        logger.error(f"Failed to fetch payment config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= Refunds =============

@router.post("/refunds")
async def create_refund(
    payment_id: str,
    amount: Optional[float] = None,
    reason: Optional[str] = None,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create refund for payment"""
    try:
        logger.info(f"Creating refund for payment {payment_id}")
        
        result = await razorpay_service.process_refund(
            payment_id=payment_id,
            amount=amount,
            reason=reason,
            notes={'user_id': str(current_user.id)}
        )
        
        if not result['success']:
            raise Exception(result['error'])
        
        # TODO: Store refund in database
        
        return result
    
    except Exception as e:
        logger.error(f"Failed to create refund: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/refunds/{refund_id}")
async def get_refund(
    refund_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get refund details"""
    try:
        logger.info(f"Fetching refund {refund_id}")
        
        # TODO: Fetch from database
        
        return {
            'id': refund_id,
            'status': 'processed',
            'amount': 0,
            'created_at': datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to fetch refund: {str(e)}")
        raise HTTPException(status_code=404, detail="Refund not found")
