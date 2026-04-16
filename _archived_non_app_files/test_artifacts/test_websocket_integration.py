#!/usr/bin/env python3
"""
WebSocket Integration Test Script for NearShop
Tests both customer order tracking and business shop orders WebSocket endpoints

Usage:
    python test_websocket_integration.py --server http://localhost:8000 --token YOUR_JWT
"""

import asyncio
import json
import argparse
import sys
from datetime import datetime
from typing import Optional
import websockets
from websockets.exceptions import ConnectionClosed


class WebSocketTester:
    """Test WebSocket connections and message flow"""
    
    def __init__(self, base_url: str = "ws://localhost:8000/api/v1", timeout: int = 30):
        self.base_url = base_url
        self.timeout = timeout
        self.test_results = []
    
    def log(self, level: str, msg: str, data: dict = None):
        """Log message with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        prefix = {
            "INFO": "ℹ️ ",
            "PASS": "✅",
            "FAIL": "❌",
            "WAIT": "⏳",
            "RECV": "📨",
        }.get(level, "•")
        
        print(f"[{timestamp}] {prefix} {msg}")
        if data:
            print(f"    {json.dumps(data, indent=6)}")
    
    async def test_customer_order_tracking(self, order_id: str, token: str) -> bool:
        """
        Test 1: Customer Order Tracking
        - Connect to order tracking WebSocket
        - Verify connection message
        - Verify heartbeat
        - Verify ping-pong
        """
        self.log("INFO", "Test 1: Customer Order Tracking", {})
        
        ws_url = f"{self.base_url}/orders/ws/track/{order_id}?token={token}"
        
        try:
            self.log("WAIT", f"Connecting to {ws_url}")
            
            async with websockets.connect(ws_url, ping_interval=None) as ws:
                self.log("PASS", "WebSocket connected")
                
                # Receive initial connection message
                self.log("WAIT", "Waiting for initial message...")
                msg = await asyncio.wait_for(ws.recv(), timeout=self.timeout)
                data = json.loads(msg)
                self.log("RECV", "Received initial message", data)
                
                if data.get("type") != "connected":
                    self.log("FAIL", f"Expected type='connected', got {data.get('type')}")
                    return False
                
                if "order_id" not in data:
                    self.log("FAIL", "Missing order_id in initial message")
                    return False
                
                self.log("PASS", "Initial connection message valid")
                
                # Wait for heartbeat
                self.log("WAIT", "Waiting for heartbeat (up to 35s)...")
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=35)
                    data = json.loads(msg)
                    self.log("RECV", "Received heartbeat", data)
                    
                    if data.get("type") != "heartbeat":
                        self.log("FAIL", f"Expected heartbeat, got {data.get('type')}")
                        return False
                    
                    self.log("PASS", "Heartbeat message valid")
                except asyncio.TimeoutError:
                    self.log("FAIL", "No heartbeat received within 35 seconds")
                    return False
                
                # Test ping-pong
                self.log("WAIT", "Testing ping-pong...")
                await ws.send("ping")
                
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                self.log("RECV", "Received pong", data)
                
                if data.get("type") != "pong":
                    self.log("FAIL", f"Expected type='pong', got {data.get('type')}")
                    return False
                
                self.log("PASS", "Ping-pong working correctly")
                self.test_results.append(("Customer Order Tracking", "PASS"))
                return True
        
        except ConnectionClosed as e:
            self.log("FAIL", f"Connection closed: {e.rcvd} {e.rcvd_then_sent}")
            self.test_results.append(("Customer Order Tracking", "FAIL"))
            return False
        except asyncio.TimeoutError:
            self.log("FAIL", "Connection timeout")
            self.test_results.append(("Customer Order Tracking", "FAIL"))
            return False
        except json.JSONDecodeError as e:
            self.log("FAIL", f"Invalid JSON received: {e}")
            self.test_results.append(("Customer Order Tracking", "FAIL"))
            return False
        except Exception as e:
            self.log("FAIL", f"Unexpected error: {e}")
            self.test_results.append(("Customer Order Tracking", "FAIL"))
            return False
    
    async def test_business_shop_orders(self, shop_id: str, token: str) -> bool:
        """
        Test 2: Business Shop Orders
        - Connect to shop orders WebSocket
        - Verify connection message
        - Verify heartbeat
        - Verify ping-pong
        """
        self.log("INFO", "Test 2: Business Shop Orders", {})
        
        ws_url = f"{self.base_url}/orders/ws/shop/{shop_id}?token={token}"
        
        try:
            self.log("WAIT", f"Connecting to {ws_url}")
            
            async with websockets.connect(ws_url, ping_interval=None) as ws:
                self.log("PASS", "WebSocket connected")
                
                # Receive initial connection message
                self.log("WAIT", "Waiting for initial message...")
                msg = await asyncio.wait_for(ws.recv(), timeout=self.timeout)
                data = json.loads(msg)
                self.log("RECV", "Received initial message", data)
                
                if data.get("type") != "connected":
                    self.log("FAIL", f"Expected type='connected', got {data.get('type')}")
                    return False
                
                if "shop_id" not in data:
                    self.log("FAIL", "Missing shop_id in initial message")
                    return False
                
                self.log("PASS", "Initial connection message valid")
                
                # Wait for heartbeat
                self.log("WAIT", "Waiting for heartbeat (up to 35s)...")
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=35)
                    data = json.loads(msg)
                    self.log("RECV", "Received heartbeat", data)
                    
                    if data.get("type") != "heartbeat":
                        self.log("FAIL", f"Expected heartbeat, got {data.get('type')}")
                        return False
                    
                    self.log("PASS", "Heartbeat message valid")
                except asyncio.TimeoutError:
                    self.log("FAIL", "No heartbeat received within 35 seconds")
                    return False
                
                # Test ping-pong
                self.log("WAIT", "Testing ping-pong...")
                await ws.send("ping")
                
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                self.log("RECV", "Received pong", data)
                
                if data.get("type") != "pong":
                    self.log("FAIL", f"Expected type='pong', got {data.get('type')}")
                    return False
                
                self.log("PASS", "Ping-pong working correctly")
                self.test_results.append(("Business Shop Orders", "PASS"))
                return True
        
        except ConnectionClosed as e:
            self.log("FAIL", f"Connection closed: {e.rcvd} {e.rcvd_then_sent}")
            self.test_results.append(("Business Shop Orders", "FAIL"))
            return False
        except asyncio.TimeoutError:
            self.log("FAIL", "Connection timeout")
            self.test_results.append(("Business Shop Orders", "FAIL"))
            return False
        except json.JSONDecodeError as e:
            self.log("FAIL", f"Invalid JSON received: {e}")
            self.test_results.append(("Business Shop Orders", "FAIL"))
            return False
        except Exception as e:
            self.log("FAIL", f"Unexpected error: {e}")
            self.test_results.append(("Business Shop Orders", "FAIL"))
            return False
    
    async def test_invalid_token(self, order_id: str) -> bool:
        """
        Test 3: Invalid Token Rejection
        - Attempt to connect with invalid token
        - Verify connection is rejected with 4001 code
        """
        self.log("INFO", "Test 3: Invalid Token Rejection", {})
        
        ws_url = f"{self.base_url}/orders/ws/track/{order_id}?token=invalid_token_12345"
        
        try:
            self.log("WAIT", "Attempting connection with invalid token...")
            
            try:
                async with websockets.connect(ws_url, ping_interval=None) as ws:
                    # If we get here, the server didn't reject the token
                    self.log("FAIL", "Server accepted invalid token")
                    self.test_results.append(("Invalid Token Rejection", "FAIL"))
                    return False
            except websockets.exceptions.InvalidStatusException as e:
                # Expected: 4001 Unauthorized
                if "4001" in str(e) or e.status.code == 4001:
                    self.log("PASS", "Invalid token correctly rejected with code 4001")
                    self.test_results.append(("Invalid Token Rejection", "PASS"))
                    return True
                else:
                    self.log("FAIL", f"Unexpected rejection code: {e}")
                    self.test_results.append(("Invalid Token Rejection", "FAIL"))
                    return False
        
        except Exception as e:
            self.log("FAIL", f"Unexpected error: {e}")
            self.test_results.append(("Invalid Token Rejection", "FAIL"))
            return False
    
    async def test_unauthorized_order(self, order_id: str, token: str) -> bool:
        """
        Test 4: Unauthorized Order Access
        - Use valid token but unauthorized order
        - Verify connection is rejected with 4003 code
        """
        self.log("INFO", "Test 4: Unauthorized Order Access", {})
        
        # Use a fake order ID that doesn't exist or isn't owned by the user
        fake_order_id = "00000000-0000-0000-0000-000000000000"
        ws_url = f"{self.base_url}/orders/ws/track/{fake_order_id}?token={token}"
        
        try:
            self.log("WAIT", f"Attempting to access unauthorized order...")
            
            try:
                async with websockets.connect(ws_url, ping_interval=None) as ws:
                    self.log("FAIL", "Server allowed access to unauthorized order")
                    self.test_results.append(("Unauthorized Order Access", "FAIL"))
                    return False
            except websockets.exceptions.InvalidStatusException as e:
                # Expected: 4003 Forbidden or 4004 Not Found
                if any(code in str(e) for code in ["4003", "4004"]):
                    self.log("PASS", f"Unauthorized access correctly rejected")
                    self.test_results.append(("Unauthorized Order Access", "PASS"))
                    return True
                else:
                    self.log("FAIL", f"Unexpected rejection code: {e}")
                    self.test_results.append(("Unauthorized Order Access", "FAIL"))
                    return False
        
        except Exception as e:
            self.log("FAIL", f"Unexpected error: {e}")
            self.test_results.append(("Unauthorized Order Access", "FAIL"))
            return False
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for _, status in self.test_results if status == "PASS")
        failed = sum(1 for _, status in self.test_results if status == "FAIL")
        total = len(self.test_results)
        
        for test_name, status in self.test_results:
            emoji = "✅" if status == "PASS" else "❌"
            print(f"{emoji} {test_name}: {status}")
        
        print("="*60)
        print(f"Total: {total} | Passed: {passed} ✅ | Failed: {failed} ❌")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        print("="*60)
        
        return failed == 0


async def main():
    parser = argparse.ArgumentParser(
        description="WebSocket Integration Test for NearShop",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test with specific order and shop IDs
  python test_websocket_integration.py \\
    --server ws://localhost:8000/api/v1 \\
    --token YOUR_JWT_TOKEN \\
    --order-id 550e8400-e29b-41d4-a716-446655440001 \\
    --shop-id 660e8400-e29b-41d4-a716-446655440002

  # Test with HTTP base URL (auto-converts to WebSocket)
  python test_websocket_integration.py \\
    --server http://localhost:8000/api/v1 \\
    --token YOUR_JWT_TOKEN
        """
    )
    
    parser.add_argument(
        "--server",
        default="ws://localhost:8000/api/v1",
        help="WebSocket server URL (default: ws://localhost:8000/api/v1)"
    )
    parser.add_argument(
        "--token",
        required=True,
        help="JWT token for authentication (required)"
    )
    parser.add_argument(
        "--order-id",
        default="550e8400-e29b-41d4-a716-446655440001",
        help="Order ID to test (default: sample UUID)"
    )
    parser.add_argument(
        "--shop-id",
        default="660e8400-e29b-41d4-a716-446655440002",
        help="Shop ID to test (default: sample UUID)"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="Connection timeout in seconds (default: 30)"
    )
    
    args = parser.parse_args()
    
    # Convert HTTP URL to WebSocket
    base_url = args.server
    if base_url.startswith("http://"):
        base_url = base_url.replace("http://", "ws://")
    elif base_url.startswith("https://"):
        base_url = base_url.replace("https://", "wss://")
    
    print("\n" + "="*60)
    print("NearShop WebSocket Integration Tests")
    print("="*60)
    print(f"Server: {base_url}")
    print(f"Order ID: {args.order_id}")
    print(f"Shop ID: {args.shop_id}")
    print(f"Timeout: {args.timeout}s")
    print("="*60 + "\n")
    
    tester = WebSocketTester(base_url, args.timeout)
    
    try:
        # Run tests
        await tester.test_customer_order_tracking(args.order_id, args.token)
        await tester.test_business_shop_orders(args.shop_id, args.token)
        await tester.test_invalid_token(args.order_id)
        await tester.test_unauthorized_order(args.order_id, args.token)
        
        # Print summary
        success = tester.print_summary()
        
        return 0 if success else 1
    
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        return 1
    except Exception as e:
        print(f"\nFatal error: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
