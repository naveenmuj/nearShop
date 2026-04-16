"""
API Router for Saved Payment Methods
REST endpoints for managing saved cards, UPI, wallets
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import uuid

from app.core.database import get_db
from app.auth.permissions import get_current_user
from app.payments.service import PaymentMethodService
from app.schemas_missing_features import (
    CardPaymentCreate,
    UPIPaymentCreate,
    WalletPaymentCreate,
    PaymentMethodResponse,
    PaymentMethodListResponse,
)


router = APIRouter(
    prefix="/api/v1/payments/methods",
    tags=["payment-methods"],
    dependencies=[Depends(get_current_user)]
)


@router.post("", response_model=PaymentMethodResponse)
async def create_payment_method(
    payment_data: CardPaymentCreate | UPIPaymentCreate | WalletPaymentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Add a new payment method.
    
    Supports:
    - Card: Razorpay card token
    - UPI: UPI ID (e.g., user@bank)
    - Wallet: Wallet ID with balance
    
    First method becomes default automatically.
    """
    return await PaymentMethodService.create_payment_method(
        db=db,
        user_id=current_user.id,
        payment_data=payment_data
    )


@router.get("", response_model=PaymentMethodListResponse)
async def list_payment_methods(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get all saved payment methods with pagination."""
    methods, total = await PaymentMethodService.get_payment_methods(
        db=db,
        user_id=current_user.id,
        active_only=active_only,
        skip=skip,
        limit=limit
    )
    
    # Find default method ID
    default_id = None
    for method in methods:
        if method.is_default:
            default_id = method.id
            break
    
    return PaymentMethodListResponse(
        methods=methods,
        total=total,
        default_method_id=default_id
    )


@router.get("/{method_id}", response_model=PaymentMethodResponse)
async def get_payment_method(
    method_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get a specific payment method by ID."""
    return await PaymentMethodService.get_payment_method(
        db=db,
        user_id=current_user.id,
        method_id=method_id
    )


@router.delete("/{method_id}")
async def delete_payment_method(
    method_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Delete/deactivate a payment method."""
    success = await PaymentMethodService.delete_payment_method(
        db=db,
        user_id=current_user.id,
        method_id=method_id
    )
    return {"success": success, "message": "Payment method deleted"}


@router.post("/{method_id}/set-default", response_model=PaymentMethodResponse)
async def set_default_payment_method(
    method_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Set this payment method as the default."""
    return await PaymentMethodService.set_default_payment_method(
        db=db,
        user_id=current_user.id,
        method_id=method_id
    )


@router.get("/default/active", response_model=PaymentMethodResponse)
async def get_default_payment_method(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get the user's default payment method."""
    method = await PaymentMethodService.get_default_payment_method(
        db=db,
        user_id=current_user.id
    )
    
    if not method:
        raise HTTPException(
            status_code=404,
            detail="No default payment method set"
        )
    
    return method


@router.post("/{method_id}/validate")
async def validate_payment_method(
    method_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Validate that a payment method is active and usable.
    Can be extended to verify with payment gateway.
    """
    is_valid = await PaymentMethodService.validate_payment_method(
        db=db,
        user_id=current_user.id,
        method_id=method_id
    )
    
    return {
        "valid": is_valid,
        "message": "Payment method is valid and ready to use" if is_valid else "Payment method is invalid or inactive"
    }
