"""
Service Layer for Saved Payment Methods
Business logic for managing tokenized payment methods
"""

from datetime import datetime
from typing import List, Optional
import uuid
from sqlalchemy import and_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models_missing_features import SavedPaymentMethod
from app.schemas_missing_features import (
    CardPaymentCreate,
    UPIPaymentCreate,
    WalletPaymentCreate,
    PaymentMethodResponse,
)
from app.core.exceptions import AppException


class PaymentMethodService:
    """Service for managing saved payment methods"""
    
    @staticmethod
    async def create_payment_method(
        db: Session,
        user_id: uuid.UUID,
        payment_data
    ) -> PaymentMethodResponse:
        """Create a new payment method (card, UPI, or wallet)"""
        try:
            # If this is the first payment method, make it default
            existing_count = db.query(SavedPaymentMethod).filter(
                and_(
                    SavedPaymentMethod.user_id == user_id,
                    SavedPaymentMethod.is_active == True
                )
            ).count()
            
            is_default = existing_count == 0
            
            # If setting as default, unset previous defaults
            if is_default:
                db.query(SavedPaymentMethod).filter(
                    and_(
                        SavedPaymentMethod.user_id == user_id,
                        SavedPaymentMethod.is_default == True
                    )
                ).update({SavedPaymentMethod.is_default: False})
            
            # Create payment method based on type
            if isinstance(payment_data, CardPaymentCreate):
                payment_method = SavedPaymentMethod(
                    user_id=user_id,
                    payment_type="razorpay_card",
                    card_token=payment_data.card_token,
                    card_last_4=payment_data.card_last_4,
                    card_brand=payment_data.card_brand.lower(),
                    card_expiry=payment_data.card_expiry,
                    display_name=payment_data.display_name or f"{payment_data.card_brand} *{payment_data.card_last_4}",
                    is_default=is_default,
                    is_active=payment_data.is_active,
                )
            
            elif isinstance(payment_data, UPIPaymentCreate):
                # Validate UPI ID format
                if '@' not in payment_data.upi_id:
                    raise AppException(
                        detail="Invalid UPI ID format",
                        error_code="INVALID_UPI_ID"
                    )
                
                payment_method = SavedPaymentMethod(
                    user_id=user_id,
                    payment_type="upi",
                    upi_id=payment_data.upi_id.lower(),
                    display_name=payment_data.display_name or payment_data.upi_id,
                    is_default=is_default,
                    is_active=payment_data.is_active,
                )
            
            elif isinstance(payment_data, WalletPaymentCreate):
                payment_method = SavedPaymentMethod(
                    user_id=user_id,
                    payment_type="wallet",
                    wallet_id=payment_data.wallet_id,
                    wallet_balance=payment_data.wallet_balance,
                    display_name=payment_data.display_name or "Wallet",
                    is_default=is_default,
                    is_active=payment_data.is_active,
                )
            else:
                raise AppException(
                    detail="Invalid payment type",
                    error_code="INVALID_PAYMENT_TYPE"
                )
            
            db.add(payment_method)
            db.commit()
            db.refresh(payment_method)
            
            return PaymentMethodResponse.from_orm(payment_method)
        
        except IntegrityError as e:
            db.rollback()
            raise AppException(
                detail="Payment method creation failed",
                error_code="PAYMENT_CREATE_FAILED"
            )
    
    @staticmethod
    async def get_payment_methods(
        db: Session,
        user_id: uuid.UUID,
        active_only: bool = True,
        skip: int = 0,
        limit: int = 50
    ) -> tuple[List[PaymentMethodResponse], int]:
        """Get all payment methods for user"""
        query = db.query(SavedPaymentMethod).filter(
            SavedPaymentMethod.user_id == user_id
        )
        
        if active_only:
            query = query.filter(SavedPaymentMethod.is_active == True)
        
        total = query.count()
        methods = query.offset(skip).limit(limit).all()
        
        return [PaymentMethodResponse.from_orm(m) for m in methods], total
    
    @staticmethod
    async def get_payment_method(
        db: Session,
        user_id: uuid.UUID,
        method_id: uuid.UUID
    ) -> Optional[PaymentMethodResponse]:
        """Get single payment method by ID (owner verification)"""
        method = db.query(SavedPaymentMethod).filter(
            and_(
                SavedPaymentMethod.id == method_id,
                SavedPaymentMethod.user_id == user_id
            )
        ).first()
        
        if not method:
            raise AppException(
                detail="Payment method not found",
                error_code="PAYMENT_METHOD_NOT_FOUND",
                status_code=404
            )
        
        return PaymentMethodResponse.from_orm(method)
    
    @staticmethod
    async def delete_payment_method(
        db: Session,
        user_id: uuid.UUID,
        method_id: uuid.UUID
    ) -> bool:
        """Deactivate payment method"""
        method = db.query(SavedPaymentMethod).filter(
            and_(
                SavedPaymentMethod.id == method_id,
                SavedPaymentMethod.user_id == user_id
            )
        ).first()
        
        if not method:
            raise AppException(
                detail="Payment method not found",
                error_code="PAYMENT_METHOD_NOT_FOUND",
                status_code=404
            )
        
        # If this was the default, find another one
        if method.is_default:
            next_method = db.query(SavedPaymentMethod).filter(
                and_(
                    SavedPaymentMethod.user_id == user_id,
                    SavedPaymentMethod.id != method_id,
                    SavedPaymentMethod.is_active == True
                )
            ).first()
            
            if next_method:
                next_method.is_default = True
        
        method.is_active = False
        db.commit()
        
        return True
    
    @staticmethod
    async def set_default_payment_method(
        db: Session,
        user_id: uuid.UUID,
        method_id: uuid.UUID
    ) -> PaymentMethodResponse:
        """Set payment method as default"""
        method = db.query(SavedPaymentMethod).filter(
            and_(
                SavedPaymentMethod.id == method_id,
                SavedPaymentMethod.user_id == user_id,
                SavedPaymentMethod.is_active == True
            )
        ).first()
        
        if not method:
            raise AppException(
                detail="Payment method not found or inactive",
                error_code="PAYMENT_METHOD_NOT_FOUND",
                status_code=404
            )
        
        # Unset previous defaults
        db.query(SavedPaymentMethod).filter(
            and_(
                SavedPaymentMethod.user_id == user_id,
                SavedPaymentMethod.is_default == True,
                SavedPaymentMethod.id != method_id
            )
        ).update({SavedPaymentMethod.is_default: False})
        
        # Set as default
        method.is_default = True
        method.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(method)
        
        return PaymentMethodResponse.from_orm(method)
    
    @staticmethod
    async def get_default_payment_method(
        db: Session,
        user_id: uuid.UUID
    ) -> Optional[PaymentMethodResponse]:
        """Get user's default payment method"""
        method = db.query(SavedPaymentMethod).filter(
            and_(
                SavedPaymentMethod.user_id == user_id,
                SavedPaymentMethod.is_default == True,
                SavedPaymentMethod.is_active == True
            )
        ).first()
        
        if not method:
            return None
        
        return PaymentMethodResponse.from_orm(method)
    
    @staticmethod
    async def validate_payment_method(
        db: Session,
        user_id: uuid.UUID,
        method_id: uuid.UUID
    ) -> bool:
        """
        Validate that payment method is active and belongs to user
        Can be extended to check with payment gateway
        """
        method = db.query(SavedPaymentMethod).filter(
            and_(
                SavedPaymentMethod.id == method_id,
                SavedPaymentMethod.user_id == user_id,
                SavedPaymentMethod.is_active == True
            )
        ).first()
        
        if not method:
            return False
        
        # Additional validation based on payment type
        if method.payment_type == "razorpay_card":
            # Could check with Razorpay API here
            return method.card_token is not None
        
        elif method.payment_type == "upi":
            return method.upi_id is not None and '@' in method.upi_id
        
        elif method.payment_type == "wallet":
            return method.wallet_id is not None
        
        return False
