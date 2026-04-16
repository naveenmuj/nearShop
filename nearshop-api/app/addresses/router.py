"""
API Router for User Addresses
REST endpoints for managing saved addresses
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import uuid

from app.core.dependencies import get_db, get_current_user
from app.addresses.service import AddressService
from app.schemas_missing_features import (
    AddressCreate,
    AddressUpdate,
    AddressResponse,
    AddressListResponse,
)


router = APIRouter(
    prefix="/api/v1/addresses",
    tags=["addresses"],
    dependencies=[Depends(get_current_user)]
)


@router.post("", response_model=AddressResponse)
async def create_address(
    address_data: AddressCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Create a new address for the current user.
    
    If no addresses exist, this becomes the default.
    """
    return await AddressService.create_address(
        db=db,
        user_id=current_user.id,
        address_data=address_data
    )


@router.get("", response_model=AddressListResponse)
async def list_addresses(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get all addresses for the current user with pagination."""
    addresses, total = await AddressService.get_user_addresses(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit
    )
    
    # Find default address ID
    default_id = None
    for addr in addresses:
        if addr.is_default:
            default_id = addr.id
            break
    
    return AddressListResponse(
        addresses=addresses,
        total=total,
        default_address_id=default_id
    )


@router.get("/{address_id}", response_model=AddressResponse)
async def get_address(
    address_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get a specific address by ID."""
    return await AddressService.get_address(
        db=db,
        user_id=current_user.id,
        address_id=address_id
    )


@router.put("/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: uuid.UUID,
    update_data: AddressUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update an existing address."""
    return await AddressService.update_address(
        db=db,
        user_id=current_user.id,
        address_id=address_id,
        update_data=update_data
    )


@router.delete("/{address_id}")
async def delete_address(
    address_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Delete an address (soft delete)."""
    success = await AddressService.delete_address(
        db=db,
        user_id=current_user.id,
        address_id=address_id
    )
    return {"success": success, "message": "Address deleted successfully"}


@router.post("/{address_id}/set-default", response_model=AddressResponse)
async def set_default_address(
    address_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Set this address as the default shipping address."""
    return await AddressService.set_default_address(
        db=db,
        user_id=current_user.id,
        address_id=address_id
    )


@router.post("/{address_id}/set-billing", response_model=AddressResponse)
async def set_billing_address(
    address_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Set this address as the billing address."""
    return await AddressService.set_billing_address(
        db=db,
        user_id=current_user.id,
        address_id=address_id
    )


@router.get("/default/shipping", response_model=AddressResponse)
async def get_default_address(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get the user's default shipping address."""
    address = await AddressService.get_default_address(
        db=db,
        user_id=current_user.id
    )
    
    if not address:
        raise HTTPException(
            status_code=404,
            detail="No default address set"
        )
    
    return address


@router.get("/default/billing", response_model=AddressResponse)
async def get_billing_address(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get the user's billing address."""
    address = await AddressService.get_billing_address(
        db=db,
        user_id=current_user.id
    )
    
    if not address:
        raise HTTPException(
            status_code=404,
            detail="No billing address set"
        )
    
    return address
