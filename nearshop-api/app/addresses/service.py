"""
Service Layer for User Addresses
Business logic, validation, and database operations
"""

from datetime import datetime
from typing import List, Optional
import uuid
from sqlalchemy import and_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.auth.models import UserAddress
from app.schemas_missing_features import AddressCreate, AddressUpdate, AddressResponse
from app.core.exceptions import AppException


def _to_address_response(address: UserAddress) -> AddressResponse:
    return AddressResponse(
        id=address.id,
        label=address.label,
        street=address.address_line1,
        city=address.city,
        state=address.state or "",
        postal_code=address.pincode,
        country="India",
        phone=address.phone or "",
        alternate_phone=address.address_line2,
        latitude=address.latitude,
        longitude=address.longitude,
        is_default=bool(address.is_default),
        is_billing=False,
        created_at=address.created_at,
        updated_at=address.updated_at or address.created_at,
    )


class AddressService:
    """Service for managing user addresses"""
    
    @staticmethod
    async def create_address(
        db: Session,
        user_id: uuid.UUID,
        address_data: AddressCreate
    ) -> AddressResponse:
        """Create a new address for user"""
        try:
            # If this is the first address, make it default
            existing_count = db.query(UserAddress).filter(UserAddress.user_id == user_id).count()
            
            is_default = address_data.is_default or (existing_count == 0)
            
            # If setting as default, unset previous defaults
            if is_default:
                db.query(UserAddress).filter(
                    and_(UserAddress.user_id == user_id, UserAddress.is_default == True)
                ).update({UserAddress.is_default: False})
            
            # Create new address
            address = UserAddress(
                user_id=user_id,
                label=address_data.label,
                full_name=address_data.label,
                phone=address_data.phone,
                address_line1=address_data.street,
                address_line2=address_data.alternate_phone,
                city=address_data.city,
                state=address_data.state,
                pincode=address_data.postal_code,
                landmark=None,
                latitude=address_data.latitude,
                longitude=address_data.longitude,
                is_default=is_default,
            )
            
            db.add(address)
            db.commit()
            db.refresh(address)
            
            return _to_address_response(address)
        
        except IntegrityError as e:
            db.rollback()
            raise AppException(
                detail="Invalid address data",
                error_code="INVALID_ADDRESS"
            )
    
    @staticmethod
    async def get_user_addresses(
        db: Session,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50
    ) -> tuple[List[AddressResponse], int]:
        """Get all non-deleted addresses for user"""
        query = db.query(UserAddress).filter(
            UserAddress.user_id == user_id
        )
        
        total = query.count()
        addresses = query.offset(skip).limit(limit).all()
        
        return [_to_address_response(addr) for addr in addresses], total
    
    @staticmethod
    async def get_address(
        db: Session,
        user_id: uuid.UUID,
        address_id: uuid.UUID
    ) -> Optional[AddressResponse]:
        """Get single address by ID (owner verification)"""
        address = db.query(UserAddress).filter(
            and_(UserAddress.id == address_id, UserAddress.user_id == user_id)
        ).first()
        
        if not address:
            raise AppException(
                detail="Address not found",
                error_code="ADDRESS_NOT_FOUND",
                status_code=404
            )
        
        return _to_address_response(address)
    
    @staticmethod
    async def update_address(
        db: Session,
        user_id: uuid.UUID,
        address_id: uuid.UUID,
        update_data: AddressUpdate
    ) -> AddressResponse:
        """Update address (owner verification)"""
        address = db.query(UserAddress).filter(
            and_(UserAddress.id == address_id, UserAddress.user_id == user_id)
        ).first()
        
        if not address:
            raise AppException(
                detail="Address not found",
                error_code="ADDRESS_NOT_FOUND",
                status_code=404
            )
        
        # Update only provided fields
        update_dict = update_data.dict(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                if key == "street":
                    address.address_line1 = value
                elif key == "postal_code":
                    address.pincode = value
                elif key == "alternate_phone":
                    address.address_line2 = value
                else:
                    setattr(address, key, value)
        
        address.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(address)
        
        return _to_address_response(address)
    
    @staticmethod
    async def delete_address(
        db: Session,
        user_id: uuid.UUID,
        address_id: uuid.UUID
    ) -> bool:
        """Soft delete address"""
        address = db.query(UserAddress).filter(
            and_(UserAddress.id == address_id, UserAddress.user_id == user_id)
        ).first()
        
        if not address:
            raise AppException(
                detail="Address not found",
                error_code="ADDRESS_NOT_FOUND",
                status_code=404
            )
        
        # If this was the default, unset it
        if address.is_default:
            next_address = db.query(UserAddress).filter(
                and_(UserAddress.user_id == user_id, UserAddress.id != address_id)
            ).first()
            
            if next_address:
                next_address.is_default = True
        
        db.delete(address)
        db.commit()
        
        return True
    
    @staticmethod
    async def set_default_address(
        db: Session,
        user_id: uuid.UUID,
        address_id: uuid.UUID
    ) -> AddressResponse:
        """Set address as default shipping address"""
        address = db.query(UserAddress).filter(
            and_(UserAddress.id == address_id, UserAddress.user_id == user_id)
        ).first()
        
        if not address:
            raise AppException(
                detail="Address not found",
                error_code="ADDRESS_NOT_FOUND",
                status_code=404
            )
        
        # Unset previous defaults
        db.query(UserAddress).filter(
            and_(UserAddress.user_id == user_id, UserAddress.is_default == True, UserAddress.id != address_id)
        ).update({UserAddress.is_default: False})
        
        # Set as default
        address.is_default = True
        address.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(address)
        
        return _to_address_response(address)
    
    @staticmethod
    async def set_billing_address(
        db: Session,
        user_id: uuid.UUID,
        address_id: uuid.UUID
    ) -> AddressResponse:
        """Set address as billing address"""
        address = db.query(UserAddress).filter(
            and_(UserAddress.id == address_id, UserAddress.user_id == user_id)
        ).first()
        
        if not address:
            raise AppException(
                detail="Address not found",
                error_code="ADDRESS_NOT_FOUND",
                status_code=404
            )
        
        # Unset previous billing addresses
        db.query(UserAddress).filter(
            and_(
                UserAddress.user_id == user_id,
                UserAddress.is_billing == True,
                UserAddress.id != address_id,
                UserAddress.deleted_at == None
            )
        ).update({UserAddress.is_billing: False})
        
        # Set as billing
        address.is_billing = True
        address.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(address)
        
        return AddressResponse.from_orm(address)
    
    @staticmethod
    async def get_default_address(
        db: Session,
        user_id: uuid.UUID
    ) -> Optional[AddressResponse]:
        """Get user's default address"""
        address = db.query(UserAddress).filter(
            and_(
                UserAddress.user_id == user_id,
                UserAddress.is_default == True,
                UserAddress.deleted_at == None
            )
        ).first()
        
        if not address:
            return None
        
        return _to_address_response(address)
    
    @staticmethod
    async def get_billing_address(
        db: Session,
        user_id: uuid.UUID
    ) -> Optional[AddressResponse]:
        """Get user's billing address"""
        address = db.query(UserAddress).filter(
            UserAddress.user_id == user_id
        ).first()
        
        if not address:
            return None
        
        return _to_address_response(address)
