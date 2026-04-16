"""
Backend API Tests - Phase 1 Features
Tests all endpoints for Addresses, Payment Methods, and User Profiles

Run with:
    pytest nearshop-api/tests/test_phase1_features.py -v
"""

import pytest
import json
from httpx import AsyncClient
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.main import create_app
from app.models_missing_features import (
    UserAddress, SavedPaymentMethod, UserProfile
)


@pytest.fixture
async def client():
    """Create test client with app"""
    app = create_app()
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_headers():
    """Mock auth headers"""
    return {
        "Authorization": "Bearer test-token-12345",
        "Content-Type": "application/json"
    }


@pytest.fixture
async def test_user_id():
    """Mock user ID"""
    return str(uuid.uuid4())


# ──────────────────────────────────────────────────────────────────────────────
# ADDRESSES API TESTS
# ──────────────────────────────────────────────────────────────────────────────

class TestAddressesAPI:
    """Test suite for saved addresses endpoints"""

    @pytest.mark.asyncio
    async def test_create_address(self, client, auth_headers, test_user_id):
        """POST /api/v1/addresses - Create new address"""
        address_data = {
            "street": "123 Main Street",
            "city": "New Delhi",
            "state": "Delhi",
            "postal_code": "110001",
            "phone": "+919876543210",
            "label": "home",
            "lat": 28.7041,
            "lng": 77.1025,
        }

        response = await client.post(
            "/api/v1/addresses",
            json=address_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        assert response.json()["street"] == "123 Main Street"
        assert response.json()["is_default"] is True  # First address auto-defaults

    @pytest.mark.asyncio
    async def test_list_addresses(self, client, auth_headers):
        """GET /api/v1/addresses - List addresses with pagination"""
        response = await client.get(
            "/api/v1/addresses?skip=0&limit=10",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_address(self, client, auth_headers, test_user_id):
        """GET /api/v1/addresses/{id} - Get single address"""
        # First create an address
        address_data = {
            "street": "Test Street",
            "city": "Test City",
            "state": "Test State",
            "postal_code": "123456",
            "phone": "+919876543210",
            "label": "home",
        }

        create_response = await client.post(
            "/api/v1/addresses",
            json=address_data,
            headers=auth_headers
        )

        address_id = create_response.json()["id"]

        # Get the address
        response = await client.get(
            f"/api/v1/addresses/{address_id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["id"] == address_id
        assert response.json()["street"] == "Test Street"

    @pytest.mark.asyncio
    async def test_update_address(self, client, auth_headers):
        """PUT /api/v1/addresses/{id} - Update address"""
        # Create address
        address_data = {
            "street": "Original Street",
            "city": "Original City",
            "state": "Original State",
            "postal_code": "111111",
            "phone": "+919876543210",
            "label": "home",
        }

        create_response = await client.post(
            "/api/v1/addresses",
            json=address_data,
            headers=auth_headers
        )

        address_id = create_response.json()["id"]

        # Update address
        update_data = {
            "city": "Updated City",
            "state": "Updated State",
        }

        response = await client.put(
            f"/api/v1/addresses/{address_id}",
            json=update_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["city"] == "Updated City"
        assert response.json()["street"] == "Original Street"  # Unchanged

    @pytest.mark.asyncio
    async def test_set_default_address(self, client, auth_headers):
        """POST /api/v1/addresses/{id}/set-default - Set default address"""
        # Create two addresses
        addresses = []
        for i in range(2):
            addr_data = {
                "street": f"Street {i}",
                "city": f"City {i}",
                "state": "State",
                "postal_code": f"{110000 + i}",
                "phone": "+919876543210",
                "label": f"label{i}",
            }

            resp = await client.post(
                "/api/v1/addresses",
                json=addr_data,
                headers=auth_headers
            )
            addresses.append(resp.json())

        # Set second as default
        response = await client.post(
            f"/api/v1/addresses/{addresses[1]['id']}/set-default",
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["is_default"] is True

    @pytest.mark.asyncio
    async def test_set_billing_address(self, client, auth_headers):
        """POST /api/v1/addresses/{id}/set-billing - Set billing address"""
        # Create address
        address_data = {
            "street": "Billing Street",
            "city": "Billing City",
            "state": "State",
            "postal_code": "999999",
            "phone": "+919876543210",
            "label": "billing",
        }

        create_response = await client.post(
            "/api/v1/addresses",
            json=address_data,
            headers=auth_headers
        )

        address_id = create_response.json()["id"]

        # Set as billing
        response = await client.post(
            f"/api/v1/addresses/{address_id}/set-billing",
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["is_billing"] is True

    @pytest.mark.asyncio
    async def test_delete_address(self, client, auth_headers):
        """DELETE /api/v1/addresses/{id} - Delete address"""
        # Create address
        address_data = {
            "street": "To Delete",
            "city": "Delete City",
            "state": "State",
            "postal_code": "888888",
            "phone": "+919876543210",
            "label": "delete_test",
        }

        create_response = await client.post(
            "/api/v1/addresses",
            json=address_data,
            headers=auth_headers
        )

        address_id = create_response.json()["id"]

        # Delete
        response = await client.delete(
            f"/api/v1/addresses/{address_id}",
            headers=auth_headers
        )

        assert response.status_code == 200


# ──────────────────────────────────────────────────────────────────────────────
# PAYMENT METHODS API TESTS
# ──────────────────────────────────────────────────────────────────────────────

class TestPaymentMethodsAPI:
    """Test suite for saved payment methods endpoints"""

    @pytest.mark.asyncio
    async def test_create_card_payment(self, client, auth_headers):
        """POST /api/v1/payments/methods - Add card"""
        payment_data = {
            "type": "card",
            "card_token": "tok_test_1234567890",
            "card_last4": "4111",
            "card_brand": "Visa",
            "card_expiry_month": 12,
            "card_expiry_year": 2026,
        }

        response = await client.post(
            "/api/v1/payments/methods",
            json=payment_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        assert response.json()["type"] == "card"
        assert response.json()["card_last4"] == "4111"
        assert response.json()["is_default"] is True  # First method auto-defaults

    @pytest.mark.asyncio
    async def test_create_upi_payment(self, client, auth_headers):
        """POST /api/v1/payments/methods - Add UPI"""
        payment_data = {
            "type": "upi",
            "upi_id": "user@okhdfcbank",
        }

        response = await client.post(
            "/api/v1/payments/methods",
            json=payment_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        assert response.json()["type"] == "upi"
        assert response.json()["upi_id"] == "user@okhdfcbank"

    @pytest.mark.asyncio
    async def test_create_wallet_payment(self, client, auth_headers):
        """POST /api/v1/payments/methods - Add wallet"""
        payment_data = {
            "type": "wallet",
            "wallet_id": "wallet_test_123",
        }

        response = await client.post(
            "/api/v1/payments/methods",
            json=payment_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        assert response.json()["type"] == "wallet"

    @pytest.mark.asyncio
    async def test_list_payment_methods(self, client, auth_headers):
        """GET /api/v1/payments/methods - List payment methods"""
        response = await client.get(
            "/api/v1/payments/methods?skip=0&limit=10",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "methods" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_set_default_payment(self, client, auth_headers):
        """POST /api/v1/payments/methods/{id}/set-default - Set default"""
        # Create two payment methods
        methods = []
        for payment_type in ["card", "upi"]:
            if payment_type == "card":
                data = {
                    "type": "card",
                    "card_token": f"tok_{payment_type}",
                    "card_last4": "4111",
                    "card_brand": "Visa",
                    "card_expiry_month": 12,
                    "card_expiry_year": 2026,
                }
            else:
                data = {
                    "type": "upi",
                    "upi_id": f"user_{payment_type}@okhdfcbank",
                }

            resp = await client.post(
                "/api/v1/payments/methods",
                json=data,
                headers=auth_headers
            )
            methods.append(resp.json())

        # Set second as default
        response = await client.post(
            f"/api/v1/payments/methods/{methods[1]['id']}/set-default",
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["is_default"] is True

    @pytest.mark.asyncio
    async def test_delete_payment_method(self, client, auth_headers):
        """DELETE /api/v1/payments/methods/{id} - Delete payment method"""
        # Create payment method
        payment_data = {
            "type": "wallet",
            "wallet_id": "wallet_to_delete",
        }

        create_response = await client.post(
            "/api/v1/payments/methods",
            json=payment_data,
            headers=auth_headers
        )

        method_id = create_response.json()["id"]

        # Delete
        response = await client.delete(
            f"/api/v1/payments/methods/{method_id}",
            headers=auth_headers
        )

        assert response.status_code == 200


# ──────────────────────────────────────────────────────────────────────────────
# USER PROFILE API TESTS
# ──────────────────────────────────────────────────────────────────────────────

class TestUserProfileAPI:
    """Test suite for user profile endpoints"""

    @pytest.mark.asyncio
    async def test_get_profile(self, client, auth_headers):
        """GET /api/v1/profile - Get current user profile"""
        response = await client.get(
            "/api/v1/profile",
            headers=auth_headers
        )

        assert response.status_code == 200
        profile = response.json()
        assert "id" in profile
        assert "user_id" in profile
        assert "display_name" in profile

    @pytest.mark.asyncio
    async def test_update_profile(self, client, auth_headers):
        """PUT /api/v1/profile - Update profile"""
        update_data = {
            "display_name": "John Doe Updated",
            "bio": "Coffee enthusiast",
            "timezone": "Asia/Kolkata",
            "preferred_language": "en",
        }

        response = await client.put(
            "/api/v1/profile",
            json=update_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["display_name"] == "John Doe Updated"
        assert response.json()["bio"] == "Coffee enthusiast"

    @pytest.mark.asyncio
    async def test_verify_phone(self, client, auth_headers):
        """POST /api/v1/profile/verify-phone - Mark phone verified"""
        response = await client.post(
            "/api/v1/profile/verify-phone",
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["phone_verified_at"] is not None

    @pytest.mark.asyncio
    async def test_verify_email(self, client, auth_headers):
        """POST /api/v1/profile/verify-email - Mark email verified"""
        response = await client.post(
            "/api/v1/profile/verify-email",
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["email_verified_at"] is not None


# ──────────────────────────────────────────────────────────────────────────────
# ERROR HANDLING TESTS
# ──────────────────────────────────────────────────────────────────────────────

class TestErrorHandling:
    """Test error handling for all endpoints"""

    @pytest.mark.asyncio
    async def test_invalid_address_id(self, client, auth_headers):
        """GET /addresses/{invalid} - Returns 404"""
        response = await client.get(
            "/api/v1/addresses/invalid-id-12345",
            headers=auth_headers
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_missing_required_fields(self, client, auth_headers):
        """POST /addresses - Missing required fields returns 422"""
        response = await client.post(
            "/api/v1/addresses",
            json={"street": "Only street"},  # Missing required fields
            headers=auth_headers
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_upi_format(self, client, auth_headers):
        """POST /payments/methods - Invalid UPI returns 422"""
        response = await client.post(
            "/api/v1/payments/methods",
            json={
                "type": "upi",
                "upi_id": "invalid-without-at",  # Invalid UPI format
            },
            headers=auth_headers
        )

        assert response.status_code == 422


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
