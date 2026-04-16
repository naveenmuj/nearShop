"""
Razorpay Payment Integration - Client Examples
Shows how to use the payment API from frontend or backend clients
"""

import asyncio
import httpx
import json
from typing import Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RazorpayAPIClient:
    """Client for interacting with Razorpay payment API"""
    
    def __init__(self, base_url: str = "http://localhost:8000", auth_token: Optional[str] = None):
        """
        Initialize API client
        
        Args:
            base_url: API base URL (default: localhost)
            auth_token: Bearer token for authentication
        """
        self.base_url = base_url
        self.auth_token = auth_token
        self.headers = {
            'Content-Type': 'application/json'
        }
        if auth_token:
            self.headers['Authorization'] = f'Bearer {auth_token}'
    
    async def authenticate(self, phone: str, password: str) -> str:
        """
        Authenticate user and get token
        
        Args:
            phone: User phone number
            password: User password
        
        Returns:
            Access token
        """
        logger.info(f"Authenticating user: {phone}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f'{self.base_url}/api/v1/auth/login',
                json={
                    'phone': phone,
                    'password': password
                }
            )
            
            assert response.status_code == 200, f"Auth failed: {response.text}"
            
            token = response.json()['access_token']
            self.auth_token = token
            self.headers['Authorization'] = f'Bearer {token}'
            
            logger.info(f"✅ Authenticated successfully")
            return token
    
    async def save_card(self, card_token: str, card_last4: str, brand: str) -> Dict:
        """
        Save card payment method
        
        Example:
            card = await client.save_card(
                card_token='rzp_test_token_4111',
                card_last4='1111',
                brand='Visa'
            )
        """
        logger.info(f"Saving card: {brand} {card_last4}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f'{self.base_url}/api/v1/payments/methods',
                headers=self.headers,
                json={
                    'type': 'card',
                    'card_token': card_token,
                    'card_last4': card_last4,
                    'card_brand': brand,
                    'card_expiry_month': 12,
                    'card_expiry_year': 2025,
                    'display_name': f'My {brand} Card'
                }
            )
            
            assert response.status_code == 201, f"Failed to save card: {response.text}"
            payment = response.json()
            
            logger.info(f"✅ Card saved: {payment['id']}")
            return payment
    
    async def save_upi(self, upi_id: str) -> Dict:
        """
        Save UPI payment method
        
        Example:
            upi = await client.save_upi('testuser@okhdfcbank')
        """
        logger.info(f"Saving UPI: {upi_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f'{self.base_url}/api/v1/payments/methods',
                headers=self.headers,
                json={
                    'type': 'upi',
                    'upi_id': upi_id,
                    'display_name': f'My UPI - {upi_id.split("@")[0]}'
                }
            )
            
            assert response.status_code == 201, f"Failed to save UPI: {response.text}"
            payment = response.json()
            
            logger.info(f"✅ UPI saved: {payment['id']}")
            return payment
    
    async def list_payment_methods(self) -> list:
        """
        Get all saved payment methods
        
        Example:
            methods = await client.list_payment_methods()
            for method in methods:
                print(f"{method['type']}: {method['display_name']}")
        """
        logger.info("Fetching payment methods...")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f'{self.base_url}/api/v1/payments/methods',
                headers=self.headers
            )
            
            assert response.status_code == 200
            methods = response.json()
            
            logger.info(f"✅ Found {len(methods)} payment methods")
            return methods
    
    async def get_default_payment(self) -> Dict:
        """
        Get default payment method
        
        Example:
            default = await client.get_default_payment()
            print(f"Default payment: {default['display_name']}")
        """
        logger.info("Fetching default payment method...")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f'{self.base_url}/api/v1/payments/methods/default',
                headers=self.headers
            )
            
            if response.status_code == 200:
                payment = response.json()
                logger.info(f"✅ Default payment: {payment['display_name']}")
                return payment
            else:
                logger.warning("No default payment method set")
                return None
    
    async def set_default_payment(self, payment_id: str) -> Dict:
        """
        Set payment method as default
        
        Example:
            await client.set_default_payment('pm_card_1')
        """
        logger.info(f"Setting default payment: {payment_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f'{self.base_url}/api/v1/payments/methods/{payment_id}/set-default',
                headers=self.headers
            )
            
            assert response.status_code == 200
            result = response.json()
            
            logger.info(f"✅ Default payment set: {payment_id}")
            return result
    
    async def create_order(
        self,
        items: list,
        total_amount: float,
        address_id: str,
        discount: float = 0,
        delivery_fee: float = 0,
        notes: str = None
    ) -> Dict:
        """
        Create order for payment
        
        Example:
            order = await client.create_order(
                items=[
                    {'product_id': 'prod_1', 'quantity': 2, 'price': 299.99}
                ],
                total_amount=599.98,
                address_id='addr_1',
                discount=50.0,
                delivery_fee=40.0
            )
            print(f"Order created: {order['razorpay_order_id']}")
            print(f"Pay ₹{order['final_amount']}")
        """
        logger.info(f"Creating order: ₹{total_amount}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f'{self.base_url}/api/v1/orders',
                headers=self.headers,
                json={
                    'items': items,
                    'shipping_address_id': address_id,
                    'billing_address_id': address_id,
                    'total_amount': total_amount,
                    'discount_amount': discount,
                    'delivery_fee': delivery_fee,
                    'notes': notes
                }
            )
            
            assert response.status_code == 201, f"Failed to create order: {response.text}"
            order = response.json()
            
            logger.info(f"✅ Order created: {order['id']}")
            logger.info(f"   Razorpay Order ID: {order['razorpay_order_id']}")
            logger.info(f"   Total: ₹{order['total_amount']}")
            logger.info(f"   Discount: ₹{order['discount_amount']}")
            logger.info(f"   Delivery Fee: ₹{order['delivery_fee']}")
            logger.info(f"   Final Amount: ₹{order['final_amount']}")
            
            return order
    
    async def get_payment_config(self) -> Dict:
        """
        Get payment configuration (public endpoint)
        
        Example:
            config = await client.get_payment_config()
            print(f"Razorpay Key: {config['razorpay_key']}")
            print(f"Test Mode: {config['test_mode']}")
        """
        logger.info("Fetching payment configuration...")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f'{self.base_url}/api/v1/payments/config'
            )
            
            assert response.status_code == 200
            config = response.json()
            
            logger.info(f"✅ Payment config fetched")
            logger.info(f"   Test Mode: {config['test_mode']}")
            logger.info(f"   Razorpay Key: {config['razorpay_key']}")
            logger.info(f"   Supported Methods: {', '.join(config['supported_methods'])}")
            
            return config


# ============= Example Usage =============

async def example_1_simple_card_payment():
    """Example 1: Simple card payment"""
    print("\n" + "="*80)
    print("EXAMPLE 1: Simple Card Payment")
    print("="*80)
    
    client = RazorpayAPIClient()
    
    # Authenticate
    await client.authenticate(
        phone='+919876543210',
        password='TestPassword123'
    )
    
    # Save card
    card = await client.save_card(
        card_token='rzp_test_token_4111',
        card_last4='1111',
        brand='Visa'
    )
    
    # Create order
    order = await client.create_order(
        items=[
            {'product_id': '1', 'quantity': 1, 'price': 299.99}
        ],
        total_amount=299.99,
        address_id='addr_1'
    )
    
    print(f"\n✅ Ready to pay ₹{order['final_amount']}")
    print(f"   Razorpay Order ID: {order['razorpay_order_id']}")


async def example_2_multiple_products_with_upi():
    """Example 2: Multiple products with UPI"""
    print("\n" + "="*80)
    print("EXAMPLE 2: Multiple Products with UPI")
    print("="*80)
    
    client = RazorpayAPIClient()
    
    # Authenticate
    await client.authenticate(
        phone='+919876543210',
        password='TestPassword123'
    )
    
    # Save UPI
    upi = await client.save_upi('testuser@okhdfcbank')
    
    # Create order
    order = await client.create_order(
        items=[
            {'product_id': '1', 'quantity': 2, 'price': 299.99},
            {'product_id': '2', 'quantity': 1, 'price': 499.99}
        ],
        total_amount=1099.97,
        address_id='addr_1'
    )
    
    print(f"\n✅ Ready to pay ₹{order['final_amount']} via UPI")
    print(f"   UPI ID: testuser@okhdfcbank")


async def example_3_bulk_with_discount():
    """Example 3: Bulk order with discount"""
    print("\n" + "="*80)
    print("EXAMPLE 3: Bulk Order with Discount")
    print("="*80)
    
    client = RazorpayAPIClient()
    
    # Authenticate
    await client.authenticate(
        phone='+919876543210',
        password='TestPassword123'
    )
    
    # Get default payment
    default = await client.get_default_payment()
    
    # Create order with discount
    subtotal = 999.95
    discount = 100.00
    
    order = await client.create_order(
        items=[
            {'product_id': '3', 'quantity': 5, 'price': 199.99}
        ],
        total_amount=subtotal,
        address_id='addr_2',
        discount=discount
    )
    
    print(f"\n✅ Order created with discount")
    print(f"   Subtotal: ₹{subtotal}")
    print(f"   Discount: ₹{discount}")
    print(f"   Final Amount: ₹{order['final_amount']}")


async def example_4_express_delivery():
    """Example 4: Express delivery order"""
    print("\n" + "="*80)
    print("EXAMPLE 4: Express Delivery Order")
    print("="*80)
    
    client = RazorpayAPIClient()
    
    # Authenticate
    await client.authenticate(
        phone='+919876543210',
        password='TestPassword123'
    )
    
    # Create order with express delivery
    product_total = 299.99
    delivery_fee = 50.00
    
    order = await client.create_order(
        items=[
            {'product_id': '1', 'quantity': 1, 'price': product_total}
        ],
        total_amount=product_total,
        address_id='addr_1',
        delivery_fee=delivery_fee,
        notes='Express delivery requested'
    )
    
    print(f"\n✅ Express delivery order created")
    print(f"   Product Total: ₹{product_total}")
    print(f"   Delivery Fee (Express): ₹{delivery_fee}")
    print(f"   Final Amount: ₹{order['final_amount']}")


async def example_5_saved_payment_reuse():
    """Example 5: Reuse saved payment for faster checkout"""
    print("\n" + "="*80)
    print("EXAMPLE 5: Saved Payment Reuse")
    print("="*80)
    
    client = RazorpayAPIClient()
    
    # Authenticate
    await client.authenticate(
        phone='+919876543210',
        password='TestPassword123'
    )
    
    # Get default payment
    default = await client.get_default_payment()
    
    if default:
        print(f"✅ Using default payment: {default['display_name']}")
    
    # List all payment methods
    methods = await client.list_payment_methods()
    
    print(f"\n📋 Your saved payment methods:")
    for method in methods:
        is_default = " (DEFAULT)" if method.get('is_default') else ""
        if method['type'] == 'card':
            print(f"   💳 {method['card_brand']} ...{method['card_last4']}{is_default}")
        elif method['type'] == 'upi':
            print(f"   📱 UPI - {method['upi_id']}{is_default}")
    
    # Create order using default payment
    order = await client.create_order(
        items=[
            {'product_id': '2', 'quantity': 2, 'price': 499.99}
        ],
        total_amount=999.98,
        address_id='addr_3'
    )
    
    print(f"\n✅ Order created using default payment")
    print(f"   Final Amount: ₹{order['final_amount']}")


async def example_config_info():
    """Example: Get payment configuration"""
    print("\n" + "="*80)
    print("EXAMPLE: Payment Configuration")
    print("="*80)
    
    client = RazorpayAPIClient()
    
    # Get config (public endpoint)
    config = await client.get_payment_config()
    
    print(f"\n📊 Payment Configuration:")
    print(f"   Razorpay Enabled: {config['razorpay_enabled']}")
    print(f"   Test Mode: {config['test_mode']}")
    print(f"   Supported Methods: {', '.join(config['supported_methods'])}")
    
    if config['test_mode'] and config['test_cards']:
        print(f"\n🧪 Test Cards Available:")
        for card_name, card_info in config['test_cards'].items():
            print(f"   {card_info['name']}: {card_info['number']}")


async def run_all_examples():
    """Run all examples"""
    try:
        await example_config_info()
        await example_1_simple_card_payment()
        await example_2_multiple_products_with_upi()
        await example_3_bulk_with_discount()
        await example_4_express_delivery()
        await example_5_saved_payment_reuse()
    except Exception as e:
        logger.error(f"Error running examples: {str(e)}")


if __name__ == '__main__':
    # Run examples
    print("\n🚀 Razorpay Payment Integration - Client Examples\n")
    
    # Run individual examples
    asyncio.run(example_config_info())
    
    # Uncomment to run all examples (requires server running)
    # asyncio.run(run_all_examples())
